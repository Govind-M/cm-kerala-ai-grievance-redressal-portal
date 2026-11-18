"""No hosted writes or provider calls: deterministic runtime/privacy/smoke contracts."""

import json
from concurrent.futures import ThreadPoolExecutor
from secrets import token_hex
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.core.config import Settings
from app.integrations.gemini import raise_provider_failure
from app.modules.ai.content import source_content
from app.modules.ai.privacy import minimize
from app.modules.ai.schemas import GrievanceAnalysisResult
from app.modules.ai.service import complaint
from scripts import ai_live_smoke, ai_runtime


def test_layering_preserves_base_auth_database_and_relative_ca(tmp_path, monkeypatch):
    monkeypatch.setattr(ai_runtime, "BACKEND_DIR", tmp_path / "integrated")
    (tmp_path / "integrated").mkdir()
    base = tmp_path / "base.env"
    jwt = token_hex(48)
    base.write_text(
        f"JWT_SECRET_KEY={jwt}\nSUPABASE_SSLROOTCERT=certs/ca.pem\nAI_ENABLED=false\n",
        encoding="utf-8",
    )
    (tmp_path / "integrated" / ".env").write_text(
        "JWT_SECRET_KEY=\nGEMINI_API_KEY=synthetic-no-network\nAI_ENABLED=false\nAI_LIVE_REQUESTS_ENABLED=false\n",
        encoding="utf-8",
    )
    for key in (
        "JWT_SECRET_KEY",
        "GEMINI_API_KEY",
        "AI_ENABLED",
        "AI_LIVE_REQUESTS_ENABLED",
        "SUPABASE_SSLROOTCERT",
    ):
        monkeypatch.delenv(key, raising=False)
    settings = ai_runtime.load_settings(base)
    assert settings.jwt_secret_key.get_secret_value() == jwt
    assert settings.gemini_api_key.get_secret_value() == "synthetic-no-network"
    assert settings.supabase_sslrootcert == tmp_path / "certs" / "ca.pem"
    assert not settings.ai_enabled and not settings.ai_live_requests_enabled
    monkeypatch.setenv("GEMINI_CHAT_MODEL", "test-process-override")
    assert ai_runtime.load_settings(base).gemini_chat_model == "test-process-override"


def test_process_budget_serializes_concurrent_requests():
    calls = []
    provider = ai_runtime.BoundedProvider(SimpleNamespace(embed=lambda text: calls.append(text)), 2)

    def attempt(i):
        try:
            provider.embed(str(i))
            return True
        except HTTPException as error:
            assert error.status_code == 429
            return False

    with ThreadPoolExecutor(max_workers=8) as pool:
        assert sum(pool.map(attempt, range(10))) == 2
    assert len(calls) == provider.attempts["embedding"] == 2


@pytest.mark.parametrize(
    "private",
    [
        "fictional@example.com",
        "+91 90000 00000",
        "9000000000",
        "1234 5678 9012",
        "eyJsynthetic.eyJsynthetic.signature",
        "AIza" + "x" * 30,
        "https://example.test/evidence?token=private",
    ],
)
def test_provider_payload_minimizes_contacts_and_credentials(private):
    row = SimpleNamespace(
        subject="Fictional road issue",
        description=f"Reported road damage. {private}",
        district="Ernakulam",
        category="Other",
    )
    assert private not in json.dumps(complaint(row))
    assert private not in source_content(row)
    assert row.description.endswith(private)  # Official data is never rewritten.
    assert "2026-11-18" in minimize("Reported on 2026-11-18 near the bridge.")


@pytest.mark.parametrize("fail_first", [True, False])
def test_smoke_fail_fast_and_budget_with_mock_provider(monkeypatch, capsys, fail_first):
    calls = []

    class FakeProvider:
        def __init__(self, settings):
            assert settings.ai_max_retries == 0

        def check_allowed(self):
            pass

        def structured(self, prompt, payload, schema):
            calls.append("chat")
            if fail_first:
                raise RuntimeError("private-provider-detail")
            return GrievanceAnalysisResult(
                suggested_department_id=None,
                suggested_category="Roads and Infrastructure",
                suggested_priority="MEDIUM",
                summary="A fictional road issue is reported.",
                department_reasoning="Road maintenance is reported.",
                priority_reasoning="The risk remains unverified.",
            )

        def embed(self, text):
            calls.append("embedding")
            return [1.0] + [0.0] * 767

        def close(self):
            calls.append("close")

    monkeypatch.setattr(ai_live_smoke, "GeminiProvider", FakeProvider)
    monkeypatch.setattr(
        ai_runtime, "load_settings", lambda *a, **k: Settings(_env_file=None, ai_max_retries=0)
    )
    assert ai_live_smoke.main(["--approved-live-requests"]) == (1 if fail_first else 0)
    output = capsys.readouterr().out
    assert "private-provider-detail" not in output
    assert calls == (["chat", "close"] if fail_first else ["chat", "embedding", "close"])


def test_installed_chat_sdk_prepares_one_attempt_without_network():
    from google.genai._api_client import retry_args
    from langchain_core.messages import HumanMessage
    from langchain_google_genai import ChatGoogleGenerativeAI

    chat = ChatGoogleGenerativeAI(
        model="gemini-3.5-flash-lite",
        google_api_key=token_hex(32),
        vertexai=False,
        max_retries=0,
        timeout=30,
    )
    try:
        request = chat._prepare_request([HumanMessage(content="synthetic")])
        options = request["config"].http_options
        assert options.timeout == 30000
        policy = retry_args(options.retry_options)
        assert policy["stop"].max_attempt_number == 1
    finally:
        chat.client.close()


@pytest.mark.parametrize("code,expected", [(429, 429), (504, 504), (401, 503)])
def test_wrapped_provider_status_is_sanitized(code, expected):
    inner = RuntimeError("PRIVATE_PROVIDER_DETAIL")
    inner.code = code
    outer = RuntimeError("PRIVATE_KEY_AND_URL")
    outer.__cause__ = inner
    with pytest.raises(HTTPException) as caught:
        raise_provider_failure(outer)
    assert caught.value.status_code == expected
    assert "PRIVATE" not in caught.value.detail


def test_dedicated_runtime_stops_after_first_failure():
    from unittest.mock import Mock

    fake = SimpleNamespace(embed=Mock(side_effect=RuntimeError("private")))
    provider = ai_runtime.BoundedProvider(fake, 2)
    with pytest.raises(RuntimeError):
        provider.embed("synthetic")
    with pytest.raises(HTTPException) as caught:
        provider.embed("synthetic")
    assert caught.value.status_code == 503
    assert fake.embed.call_count == 1


def test_embedding_dimension_environment_string(monkeypatch):
    monkeypatch.setenv("AI_EMBEDDING_DIMENSIONS", "768")
    assert Settings(_env_file=None).ai_embedding_dimensions == 768
