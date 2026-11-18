"""Bounded worker-local abuse controls. Production needs gateway/distributed enforcement."""

import hashlib
from collections import OrderedDict
from threading import Lock
from time import monotonic

from starlette.responses import JSONResponse


class WindowLimiter:
    def __init__(self, capacity=10000):
        self.entries = OrderedDict()
        self.capacity = capacity
        self.lock = Lock()

    def allow(self, key, limit, seconds=3600):
        now = monotonic()
        with self.lock:
            count, start = self.entries.pop(key, (0, now))
            if now - start >= seconds:
                count, start = 0, now
            self.entries[key] = (count + 1, start)
            while len(self.entries) > self.capacity:
                self.entries.popitem(last=False)
            return count < limit


class SupportingRequestLimits:
    def __init__(self, app, settings):
        self.app = app
        self.settings = settings
        self.limiter = WindowLimiter()

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path = scope["path"]
        contact = path == self.settings.api_prefix + "/contact/enquiries"
        upload = path.startswith(self.settings.api_prefix + "/grievances/") and path.endswith(
            "/attachments"
        )
        if scope["method"] not in {"POST", "PUT", "PATCH"}:
            return await self.app(scope, receive, send)
        supporting = (
            contact
            or upload
            or any(
                path.startswith(self.settings.api_prefix + p)
                for p in (
                    "/cmo/faqs",
                    "/cmo/public-content/",
                    "/cmo/contact-enquiries",
                )
            )
            or (
                path.startswith(self.settings.api_prefix + "/grievances/")
                and path.endswith("/feedback")
            )
        )
        if not supporting:
            return await self.app(scope, receive, send)
        limit = self.settings.attachment_max_size_mb * 1024 * 1024 + 65536 if upload else 65536
        if contact:
            limit = 16384
        if contact or upload:
            # Do not trust user-supplied forwarding headers. Configure trusted proxies at deployment.
            host = (scope.get("client") or ("unknown",))[0]
            key = hashlib.sha256(f"{contact}|{host}".encode()).digest()
            if not self.limiter.allow(
                key, self.settings.contact_requests_per_hour if contact else 30
            ):
                return await JSONResponse(
                    {"detail": "Request limit reached. Please try later."},
                    429,
                    headers={"Retry-After": "3600", "Cache-Control": "no-store"},
                )(scope, receive, send)
        headers = dict(scope.get("headers", []))
        try:
            declared = int(headers.get(b"content-length", b"0"))
        except ValueError:
            return await JSONResponse({"detail": "Invalid Content-Length."}, 400)(
                scope, receive, send
            )
        chunks, size = [], 0
        if declared > limit or declared < 0:
            return await JSONResponse({"detail": "Request payload too large."}, 413)(
                scope, receive, send
            )
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            size += len(chunk)
            if size > limit:
                return await JSONResponse({"detail": "Request payload too large."}, 413)(
                    scope, receive, send
                )
            chunks.append(chunk)
            if not message.get("more_body", False):
                break
        delivered = False

        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": b"".join(chunks), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)
