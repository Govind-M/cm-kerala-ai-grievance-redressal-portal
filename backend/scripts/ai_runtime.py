"""Dedicated integrated-worktree runtime. Defaults off; never edits environment files."""

import argparse
import json
import os
from contextlib import nullcontext
from pathlib import Path
from threading import Lock

from app.core.config import BACKEND_DIR, Settings, get_settings


def load_settings(base_env=None, **overrides):
    from dotenv import dotenv_values

    files = [BACKEND_DIR / ".env"]
    if base_env:
        base = Path(base_env).resolve()
        if not base.is_file():
            raise ValueError("Base environment file does not exist")
        files.insert(0, base)
    # The integrated example file contains blank DB/JWT placeholders. They must
    # not erase explicit non-empty base configuration. Real process env wins.
    values = {}
    for path in files:
        layer = {k.lower(): v for k, v in dotenv_values(path).items() if v not in (None, "")}
        if layer.get("supabase_sslrootcert"):
            cert = Path(layer["supabase_sslrootcert"])
            if not cert.is_absolute():
                layer["supabase_sslrootcert"] = str((path.parent / cert).resolve())
        values.update(layer)
    for name in Settings.model_fields:
        if name.upper() in os.environ:
            values[name] = os.environ[name.upper()]
    values.update(overrides)
    return Settings(_env_file=None, **values)


class BoundedProvider:
    """Global per-process cap on provider operations; retries must remain zero."""

    def __init__(self, provider, budget):
        self.provider, self.budget = provider, budget
        self.attempts = {"chat": 0, "embedding": 0}
        self.failed = False
        self.lock = Lock()

    def charge(self, kind):
        from app.modules.ai.errors import AIQuotaExceeded, AIUnavailable

        with self.lock:
            if self.failed:
                raise AIUnavailable(
                    "Dedicated AI runtime stopped after a provider failure. Manual workflows remain available."
                )
            if sum(self.attempts.values()) >= self.budget:
                raise AIQuotaExceeded()
            self.attempts[kind] += 1

    def structured(self, *args):
        self.charge("chat")
        try:
            return self.provider.structured(*args)
        except Exception:
            with self.lock:
                self.failed = True
            raise

    def embed(self, *args):
        self.charge("embedding")
        try:
            return self.provider.embed(*args)
        except Exception:
            with self.lock:
                self.failed = True
            raise

    def close(self):
        self.provider.close()


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--base-env", type=Path)
    p.add_argument("--port", type=int, default=8010)
    p.add_argument(
        "--local-ai",
        action="store_true",
        help="Separately authorized normal user-initiated local AI; existing throttling, no verification budget",
    )
    p.add_argument(
        "--live-ledger",
        type=Path,
        help="Reuse the existing seven-request verification ledger; never reset its budget",
    )
    p.add_argument(
        "--approved-live-requests",
        type=int,
        default=0,
        help="Only after separate user approval: total provider-operation budget, 1–10",
    )
    args = p.parse_args(argv)
    if args.local_ai and (args.approved_live_requests or args.live_ledger):
        p.error("Normal local runtime and bounded verification are separate modes")
    if not 0 <= args.approved_live_requests <= 10:
        p.error("Live request budget must be 0–10")
    if args.live_ledger and (args.approved_live_requests != 7 or not args.live_ledger.is_file()):
        p.error("Persistent verification requires the existing ledger and approved budget 7")
    s = load_settings(
        args.base_env,
        database_target="supabase",
        ai_max_retries=0,
        ai_enabled=bool(args.approved_live_requests or args.local_ai),
        ai_live_requests_enabled=bool(args.approved_live_requests or args.local_ai),
    )
    if s.app_env == "production":
        raise ValueError("Dedicated development runtime refuses production")
    if args.local_ai and s.app_env != "development":
        raise ValueError("Normal local AI is development-only")
    # Validate the target read-only before opening a runtime capable of any writes.
    from app.db.engine import build_engine
    from scripts.ai_readiness import verify_identity

    engine = build_engine(s, migration=True)
    try:
        from sqlalchemy import text

        with engine.connect() as c:
            c.execute(text("SET TRANSACTION READ ONLY"))
            verify_identity(c, s)
    finally:
        engine.dispose()
    # Process-only export keeps get_db/get_settings and app.state.settings consistent.
    for name in Settings.model_fields:
        value = getattr(s, name)
        if value is not None:
            if hasattr(value, "get_secret_value"):
                value = value.get_secret_value()
            os.environ[name.upper()] = str(value)
    os.environ.update(LANGSMITH_TRACING="false", LANGCHAIN_TRACING_V2="false")
    get_settings.cache_clear()
    import uvicorn

    from app.main import create_app
    from app.modules.ai.runtime import AIRuntime

    app = create_app(get_settings())
    ledger = None
    if args.live_ledger:
        from scripts.ai_live_budget import CountedProvider, LiveLedger

        ledger = LiveLedger(args.live_ledger)
        provider = CountedProvider(app.state.ai_runtime.provider, ledger)
    elif args.local_ai:
        provider = app.state.ai_runtime.provider
    else:
        provider = BoundedProvider(app.state.ai_runtime.provider, args.approved_live_requests)
    app.state.ai_runtime = AIRuntime(get_settings(), provider)
    print(
        json.dumps(
            {
                "backend_dir": str(BACKEND_DIR),
                "key_present": bool(s.gemini_api_key and s.gemini_api_key.get_secret_value()),
                "ai_enabled": s.ai_enabled,
                "live_enabled": s.ai_live_requests_enabled,
                "provider_operation_budget": None if args.local_ai else args.approved_live_requests,
                "runtime_mode": "manual-local-ai" if args.local_ai else "bounded-or-disabled",
            }
        ),
        flush=True,
    )
    try:
        with ledger.guard() if ledger else nullcontext():
            uvicorn.run(
                app, host="127.0.0.1", port=args.port, access_log=False, log_level="warning"
            )
    finally:
        print(
            json.dumps(
                {
                    "provider_operation_attempts": ledger.data
                    if ledger
                    else getattr(provider, "attempts", "manual-user-initiated")
                }
            ),
            flush=True,
        )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"result": "STOP", "error_type": type(exc).__name__}))
        raise SystemExit(1) from None
