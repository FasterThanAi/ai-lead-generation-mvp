"""Prometheus metrics. Exposed at /metrics (optionally protected by METRICS_TOKEN)."""
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest

REQUEST_COUNT = Counter(
    "leadgen_http_requests_total", "HTTP requests", ["method", "route", "status"]
)
REQUEST_LATENCY = Histogram(
    "leadgen_http_request_duration_seconds",
    "HTTP request latency",
    ["method", "route"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30),
)
IN_FLIGHT = Gauge("leadgen_http_requests_in_flight", "Requests currently being served")
RATE_LIMITED = Counter("leadgen_rate_limited_total", "Requests rejected by the rate limiter", ["bucket"])
EMAILS_SENT = Counter("leadgen_emails_sent_total", "Emails sent through Gmail", ["result"])
BACKGROUND_JOBS = Counter("leadgen_background_jobs_total", "Background jobs", ["kind", "result"])


def render_metrics() -> tuple[bytes, str]:
    return generate_latest(), CONTENT_TYPE_LATEST
