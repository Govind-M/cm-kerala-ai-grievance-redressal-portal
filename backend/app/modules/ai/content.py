"""Stable content serialization, shared by indexing and stale-candidate validation."""

import hashlib
import json

from app.modules.ai.privacy import minimize


def source_content(row) -> str:
    return json.dumps(
        {
            "format": "grievance-v2-minimized",
            "district": row.district,
            "category": row.category,
            "subject": minimize(row.subject),
            "description": minimize(row.description),
        },
        ensure_ascii=False,
        sort_keys=True,
    )


def fingerprint(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()
