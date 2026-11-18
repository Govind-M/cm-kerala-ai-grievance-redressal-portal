"""Offline source/build/staged secret check. Reports locations/rules, never values.

This is a bounded submission check, not a substitute for provider-side secret
rotation or a maintained organization-wide scanner. Synthetic test credentials
are reviewed separately; actual known private values always fail the scan.
"""

import argparse
import json
import re
import subprocess
from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy.engine import make_url

RULES = {
    "google-api-key": r"AIza[0-9A-Za-z_-]{35}",
    "github-token": r"(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})",
    "supabase-secret": r"sb_secret_[A-Za-z0-9_-]{20,}",
    "private-key": r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    "signed-jwt": r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}",
    "render-token": r"rnd_[A-Za-z0-9]{25,}",
    "hardcoded-sensitive-literal": (
        r"(?i)(?:api_key|secret_key|password|access_token|refresh_token)"
        r"\s*[:=]\s*['\"][A-Za-z0-9_+/=-]{12,}['\"]"
    ),
    "postgres-credential": r"postgres(?:ql)?(?:\+psycopg)?://[^\s:'\"]+:[^\s@'\"]+@[^\s'\"]+",
}
SKIP = {
    ".git", ".local", ".venv", "venv", "node_modules", "__pycache__",
    ".pytest_cache", ".ruff_cache", ".mypy_cache",
}


def private_values(env_paths, json_paths):
    values = set()
    for path in env_paths:
        for key, value in dotenv_values(path).items():
            if value and len(value) >= 12 and any(
                word in key.lower() for word in ("password", "secret", "key", "database_url")
            ):
                values.add(value.encode())
                if "database_url" in key.lower():
                    try:
                        password = make_url(value).password
                        if password and len(password) >= 8:
                            values.add(password.encode())
                    except Exception:
                        pass

    def collect(obj):
        if isinstance(obj, dict):
            for key, value in obj.items():
                if isinstance(value, str) and len(value) >= 12 and any(
                    word in key.lower() for word in ("password", "token", "secret", "key")
                ):
                    values.add(value.encode())
                else:
                    collect(value)
        elif isinstance(obj, list):
            for value in obj:
                collect(value)

    for path in json_paths:
        collect(json.loads(path.read_text(encoding="utf-8")))
    return values


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    parser.add_argument("--staged", action="store_true")
    parser.add_argument("--private-env", type=Path, action="append", default=[])
    parser.add_argument("--private-json", type=Path, action="append", default=[])
    args = parser.parse_args(argv)
    root = args.root.resolve()
    known = private_values(args.private_env, args.private_json)
    if args.staged:
        output = subprocess.check_output(["git", "ls-files", "--stage", "-z"], cwd=root)
        entries = []
        for row in output.split(b"\0"):
            if row:
                meta, name = row.split(b"\t", 1)
                blob = meta.split()[1].decode()
                entries.append((name.decode(), subprocess.check_output(
                    ["git", "cat-file", "blob", blob], cwd=root
                )))
    else:
        entries = [(p.relative_to(root).as_posix(), p.read_bytes())
                   for p in root.rglob("*") if p.is_file()
                   and not set(p.relative_to(root).parts) & SKIP]
    findings = []
    reviewed = []
    for name, data in entries:
        if any(value in data for value in known):
            findings.append({"path": name, "rule": "known-private-value"})
        text = data.decode("utf-8", errors="replace")
        for rule, pattern in RULES.items():
            for match in re.finditer(pattern, text):
                value = match.group()
                if rule == "postgres-credential" and any(marker in value for marker in (
                    "USERNAME:PASSWORD", ":change_me@", ":secret@localhost",
                    ":pass@", ":test@", ":p@", ":pw@", ":wrong@", ":private@",
                )):
                    reviewed.append({"path": name, "rule": "placeholder-database-url"})
                elif name.startswith("backend/tests/") or "/src/test/" in name:
                    reviewed.append({"path": name, "rule": "synthetic-test-" + rule})
                else:
                    findings.append({"path": name, "rule": rule})
    print(json.dumps({"files_scanned": len(entries), "known_values_checked": len(known),
                      "findings": findings, "reviewed_synthetic_matches": reviewed}, indent=2))
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
