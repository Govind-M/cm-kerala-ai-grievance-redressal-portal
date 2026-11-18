"""Read-only, no-provider AI readiness and hosted-record preservation checks."""

import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.core.config import BACKEND_DIR
from app.db.engine import build_engine
from app.modules.ai import repository
from scripts.supabase_db import APP_TABLES, require_supabase_identity, target_fingerprint

PROJECT = os.environ.get("EXPECTED_SUPABASE_PROJECT", "")
FINGERPRINT = os.environ.get("EXPECTED_TARGET_FINGERPRINT", "")


def require(condition):
    if not condition:
        raise RuntimeError(
            "Readiness guard failed; inspect configuration without displaying secrets"
        )


def record_hashes(c):
    return {
        name: dict(
            c.execute(text(f'SELECT id::text, md5(to_jsonb(t)::text) FROM public."{name}" t')).all()
        )
        for name in sorted(APP_TABLES)
    }


def config_hashes():
    paths = [BACKEND_DIR / ".env", BACKEND_DIR.parent / "frontend" / ".env.local"]
    return {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths if p.exists()}


def verify_identity(c, s):
    require(bool(PROJECT and FINGERPRINT))
    url = s.selected_database_url
    ref = (
        url.username.rsplit(".", 1)[-1]
        if url.host.endswith(".pooler.supabase.com")
        else url.host.split(".")[1]
    )
    require(ref == PROJECT and target_fingerprint(s) == FINGERPRINT)
    require_supabase_identity(s, c)
    require(c.scalars(text("SELECT version_num FROM public.alembic_version")).all() == ["0008"])


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["capture", "compare"])
    parser.add_argument("--base-env", type=Path)
    parser.add_argument(
        "--snapshot",
        type=Path,
        required=True,
        help="Private Git-ignored path. Capture never overwrites an existing file.",
    )
    args = parser.parse_args(argv)
    from scripts.ai_runtime import load_settings

    s = load_settings(args.base_env, database_target="supabase")
    require(not s.ai_enabled and not s.ai_live_requests_enabled)
    url = s.selected_database_url
    ref = (
        url.username.rsplit(".", 1)[-1]
        if url.host.endswith(".pooler.supabase.com")
        else url.host.split(".")[1]
    )
    require(ref == PROJECT and target_fingerprint(s) == FINGERPRINT)
    engine = build_engine(s, migration=True)
    try:
        with engine.connect().execution_options(isolation_level="REPEATABLE READ") as c:
            c.execute(text("SET TRANSACTION READ ONLY"))
            verify_identity(c, s)
            inspector = inspect(c)
            require(set(inspector.get_table_names(schema="public")) >= APP_TABLES)
            extension = dict(
                c.execute(
                    text(
                        "SELECT e.extversion,n.nspname FROM pg_extension e JOIN pg_namespace n "
                        "ON e.extnamespace=n.oid WHERE e.extname='vector'"
                    )
                )
                .mappings()
                .one()
            )
            column = c.scalar(
                text(
                    "SELECT format_type(atttypid,atttypmod) FROM pg_attribute "
                    "WHERE attrelid='public.grievance_embeddings'::regclass AND attname='embedding'"
                )
            )
            require(column.endswith("vector(768)"))
            a = "[" + ",".join(["1"] + ["0"] * 767) + "]"
            b = "[" + ",".join(["0", "1"] + ["0"] * 766) + "]"
            # Pure SELECT over synthetic vectors: no temporary tables or inserted rows.
            ranked = c.execute(
                text(
                    "WITH v(id,embedding) AS (VALUES (1,CAST(:a AS vector(768))),"
                    "(2,CAST(:b AS vector(768)))) "
                    "SELECT id,embedding <=> CAST(:a AS vector(768)) AS distance FROM v ORDER BY distance,id"
                ),
                {"a": a, "b": b},
            ).all()
            require(ranked == [(1, 0.0), (2, 1.0)])
            with Session(bind=c, join_transaction_mode="create_savepoint") as db:
                repository.similar(
                    db, SimpleNamespace(id=uuid4(), district="Ernakulam"), [1.0] + [0.0] * 767, s
                )
            current = {
                "project": PROJECT,
                "fingerprint": FINGERPRINT,
                "revision": "0008",
                "rows": record_hashes(c),
                "private_config_hashes": config_hashes(),
            }
            if args.base_env:
                current["private_config_hashes"][str(args.base_env.resolve())] = hashlib.sha256(
                    args.base_env.read_bytes()
                ).hexdigest()
            output = {
                "backend_dir": str(BACKEND_DIR),
                "key_present": bool(s.gemini_api_key and s.gemini_api_key.get_secret_value()),
                "ai_enabled": s.ai_enabled,
                "live_requests_enabled": s.ai_live_requests_enabled,
                "project": PROJECT,
                "fingerprint": FINGERPRINT,
                "revision": "0008",
                "chat_model": s.gemini_chat_model,
                "embedding_model": s.gemini_embedding_model,
                "dimensions": s.ai_embedding_dimensions,
                "vector_extension": extension,
                "vector_column": column,
                "cosine_select_and_orm_query": "passed",
                "embedding_indexes": inspector.get_indexes("grievance_embeddings", schema="public"),
                "counts": {t: len(rows) for t, rows in current["rows"].items()},
                "packages": {
                    p: importlib.metadata.version(p)
                    for p in [
                        "langchain-core",
                        "langchain-google-genai",
                        "google-genai",
                        "pgvector",
                    ]
                },
                "live_gemini_requests": 0,
                "database_writes": 0,
            }
            if args.mode == "capture":
                with args.snapshot.open("x", encoding="utf-8") as f:
                    json.dump(current, f)
            else:
                before = json.loads(args.snapshot.read_text(encoding="utf-8"))
                require(before == current)
                output["all_hosted_records_and_private_configuration_unchanged"] = True
            c.rollback()
            print(json.dumps(output, default=str))
    finally:
        engine.dispose()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"result": "STOP", "error_type": type(exc).__name__}))
        raise SystemExit(1) from None
