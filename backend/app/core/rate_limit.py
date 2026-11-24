"""Fixed-window rate limiting with a Redis backend for multi-instance deployments.

Without REDIS_URL the limiter keeps counters in process memory, which is correct
for a single instance. With REDIS_URL every API replica shares the same counters.
"""
import logging
import threading
import time

from app.core.config import settings

logger = logging.getLogger(__name__)


class MemoryBackend:
    def __init__(self):
        self._lock = threading.Lock()
        self._counters: dict[str, tuple[int, float]] = {}

    def hit(self, key: str, window_seconds: int) -> int:
        now = time.monotonic()
        with self._lock:
            count, expires_at = self._counters.get(key, (0, now + window_seconds))
            if now >= expires_at:
                count, expires_at = 0, now + window_seconds
            count += 1
            self._counters[key] = (count, expires_at)
            if len(self._counters) > 50_000:
                self._counters = {k: v for k, v in self._counters.items() if v[1] > now}
            return count

    def reset(self):
        with self._lock:
            self._counters.clear()


class RedisBackend:
    def __init__(self, url: str):
        import redis

        self._client = redis.Redis.from_url(url, socket_timeout=0.5, socket_connect_timeout=0.5)

    def hit(self, key: str, window_seconds: int) -> int:
        pipeline = self._client.pipeline()
        pipeline.incr(key)
        pipeline.expire(key, window_seconds, nx=True)
        count, _ = pipeline.execute()
        return int(count)

    def reset(self):
        pass


class RateLimiter:
    def __init__(self):
        self.backend = MemoryBackend()
        if settings.REDIS_URL:
            try:
                self.backend = RedisBackend(settings.REDIS_URL)
            except Exception:  # noqa: BLE001 - fall back to memory if redis is missing
                logger.warning("Redis rate-limit backend unavailable; using in-memory counters.")

    def check(self, bucket: str, identity: str, limit: int, window_seconds: int = 60) -> tuple[bool, int, int]:
        """Return (allowed, remaining, retry_after_seconds)."""
        if not settings.RATE_LIMIT_ENABLED or limit <= 0:
            return True, limit, 0

        window = int(time.time() // window_seconds)
        key = f"rl:{bucket}:{identity}:{window}"
        try:
            count = self.backend.hit(key, window_seconds)
        except Exception:  # noqa: BLE001 - never fail requests because the limiter is down
            logger.warning("Rate limiter backend error; allowing request.", exc_info=True)
            return True, limit, 0

        retry_after = window_seconds - int(time.time() % window_seconds)
        return count <= limit, max(limit - count, 0), retry_after


rate_limiter = RateLimiter()

AI_PATH_MARKERS = (
    "/api/ai/",
    "/generate",
    "/research",
    "/score",
    "/classify",
    "/lead-agent/start",
    "/calls/start-vapi",
    "/knowledge/upload",
    "/embeddings/",
)
AUTH_PATHS = ("/api/auth/login", "/api/auth/register", "/api/public/unsubscribe")


def bucket_for(path: str, method: str) -> tuple[str, int]:
    if path.startswith(AUTH_PATHS):
        return "auth", settings.RATE_LIMIT_AUTH_PER_MINUTE
    if method != "GET" and any(marker in path for marker in AI_PATH_MARKERS):
        return "ai", settings.RATE_LIMIT_AI_PER_MINUTE
    return "default", settings.RATE_LIMIT_DEFAULT_PER_MINUTE
