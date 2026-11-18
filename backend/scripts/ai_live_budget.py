"""Explicit seven-request verification ledger. Never logs bodies or credentials."""

import json
import os
from contextvars import ContextVar
from pathlib import Path
from threading import Lock
from unittest.mock import patch

import httpx

from app.modules.ai.errors import AIQuotaExceeded, AIUnavailable

LIMITS = {"classification": 2, "embedding": 3, "duplicates": 1, "report": 1}
PURPOSE = ContextVar("approved_live_purpose", default=None)


def save(path, data):
    with Path(path).open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.flush()
        os.fsync(f.fileno())


def error_category(response):
    # Raw provider text may contain confidential content: inspect only in memory.
    try:
        error = response.json().get("error", {})
        message = str(error.get("message", "")).lower()
        reasons = [d.get("reason") for d in error.get("details", []) if isinstance(d, dict)]
        if "API_KEY_INVALID" in reasons or "api key not valid" in message:
            return "API_KEY_INVALID"
        if response.status_code == 429 or "quota" in message:
            return "QUOTA_EXHAUSTED"
        if "billing" in message:
            return "BILLING_CONFIGURATION"
        if response.status_code in (401, 403):
            return "AUTHENTICATION_OR_PERMISSION"
        if "not found" in message and "model" in message:
            return "MODEL_UNAVAILABLE"
        if "schema" in message:
            return "STRUCTURED_SCHEMA_REJECTED"
    except Exception:
        pass
    return "PROVIDER_REQUEST_REJECTED"


class LiveLedger:
    def __init__(self, path):
        self.path = Path(path)
        self.lock = Lock()
        if self.path.exists():
            self.data = json.loads(self.path.read_text(encoding="utf-8"))
            if self.data.get("limits") != LIMITS:
                raise ValueError("Ledger scope mismatch")
        else:
            self.data = {"limits": LIMITS, "requests": [], "stopped": False}
            with self.path.open("x", encoding="utf-8") as f:
                json.dump(self.data, f)

    def allow(self, purpose):
        if self.data["stopped"]:
            raise AIUnavailable(
                "Live verification stopped after provider failure; manual workflows remain available."
            )
        if (
            purpose not in LIMITS
            or len(self.data["requests"]) >= 7
            or sum(r["purpose"] == purpose for r in self.data["requests"]) >= LIMITS[purpose]
        ):
            raise AIQuotaExceeded()

    def send(self, original, client, request, **kwargs):
        if request.url.host in ("localhost", "127.0.0.1", "testserver"):
            return original(client, request, **kwargs)
        purpose = PURPOSE.get()
        if (
            request.url.host != "generativelanguage.googleapis.com"
            or request.url.scheme != "https"
            or request.method != "POST"
        ):
            raise AIUnavailable("Unapproved outbound HTTP request blocked.")
        expected = ":embedContent" if purpose == "embedding" else ":generateContent"
        if not request.url.path.endswith(expected):
            raise AIUnavailable("Unapproved provider operation blocked.")
        with self.lock:
            self.allow(purpose)
            entry = {
                "number": len(self.data["requests"]) + 1,
                "purpose": purpose,
                "outcome": "transmission_attempt",
            }
            self.data["requests"].append(entry)
            save(self.path, self.data)  # Consume budget BEFORE the network transmission.
        try:
            response = original(client, request, **kwargs)
            with self.lock:
                entry.update(
                    http_status=response.status_code,
                    outcome="success" if response.is_success else "failed",
                )
                if not response.is_success:
                    entry["error_category"] = error_category(response)
                    self.data["stopped"] = True
                save(self.path, self.data)
            return response
        except Exception:
            with self.lock:
                entry["outcome"] = "transport_failed"
                self.data["stopped"] = True
                save(self.path, self.data)
            raise

    def guard(self):
        # Guard the SDK's per-transmission boundary, not a particular HTTP library.
        # google-genai 3.x may choose httpx2 instead of httpx.
        from google.genai._api_client import BaseApiClient

        original = BaseApiClient._request_once

        def guarded(client, sdk_request, stream=False):
            metadata = httpx.Request(sdk_request.method.upper(), sdk_request.url)
            output = None
            failure = None

            def transmit(_client, _request, **kwargs):
                nonlocal output, failure
                try:
                    output = original(client, sdk_request, stream)
                    return httpx.Response(200)
                except Exception as exc:
                    code = getattr(exc, "code", None)
                    if isinstance(code, int) and 400 <= code <= 599:
                        failure = exc
                        return httpx.Response(code, json=getattr(exc, "response_json", {}) or {})
                    raise

            self.send(transmit, client, metadata)
            if failure is not None:
                raise failure
            return output

        return patch.object(BaseApiClient, "_request_once", guarded)


class CountedProvider:
    def __init__(self, provider, ledger):
        self.provider, self.ledger = provider, ledger

    def invoke(self, kind, method, *args):
        with self.ledger.lock:
            self.ledger.allow(kind)
        token = PURPOSE.set(kind)
        try:
            return method(*args)
        except Exception:
            with self.ledger.lock:
                self.ledger.data["stopped"] = True
                save(self.ledger.path, self.ledger.data)
            raise
        finally:
            PURPOSE.reset(token)

    def structured(self, prompt, payload, schema):
        from app.modules.ai.schemas import (
            ActionTakenAIReview,
            DuplicateAssessmentResult,
            GrievanceAnalysisResult,
        )

        kind = {
            GrievanceAnalysisResult: "classification",
            DuplicateAssessmentResult: "duplicates",
            ActionTakenAIReview: "report",
        }[schema]
        return self.invoke(kind, self.provider.structured, prompt, payload, schema)

    def embed(self, content):
        return self.invoke("embedding", self.provider.embed, content)

    def close(self):
        self.provider.close()
