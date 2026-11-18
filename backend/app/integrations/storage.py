"""Private Supabase Storage REST adapter. No eager credentials, retries or provisioning."""

import logging
import re
from urllib.parse import quote, urlsplit

import httpx
from fastapi import HTTPException, Request

from app.core.config import Settings

MIME_TYPES = ("application/pdf", "image/jpeg", "image/png", "image/webp")
logger = logging.getLogger("app.storage")


class StorageError(RuntimeError):
    pass


class SupabaseStorage:
    def __init__(self, settings: Settings, *, transport=None):
        self.settings = settings
        self.transport = transport

    def _configuration(self):
        endpoint = self.settings.supabase_url or ""
        parsed = urlsplit(endpoint)
        if (
            parsed.scheme != "https"
            or not re.fullmatch(r"[a-z0-9-]+\.supabase\.co", parsed.netloc)
            or parsed.path not in ("", "/")
            or parsed.query
            or parsed.fragment
        ):
            raise StorageError("Storage endpoint is not configured")
        secret = self.settings.supabase_storage_secret_key
        if not secret or not secret.get_secret_value():
            raise StorageError("Storage credentials are not configured")
        key = secret.get_secret_value()
        headers = {"apikey": key}
        # New sb_secret keys are API keys, not JWTs. Legacy service-role JWTs need Bearer too.
        if not key.startswith("sb_secret_"):
            headers["Authorization"] = f"Bearer {key}"
        return endpoint.rstrip("/") + "/storage/v1", headers

    def _request(self, method, path, *, allow_missing=False, **kwargs):
        base, headers = self._configuration()
        try:
            with httpx.Client(
                timeout=15, follow_redirects=False, transport=self.transport, trust_env=False
            ) as client:
                response = client.request(method, base + path, headers=headers, **kwargs)
            if allow_missing and response.status_code == 404:
                return None
            if not response.is_success:
                raise StorageError("Storage operation unavailable")
            return response
        except httpx.HTTPError:
            raise StorageError("Storage operation unavailable") from None

    def bucket(self, bucket=None):
        name = bucket or self.settings.supabase_storage_bucket
        response = self._request("GET", "/bucket/" + quote(name, safe=""), allow_missing=True)
        if response is None:
            return None
        try:
            data = response.json()
            if data.get("public") is not False or data.get("id") != name:
                raise StorageError("A matching private bucket is required")
            return data
        except (ValueError, AttributeError):
            raise StorageError("Invalid bucket response") from None

    def provision(self):
        if self.bucket() is None:
            self._request(
                "POST",
                "/bucket",
                json={
                    "id": self.settings.supabase_storage_bucket,
                    "name": self.settings.supabase_storage_bucket,
                    "public": False,
                    "file_size_limit": self.settings.attachment_max_size_mb * 1024 * 1024,
                    "allowed_mime_types": list(MIME_TYPES),
                },
            )
        if self.bucket() is None:
            raise StorageError("Private bucket provisioning failed")

    def upload(self, bucket, key, content, mime):
        if self.bucket(bucket) is None:
            raise StorageError("Private bucket has not been provisioned")
        # Content headers belong on the request, without allowing caller credential overrides.
        self._upload(bucket, key, content, mime)

    def _upload(self, bucket, key, content, mime):
        base, headers = self._configuration()
        headers.update({"Content-Type": mime, "x-upsert": "false", "Cache-Control": "no-store"})
        try:
            with httpx.Client(
                timeout=15, follow_redirects=False, transport=self.transport, trust_env=False
            ) as client:
                response = client.post(
                    f"{base}/object/{quote(bucket, safe='')}/{quote(key, safe='/')}",
                    headers=headers,
                    content=content,
                )
            if not response.is_success:
                raise StorageError("Storage upload unavailable")
        except httpx.HTTPError:
            raise StorageError("Storage upload unavailable") from None

    def remove(self, bucket, key):
        self._request("DELETE", "/object/" + quote(bucket, safe=""), json={"prefixes": [key]})

    def sign(self, bucket, key, filename):
        if self.bucket(bucket) is None:
            raise StorageError("Private bucket has not been provisioned")
        response = self._request(
            "POST",
            f"/object/sign/{quote(bucket, safe='')}/{quote(key, safe='/')}",
            json={"expiresIn": self.settings.attachment_signed_url_seconds},
        )
        try:
            path = response.json()["signedURL"]
            # Never accept a provider-controlled redirect to another host.
            if not isinstance(path, str) or not path.startswith("/object/sign/"):
                raise StorageError("Invalid signed download response")
            base, _ = self._configuration()
            return base + path + "&download=" + quote(filename, safe="")
        except (KeyError, ValueError, TypeError):
            raise StorageError("Invalid signed download response") from None


def get_storage(request: Request):
    return SupabaseStorage(request.app.state.settings)


def unavailable():
    return HTTPException(503, "Private attachment storage is unavailable.")
