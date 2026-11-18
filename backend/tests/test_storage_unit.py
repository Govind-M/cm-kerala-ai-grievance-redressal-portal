from unittest.mock import Mock

import httpx
import pytest
from fastapi import HTTPException
from pydantic import SecretStr

from app.core.config import Settings
from app.core.request_limits import WindowLimiter
from app.integrations.storage import StorageError, SupabaseStorage
from app.modules.attachments.service import validate_file


def settings(**changes):
    return Settings(
        _env_file=None,
        supabase_url="https://fictional.supabase.co",
        supabase_storage_secret_key="sb_secret_TEST_ONLY",
        **changes,
    )


def adapter(handler, **changes):
    return SupabaseStorage(settings(**changes), transport=httpx.MockTransport(handler))


def test_new_secret_header_upload_and_short_lived_signing():
    requests = []

    def handler(request):
        requests.append(request)
        assert request.headers["apikey"] == "sb_secret_TEST_ONLY"
        assert "authorization" not in request.headers
        if "/bucket/" in request.url.path:
            return httpx.Response(200, json={"id": "grievance-attachments", "public": False})
        if "/object/sign/" in request.url.path:
            assert request.read() == b'{"expiresIn":60}'
            return httpx.Response(
                200, json={"signedURL": "/object/sign/grievance-attachments/key?token=TEST"}
            )
        if request.method == "POST":
            assert request.headers["x-upsert"] == "false"
            assert request.headers["content-type"] == "application/pdf"
        return httpx.Response(200, json={})

    storage = adapter(handler)
    storage.upload("grievance-attachments", "grievances/id/uuid", b"test", "application/pdf")
    url = storage.sign("grievance-attachments", "grievances/id/uuid", "a b.pdf")
    assert url.endswith("&download=a%20b.pdf")
    assert "sb_secret" not in url
    storage.remove("grievance-attachments", "grievances/id/uuid")
    assert len(requests) == 5


def test_legacy_bearer_credentials_supported():
    config = settings()
    config.supabase_storage_secret_key = SecretStr("legacy.test.jwt")
    storage = SupabaseStorage(config)
    _, headers = storage._configuration()
    assert headers["Authorization"] == "Bearer legacy.test.jwt"


@pytest.mark.parametrize(
    "endpoint",
    [
        "http://fictional.supabase.co",
        "https://evil.example",
        "https://fictional.supabase.co/redirect",
        "https://fictional.supabase.co?key=bad",
        "https://user:password@fictional.supabase.co",
        "https://fictional.supabase.co.evil.example",
    ],
)
def test_storage_rejects_unsafe_endpoint(endpoint):
    config = settings()
    config.supabase_url = endpoint
    with pytest.raises(StorageError):
        SupabaseStorage(config).bucket()


def test_storage_missing_credentials_lazy_no_network():
    storage = SupabaseStorage(Settings(_env_file=None))
    with pytest.raises(StorageError):
        storage.bucket()


@pytest.mark.parametrize("status", [401, 403, 429, 500, 302])
def test_storage_errors_sanitized_without_retries(status):
    handler = Mock(return_value=httpx.Response(status, text="private backend secret"))
    storage = adapter(handler)
    with pytest.raises(StorageError, match="Storage operation unavailable") as exc:
        storage.bucket()
    assert "private" not in str(exc.value)
    assert handler.call_count == 1


def test_private_bucket_idempotent_provisioning_and_public_refusal():
    objects = {}
    calls = []

    def handler(request):
        calls.append(request.method)
        if request.method == "POST":
            objects["bucket"] = {"id": "grievance-attachments", "public": False}
            return httpx.Response(200, json=objects["bucket"])
        return httpx.Response(200, json=objects["bucket"]) if objects else httpx.Response(404)

    storage = adapter(handler)
    storage.provision()
    storage.provision()
    assert calls.count("POST") == 1
    objects["bucket"]["public"] = True
    with pytest.raises(StorageError, match="private bucket"):
        storage.provision()
    assert calls.count("POST") == 1


def test_signed_url_rejects_cross_origin():
    def handler(request):
        if "/bucket/" in request.url.path:
            return httpx.Response(200, json={"id": "grievance-attachments", "public": False})
        return httpx.Response(200, json={"signedURL": "https://evil.example/token"})

    with pytest.raises(StorageError):
        adapter(handler).sign("grievance-attachments", "key", "evidence.pdf")


@pytest.mark.parametrize(
    "filename,mime,content",
    [
        ("test.pdf", "application/pdf", b"%PDF-1.4\n%%EOF"),
        ("test.jpg", "image/jpeg", b"\xff\xd8\xff\xe0test\xff\xd9"),
        ("test.png", "image/png", b"\x89PNG\r\n\x1a\ntestIEND\x00\x00\x00\x00"),
        ("test.webp", "image/webp", b"RIFF" + (8).to_bytes(4, "little") + b"WEBPVP8 "),
    ],
)
def test_supported_file_signatures(filename, mime, content):
    assert validate_file(filename, mime, content, 1000) == (filename, mime)


@pytest.mark.parametrize("filename", ["file.pdf\r\nHeader", "bad\x00.pdf", "", "bad.pdf\x7f"])
def test_filename_injection_rejected(filename):
    with pytest.raises(HTTPException):
        validate_file(filename, "application/pdf", b"%PDF-1.4\n%%EOF", 1000)


def test_limiter_bounded_and_expiry(monkeypatch):
    limiter = WindowLimiter(capacity=2)
    now = [0]
    monkeypatch.setattr("app.core.request_limits.monotonic", lambda: now[0])
    assert limiter.allow("a", 1)
    assert not limiter.allow("a", 1)
    now[0] = 3601
    assert limiter.allow("a", 1)
    limiter.allow("b", 1)
    limiter.allow("c", 1)
    assert len(limiter.entries) == 2
