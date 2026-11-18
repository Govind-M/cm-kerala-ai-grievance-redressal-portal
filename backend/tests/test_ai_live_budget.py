"""All transports mocked. Approval flags must never cause paid requests in pytest."""

import json

import httpx
import pytest
from fastapi import HTTPException

from scripts.ai_live_budget import LIMITS, PURPOSE, LiveLedger


def call(ledger, kind, status=200):
    token = PURPOSE.set(kind)
    suffix = "embedContent" if kind == "embedding" else "generateContent"
    request = httpx.Request(
        "POST",
        "https://generativelanguage.googleapis.com/v1beta/models/synthetic:" + suffix,
        headers={"x-goog-api-key": "PRIVATE_KEY_MARKER"},
    )
    try:
        return ledger.send(
            lambda *a, **kw: httpx.Response(
                status, json={"error": {"message": "PRIVATE_PROVIDER_MARKER"}}, request=request
            ),
            object(),
            request,
        )
    finally:
        PURPOSE.reset(token)


def test_total_and_per_kind_limits_survive_restart(tmp_path):
    path = tmp_path / "ledger.json"
    ledger = LiveLedger(path)
    for kind, count in LIMITS.items():
        for _ in range(count):
            assert call(ledger, kind).status_code == 200
    assert len(ledger.data["requests"]) == 7
    with pytest.raises(HTTPException) as error:
        call(LiveLedger(path), "classification")
    assert error.value.status_code == 429
    assert "PRIVATE" not in path.read_text(encoding="utf-8")


def test_quota_stops_all_further_requests(tmp_path):
    ledger = LiveLedger(tmp_path / "ledger.json")
    assert call(ledger, "classification", 429).status_code == 429
    assert ledger.data["requests"][0]["error_category"] == "QUOTA_EXHAUSTED"
    with pytest.raises(HTTPException) as error:
        call(ledger, "embedding")
    assert error.value.status_code == 503
    assert len(ledger.data["requests"]) == 1


def test_storage_and_unclassified_requests_are_blocked(tmp_path):
    ledger = LiveLedger(tmp_path / "ledger.json")
    request = httpx.Request("POST", "https://example.supabase.co/storage/v1/upload")
    with pytest.raises(HTTPException):
        ledger.send(lambda *a, **k: pytest.fail("Transport must not run"), None, request)
    with pytest.raises(HTTPException):
        call(ledger, None)
    assert ledger.data["requests"] == []


def test_journal_is_written_before_transport(tmp_path):
    path = tmp_path / "ledger.json"
    ledger = LiveLedger(path)
    request = httpx.Request(
        "POST", "https://generativelanguage.googleapis.com/v1beta/models/synthetic:embedContent"
    )

    def transport(*a, **k):
        assert len(json.loads(path.read_text(encoding="utf-8"))["requests"]) == 1
        raise httpx.ConnectError("PRIVATE_DETAIL", request=request)

    token = PURPOSE.set("embedding")
    try:
        with pytest.raises(httpx.ConnectError):
            ledger.send(transport, None, request)
    finally:
        PURPOSE.reset(token)
    assert ledger.data["stopped"]
    assert "PRIVATE" not in path.read_text(encoding="utf-8")


def test_installed_sdk_pipeline_is_counted_above_httpx2(tmp_path, monkeypatch):
    from google.genai._api_client import BaseApiClient, HttpResponse

    from app.core.config import Settings
    from app.integrations.gemini import GeminiProvider
    from app.modules.ai.prompts import CLASSIFY
    from app.modules.ai.schemas import GrievanceAnalysisResult
    from scripts.ai_live_budget import CountedProvider

    output = {
        "suggested_department_id": None,
        "suggested_category": "Other",
        "suggested_priority": "MEDIUM",
        "summary": "A fictional issue is reported.",
        "department_reasoning": "No department is established.",
        "priority_reasoning": "Reported impact remains unverified.",
        "missing_information": [],
    }
    calls = []

    def offline_sdk_response(self, request, stream=False):
        calls.append(1)
        return HttpResponse(
            {},
            [
                json.dumps(
                    {
                        "candidates": [
                            {
                                "content": {
                                    "role": "model",
                                    "parts": [{"text": json.dumps(output)}],
                                },
                                "finishReason": "STOP",
                            }
                        ]
                    }
                )
            ],
        )

    monkeypatch.setattr(BaseApiClient, "_request_once", offline_sdk_response)
    provider = GeminiProvider(
        Settings(_env_file=None, gemini_api_key="synthetic-not-a-real-key", ai_max_retries=0)
    )
    monkeypatch.setattr(provider, "check_allowed", lambda: None)
    ledger = LiveLedger(tmp_path / "ledger.json")
    wrapped = CountedProvider(provider, ledger)
    try:
        with ledger.guard():
            assert (
                wrapped.structured(CLASSIFY, "{}", GrievanceAnalysisResult).summary
                == output["summary"]
            )
            assert (
                wrapped.structured(CLASSIFY, "{}", GrievanceAnalysisResult).summary
                == output["summary"]
            )
            with pytest.raises(HTTPException) as caught:
                wrapped.structured(CLASSIFY, "{}", GrievanceAnalysisResult)
            assert caught.value.status_code == 429
        assert len(calls) == len(ledger.data["requests"]) == 2
    finally:
        provider.close()


def test_direct_sdk_is_blocked_without_transport_assumptions():
    from google import genai

    client = genai.Client(api_key="synthetic-not-a-real-key", vertexai=False)
    try:
        with pytest.raises(AssertionError, match="forbidden during pytest"):
            client.models.embed_content(model="gemini-embedding-001", contents="synthetic")
    finally:
        client.close()


def test_httpx2_timeout_is_sanitized():
    import httpx2

    from app.integrations.gemini import raise_provider_failure

    with pytest.raises(HTTPException) as caught:
        raise_provider_failure(httpx2.ReadTimeout("PRIVATE_DETAIL"))
    assert caught.value.status_code == 504
    assert "PRIVATE" not in caught.value.detail
