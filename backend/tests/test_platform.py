from app.core import rate_limit
from app.core.config import Settings, settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    decrypt_secret,
    encrypt_secret,
    hash_password,
    verify_password,
)


def test_password_hash_round_trip_and_salting():
    first, second = hash_password("s3cret-value"), hash_password("s3cret-value")
    assert first != second
    assert verify_password("s3cret-value", first)
    assert not verify_password("wrong", first)
    assert not verify_password("anything", "garbage")


def test_access_token_expiry_and_type():
    assert decode_access_token(create_access_token(7))["sub"] == "7"
    assert decode_access_token(create_access_token(7, expires_minutes=-1)) is None
    assert decode_access_token("not-a-token") is None


def test_secret_encryption_is_reversible_and_legacy_plaintext_passes():
    encrypted = encrypt_secret('{"token": "abc"}')
    assert encrypted.startswith("enc:v1:") and "abc" not in encrypted
    assert decrypt_secret(encrypted) == '{"token": "abc"}'
    assert decrypt_secret('{"legacy": true}') == '{"legacy": true}'
    assert encrypt_secret(encrypted) == encrypted


def test_production_config_validation(monkeypatch):
    prod = Settings()
    monkeypatch.setattr(prod, "APP_ENV", "production")
    monkeypatch.setattr(prod, "SECRET_KEY", "short")
    monkeypatch.setattr(prod, "DATABASE_URL", "sqlite:///./x.db")
    problems = " ".join(prod.validate())
    assert "SECRET_KEY" in problems and "PostgreSQL" in problems

    monkeypatch.setattr(prod, "SECRET_KEY", "x" * 40)
    monkeypatch.setattr(prod, "DATABASE_URL", "postgresql://u:p@db/app")
    assert prod.validate() == []


def test_security_headers_and_request_id(client):
    response = client.get("/api/health", headers={"X-Request-ID": "trace-123"})
    assert response.headers["x-request-id"] == "trace-123"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert "content-security-policy" in response.headers


def test_validation_errors_are_readable(client, admin_headers):
    response = client.post("/api/campaigns/create", headers=admin_headers, json={"campaign_name": ""})
    assert response.status_code == 422
    body = response.json()
    assert isinstance(body["detail"], str) and body["errors"]


def test_rate_limiter_blocks_and_reports_retry(client, monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_AUTH_PER_MINUTE", 3)
    rate_limit.rate_limiter.backend.reset()
    statuses = [
        client.post("/api/auth/login", json={"email": "a@b.co", "password": "x"}).status_code for _ in range(5)
    ]
    assert statuses[:3] == [401, 401, 401]
    blocked = client.post("/api/auth/login", json={"email": "a@b.co", "password": "x"})
    assert blocked.status_code == 429 and int(blocked.headers["retry-after"]) > 0
    rate_limit.rate_limiter.backend.reset()


def test_metrics_endpoint_exposes_prometheus_counters(client):
    client.get("/api/health")
    body = client.get("/metrics").text
    assert "leadgen_http_requests_total" in body
