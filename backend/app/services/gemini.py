"""Single entry point for Gemini text generation.

Gemini regularly answers 429 (rate limited) or 503 (model overloaded) for a
few seconds at a time. Every feature used to swallow that error and silently
fall back to a canned template. All calls now go through `gemini_generate`,
which retries transient failures with backoff, logs what happened, and
records a metric, so a degraded answer is the exception rather than the norm.
"""
import logging
import time

from google.genai import errors

from app.core.metrics import GEMINI_CALLS

logger = logging.getLogger(__name__)

TRANSIENT_STATUS_CODES = {408, 429, 500, 502, 503, 504}
DEFAULT_ATTEMPTS = 3
BASE_DELAY_SECONDS = 1.5


def is_transient(exc: Exception) -> bool:
    code = getattr(exc, "code", None)
    return isinstance(exc, errors.ServerError) or code in TRANSIENT_STATUS_CODES


def gemini_generate(client, *, attempts: int = DEFAULT_ATTEMPTS, sleep=time.sleep, **kwargs):
    """`client.models.generate_content(**kwargs)` with retries on transient errors."""
    model = kwargs.get("model", "?")
    for attempt in range(1, attempts + 1):
        try:
            response = client.models.generate_content(**kwargs)
            GEMINI_CALLS.labels("ok" if attempt == 1 else "ok_after_retry").inc()
            return response
        except Exception as exc:
            if not is_transient(exc) or attempt == attempts:
                GEMINI_CALLS.labels("error").inc()
                logger.warning(
                    "Gemini %s call failed after %s attempt(s): %s",
                    model,
                    attempt,
                    f"{type(exc).__name__}: {str(exc)[:200]}",
                )
                raise
            delay = BASE_DELAY_SECONDS * (2 ** (attempt - 1))
            logger.info("Gemini %s transient error (%s); retry %s/%s in %.1fs",
                        model, getattr(exc, "code", type(exc).__name__), attempt, attempts - 1, delay)
            sleep(delay)
    return None  # unreachable; keeps type checkers calm
