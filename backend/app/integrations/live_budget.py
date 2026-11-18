"""Development-only durable invocation budget; not a distributed production quota.

Primary accounting happens in GeminiProvider BEFORE invocation. SDK interception
only audits/limits transmissions. No prompts, URLs, credentials or raw errors persist.
One process owns a ledger; a lifetime OS file lock rejects a second owner.
"""

import json
import os
from contextlib import ExitStack, contextmanager
from contextvars import ContextVar
from pathlib import Path
from threading import Lock, get_ident
from unittest.mock import patch
from urllib.parse import urlsplit

from app.modules.ai.errors import AIQuotaExceeded, AIUnavailable

LIMITS = {
    "verify": 1,
    "citizen": 1,
    "cmo": 1,
    "embedding": 3,
    "duplicates": 1,
    "report": 1,
    "targeted_retry": 2,
}
SCOPE = ContextVar("recovery_scope", default=None)
TICKET = ContextVar("recovery_ticket", default=None)


class RecoveryBudget:
    def __init__(self, path):
        self.path = Path(path)
        self.lock = Lock()
        self.guard_active = False
        self.owner = self.path.with_suffix(".lock").open("a+b")
        self.owner.seek(0)
        if os.name == "nt":
            import msvcrt

            # Lock a fixed byte even in an empty file; never delete/recreate it.
            msvcrt.locking(self.owner.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl

            fcntl.flock(self.owner.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        if self.path.exists():
            self.data = json.loads(self.path.read_text(encoding="utf-8"))
            if self.data.get("limits") != LIMITS:
                raise ValueError("Recovery ledger scope mismatch")
        else:
            self.data = {"limits": LIMITS, "requests": [], "stopped": False}
            self.save()

    def save(self):
        # The private ledger is fail-closed if interrupted/corrupt. Never reset it.
        with self.path.open("w", encoding="utf-8") as stream:
            json.dump(self.data, stream, indent=2)
            stream.flush()
            os.fsync(stream.fileno())

    def close(self):
        self.owner.close()

    def seal(self):
        """End this authorization permanently without spending unused attempts."""
        with self.lock:
            self.data["completed"] = True
            self.data["stopped"] = True
            self.save()

    def review_embedding_guard_fix(self):
        """Explicit operator-run continuation; never reset or discard attempts.

        Only the known, non-transmitted single-input embedding mismatch qualifies.
        The next invocation must consume the separately authorized retry allocation.
        """
        last = self.data["requests"][-1]
        if not (
            self.data["stopped"]
            and last["operation"] == "embedding"
            and last["transmissions"] == 0
            and len(self.data["requests"]) == 4
        ):
            raise AIUnavailable("This failure requires separate operator review.")
        self.data["reviewed_fix"] = "single-input SDK batchEmbedContents audit compatibility"
        self.data["retry_required"] = True
        self.data["stopped"] = False
        self.save()

    @contextmanager
    def scope(self, purpose):
        token = SCOPE.set(purpose)
        try:
            yield
        finally:
            SCOPE.reset(token)

    @contextmanager
    def attempt(self, kind):
        purpose = (
            "targeted_retry"
            if SCOPE.get() == "targeted_retry"
            else SCOPE.get()
            if kind == "classification"
            else kind
        )
        # Serialize full operations: no second operation starts after a failure.
        with self.lock:
            if self.data["stopped"]:
                raise AIUnavailable("Recovery stopped; review failure before further live work.")
            if self.data.get("retry_required") and purpose != "targeted_retry":
                raise AIUnavailable("Reviewed continuation requires the reserved retry allocation.")
            if (
                purpose not in LIMITS
                or len(self.data["requests"]) >= 10
                or sum(r["purpose"] == purpose for r in self.data["requests"]) >= LIMITS[purpose]
            ):
                raise AIQuotaExceeded()
            entry = {
                "number": len(self.data["requests"]) + 1,
                "purpose": purpose,
                "operation": kind,
                "outcome": "invocation_attempt",
                "transmissions": 0,
            }
            self.data["requests"].append(entry)
            self.data["retry_required"] = False
            self.save()
            token = TICKET.set((self, entry, get_ident()))
            try:
                yield
                if entry["transmissions"] != 1:
                    raise AIUnavailable("Provider invocation did not reconcile with SDK audit.")
                entry["outcome"] = "success"
            except BaseException as exc:
                entry["outcome"] = "failed"
                self.data["stopped"] = True
                # Inspect only typed metadata; do not stringify exceptions.
                causes = [exc]
                for _ in range(5):
                    cause = causes[-1].__cause__ or causes[-1].__context__
                    if cause is None or any(cause is previous for previous in causes):
                        break
                    causes.append(cause)
                for cause in causes:
                    code = getattr(cause, "code", None) or getattr(cause, "status_code", None)
                    if isinstance(code, int):
                        entry.setdefault("status_code", code)
                raise
            finally:
                TICKET.reset(token)
                self.save()

    @contextmanager
    def guard(self):
        from google.genai._api_client import BaseApiClient

        original = BaseApiClient._request_once

        def audited(client, request, stream=False):
            ticket = TICKET.get()
            if ticket is None or ticket[0] is not self or ticket[2] != get_ident():
                raise AIUnavailable("Unbudgeted/background SDK request blocked.")
            entry = ticket[1]
            url = urlsplit(request.url)
            embedding = entry["operation"] == "embedding"
            suffixes = (
                (":embedContent", ":batchEmbedContents") if embedding else (":generateContent",)
            )
            single_input = True
            if url.path.endswith(":batchEmbedContents"):
                data = request.data
                single_input = isinstance(data, dict) and len(data.get("requests", [])) == 1
            if (
                entry["transmissions"]
                or stream
                or request.method.upper() != "POST"
                or url.scheme != "https"
                or url.hostname != "generativelanguage.googleapis.com"
                or not url.path.endswith(suffixes)
                or not single_input
            ):
                raise AIUnavailable("Unexpected provider request or automatic retry blocked.")
            entry["transmissions"] = 1
            self.save()
            try:
                result = original(client, request, stream)
                entry["status_code"] = 200
                return result
            except Exception as exc:
                code = getattr(exc, "code", None)
                if isinstance(code, int):
                    entry["status_code"] = code
                # Inspect in memory; never persist provider response bodies.
                body = getattr(exc, "response_json", {}) or {}
                details = body.get("error", {}).get("details", []) if isinstance(body, dict) else []
                reasons = {item.get("reason") for item in details if isinstance(item, dict)}
                entry["error_category"] = (
                    "API_KEY_INVALID"
                    if "API_KEY_INVALID" in reasons
                    else "QUOTA_EXHAUSTED"
                    if code == 429
                    else "AUTHENTICATION_OR_PERMISSION"
                    if code in (401, 403)
                    else "MODEL_UNAVAILABLE"
                    if code == 404
                    else "PROVIDER_REQUEST_REJECTED"
                )
                raise

        async def deny_async(*args, **kwargs):
            raise AIUnavailable("Async Gemini is unsupported in this bounded synchronous run.")

        with ExitStack() as stack:
            stack.enter_context(patch.object(BaseApiClient, "_request_once", audited))
            stack.enter_context(patch.object(BaseApiClient, "_async_request_once", deny_async))
            self.guard_active = True
            try:
                yield
            finally:
                self.guard_active = False
