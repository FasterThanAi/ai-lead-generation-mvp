"""ASGI middleware: request ids, access logs, metrics, rate limiting, security headers.

Written as plain ASGI (not BaseHTTPMiddleware) so streaming responses and
background tasks are never buffered or delayed by the middleware.
"""
import json
import logging
import time
import uuid

from app.core.config import settings
from app.core.logging import request_id_var
from app.core.metrics import IN_FLIGHT, RATE_LIMITED, REQUEST_COUNT, REQUEST_LATENCY
from app.core.rate_limit import bucket_for, rate_limiter
from app.core.security import decode_access_token

logger = logging.getLogger("app.access")

SKIP_LOG_PATHS = {"/api/health", "/api/health/live", "/metrics"}
DOCS_PATHS = ("/docs", "/redoc", "/openapi.json", "/api/gmail/oauth/callback", "/api/public/unsubscribe")


def _header(scope, name: bytes) -> str | None:
    for key, value in scope.get("headers") or []:
        if key == name:
            return value.decode("latin-1")
    return None


def _client_identity(scope) -> str:
    authorization = _header(scope, b"authorization") or ""
    if authorization.lower().startswith("bearer "):
        payload = decode_access_token(authorization[7:].strip())
        if payload:
            return f"user:{payload.get('sub')}"
    api_key = _header(scope, b"x-api-key")
    if api_key:
        return f"key:{api_key[:10]}"
    client = scope.get("client")
    return f"ip:{client[0] if client else 'unknown'}"


def _security_headers(path: str) -> list[tuple[bytes, bytes]]:
    headers = [
        (b"x-content-type-options", b"nosniff"),
        (b"x-frame-options", b"DENY"),
        (b"referrer-policy", b"strict-origin-when-cross-origin"),
        (b"permissions-policy", b"camera=(), microphone=(), geolocation=()"),
        (b"cross-origin-opener-policy", b"same-origin"),
    ]
    if not path.startswith(DOCS_PATHS):
        headers.append((b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'"))
    if settings.is_production:
        headers.append((b"strict-transport-security", b"max-age=63072000; includeSubDomains"))
    return headers


class RequestContextMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming_id = _header(scope, b"x-request-id")
        request_id = incoming_id[:64] if incoming_id else uuid.uuid4().hex
        token = request_id_var.set(request_id)
        path = scope.get("path", "")
        method = scope.get("method", "GET")
        started = time.perf_counter()
        status_holder = {"status": 500}

        if method != "OPTIONS" and path.startswith("/api/"):
            bucket, limit = bucket_for(path, method)
            allowed, remaining, retry_after = rate_limiter.check(bucket, _client_identity(scope), limit)
            if not allowed:
                RATE_LIMITED.labels(bucket).inc()
                body = json.dumps({
                    "status": "error",
                    "detail": "Too many requests. Please slow down and try again shortly.",
                    "request_id": request_id,
                }).encode()
                await send({
                    "type": "http.response.start",
                    "status": 429,
                    "headers": [
                        (b"content-type", b"application/json"),
                        (b"retry-after", str(retry_after).encode()),
                        (b"x-request-id", request_id.encode()),
                        *_security_headers(path),
                    ],
                })
                await send({"type": "http.response.body", "body": body})
                self._observe(scope, method, path, 429, started)
                request_id_var.reset(token)
                return

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
                headers = list(message.get("headers") or [])
                existing = {key.lower() for key, _ in headers}
                headers.append((b"x-request-id", request_id.encode()))
                for key, value in _security_headers(path):
                    if key not in existing:
                        headers.append((key, value))
                message["headers"] = headers
            await send(message)

        IN_FLIGHT.inc()
        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            IN_FLIGHT.dec()
            self._observe(scope, method, path, status_holder["status"], started)
            request_id_var.reset(token)

    @staticmethod
    def _observe(scope, method, path, status, started):
        elapsed = time.perf_counter() - started
        route = scope.get("route")
        route_label = getattr(route, "path", None) or ("unmatched" if status == 404 else path.split("?")[0][:80])
        REQUEST_COUNT.labels(method, route_label, str(status)).inc()
        REQUEST_LATENCY.labels(method, route_label).observe(elapsed)
        if path not in SKIP_LOG_PATHS:
            logger.info(
                "%s %s -> %s in %.1fms",
                method,
                path,
                status,
                elapsed * 1000,
                extra={"http_method": method, "path": path, "status": status, "duration_ms": round(elapsed * 1000, 1)},
            )
