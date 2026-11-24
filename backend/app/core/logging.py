"""Structured logging with per-request correlation ids."""
import json
import logging
import sys
from contextvars import ContextVar

from app.core.config import settings

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get() or "-"
        return True


class JsonFormatter(logging.Formatter):
    RESERVED = set(vars(logging.makeLogRecord({})).keys()) | {"request_id", "message"}

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
        }
        for key, value in record.__dict__.items():
            if key not in self.RESERVED and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RequestIdFilter())
    if settings.LOG_JSON:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)-7s [%(request_id)s] %(name)s: %(message)s"))

    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(settings.LOG_LEVEL)
    # uvicorn's own access log duplicates ours; keep its error log.
    logging.getLogger("uvicorn.access").disabled = True
