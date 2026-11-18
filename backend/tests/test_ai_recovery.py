"""Offline-only provider-boundary and installed-SDK audit regressions."""

import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.integrations.live_budget import LIMITS, RecoveryBudget


def test_primary_charge_precedes_any_sdk_or_http_request(tmp_path):
    path = tmp_path / "recovery.json"
    budget = RecoveryBudget(path)
    try:
        with pytest.raises(RuntimeError), budget.scope("verify"), budget.attempt("classification"):
            assert len(json.loads(path.read_text())["requests"]) == 1
            raise RuntimeError("Private failure before SDK initialization")
        assert budget.data["requests"][0]["transmissions"] == 0
        assert budget.data["stopped"]
        with pytest.raises(HTTPException), budget.attempt("embedding"):
            pytest.fail("Stopped budget must not run")
        assert "Private" not in path.read_text()
    finally:
        budget.close()


def test_all_allocations_total_and_persistence(tmp_path):
    path = tmp_path / "recovery.json"
    budget = RecoveryBudget(path)
    try:
        for purpose, limit in LIMITS.items():
            for _ in range(limit):
                with budget.scope(purpose), budget.attempt("classification"):
                    budget.data["requests"][-1]["transmissions"] = 1
        assert len(budget.data["requests"]) == 10
        with pytest.raises(HTTPException), budget.scope("verify"), budget.attempt("classification"):
            pytest.fail("Exhausted")
    finally:
        budget.close()
    restarted = RecoveryBudget(path)
    try:
        with pytest.raises(HTTPException), restarted.attempt("embedding"):
            pytest.fail("Restart cannot reset budget")
    finally:
        restarted.close()


def test_concurrent_requests_cannot_exceed_allocation(tmp_path):
    budget = RecoveryBudget(tmp_path / "budget.json")

    def work(_):
        try:
            with budget.attempt("embedding"):
                budget.data["requests"][-1]["transmissions"] = 1
            return True
        except HTTPException:
            return False

    try:
        with ThreadPoolExecutor(max_workers=6) as pool:
            assert sum(pool.map(work, range(12))) == 3
        assert len(budget.data["requests"]) == 3
    finally:
        budget.close()


def test_sdk_blocks_unbudgeted_async_and_second_transmission(tmp_path, monkeypatch):
    from google.genai._api_client import BaseApiClient

    calls = []
    monkeypatch.setattr(BaseApiClient, "_request_once", lambda *a: calls.append(1))
    budget = RecoveryBudget(tmp_path / "budget.json")
    request = SimpleNamespace(
        method="post",
        url="https://generativelanguage.googleapis.com/v1beta/models/mock:embedContent",
    )
    try:
        with budget.guard():
            with pytest.raises(HTTPException):
                BaseApiClient._request_once(None, request)
            with pytest.raises(HTTPException):
                asyncio.run(BaseApiClient._async_request_once(None, request))
            with pytest.raises(HTTPException), budget.attempt("embedding"):
                BaseApiClient._request_once(None, request)
                BaseApiClient._request_once(None, request)
        assert calls == [1]
        assert len(budget.data["requests"]) == 1
        assert budget.data["stopped"]
    finally:
        budget.close()


def test_real_installed_langchain_pipeline_is_primary_counted(tmp_path, monkeypatch):
    from google.genai._api_client import BaseApiClient, HttpResponse

    from app.core.config import Settings
    from app.integrations.gemini import GeminiProvider
    from app.modules.ai.prompts import CLASSIFY
    from app.modules.ai.schemas import GrievanceAnalysisResult

    output = {
        "suggested_department_id": None,
        "suggested_category": "Other",
        "suggested_priority": "MEDIUM",
        "summary": "Fictional issue for offline test.",
        "department_reasoning": "Unknown",
        "priority_reasoning": "Unverified",
        "missing_information": [],
    }
    calls = []

    def offline(*args):
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

    monkeypatch.setattr(BaseApiClient, "_request_once", offline)
    budget = RecoveryBudget(tmp_path / "budget.json")
    provider = GeminiProvider(
        Settings(_env_file=None, gemini_api_key="offline-mocked-key", ai_max_retries=0),
        budget=budget,
    )
    monkeypatch.setattr(provider, "check_allowed", lambda: None)
    try:
        with budget.guard(), budget.scope("verify"):
            assert (
                provider.structured(CLASSIFY, "{}", GrievanceAnalysisResult).summary
                == output["summary"]
            )
            with pytest.raises(HTTPException):
                provider.structured(CLASSIFY, "{}", GrievanceAnalysisResult)
        assert calls == [1]
        assert budget.data["requests"][0]["transmissions"] == 1
    finally:
        provider.close()
        budget.close()


def test_installed_embedding_sdk_uses_single_input_batch_route(tmp_path, monkeypatch):
    from google.genai._api_client import BaseApiClient, HttpResponse

    from app.core.config import Settings
    from app.integrations.gemini import GeminiProvider

    calls = []

    def offline(client, request, stream=False):
        assert request.url.endswith(":batchEmbedContents")
        assert len(request.data["requests"]) == 1
        assert request.data["requests"][0]["outputDimensionality"] == 768
        calls.append(1)
        return HttpResponse({}, [json.dumps({"embeddings": [{"values": [1.0] * 768}]})])

    monkeypatch.setattr(BaseApiClient, "_request_once", offline)
    budget = RecoveryBudget(tmp_path / "budget.json")
    provider = GeminiProvider(
        Settings(_env_file=None, gemini_api_key="offline-only", ai_max_retries=0), budget=budget
    )
    monkeypatch.setattr(provider, "check_allowed", lambda: None)
    try:
        with budget.guard():
            assert len(provider.embed("Fictional road damage")) == 768
        assert calls == [1]
        assert budget.data["requests"][0]["outcome"] == "success"
    finally:
        provider.close()
        budget.close()


def test_reviewed_retry_keeps_attempts_and_sealed_budget_cannot_resume(tmp_path):
    budget = RecoveryBudget(tmp_path / "budget.json")
    try:
        budget.data["requests"] = [
            {"purpose": p, "operation": "classification", "transmissions": 1}
            for p in ("verify", "citizen", "cmo")
        ] + [{"purpose": "embedding", "operation": "embedding", "transmissions": 0}]
        budget.data["stopped"] = True
        budget.review_embedding_guard_fix()
        with pytest.raises(HTTPException), budget.attempt("embedding"):
            pytest.fail("Must consume reserved retry, not reset failed allocation")
        with budget.scope("targeted_retry"), budget.attempt("embedding"):
            budget.data["requests"][-1]["transmissions"] = 1
        assert len(budget.data["requests"]) == 5
        assert budget.data["requests"][-1]["purpose"] == "targeted_retry"
        budget.seal()
        with pytest.raises(HTTPException), budget.attempt("report"):
            pytest.fail("Completed authorization must not be reused")
        with pytest.raises(HTTPException):
            budget.review_embedding_guard_fix()
    finally:
        budget.close()


def test_normal_local_runtime_cannot_share_bounded_authorization():
    from scripts.ai_runtime import main

    with pytest.raises(SystemExit) as caught:
        main(["--local-ai", "--approved-live-requests", "10"])
    assert caught.value.code == 2


def test_classification_does_not_solicit_redacted_identity_data():
    from app.modules.ai.prompts import CLASSIFY

    instruction = CLASSIFY.invoke({"payload": "{}"}).messages[0].content
    assert "Never request names" in instruction
    assert "contact information" in instruction
    assert "exact GPS" in instruction
    assert "Do not infer missing contact details" in instruction
