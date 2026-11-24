"""Shared fixtures: an isolated SQLite database and an authenticated client.

Environment is configured before the app is imported because settings are read
at import time.
"""
import os
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="leadgen-tests-"))
os.environ.update({
    "APP_ENV": "test",
    "DATABASE_URL": f"sqlite:///{_TMP / 'test.db'}",
    "SECRET_KEY": "test-secret-key-0123456789abcdef0123456789",
    "AUTH_ENABLED": "true",
    "ALLOW_REGISTRATION": "false",
    "PASSWORD_HASH_ITERATIONS": "1000",
    "RATE_LIMIT_ENABLED": "false",
    "LOG_JSON": "false",
    "LOG_LEVEL": "WARNING",
    "PUBLIC_API_URL": "https://api.example.test",
    "GEMINI_API_KEY": "",
    "REDIS_URL": "",
    "ADMIN_EMAIL": "",
    "ADMIN_PASSWORD": "",
})

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402

ADMIN = {"email": "admin@example.test", "password": "correct-horse-battery", "full_name": "Ada Admin"}


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    with TestClient(app) as test_client:  # runs lifespan -> migrations
        yield test_client


@pytest.fixture()
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def admin_headers(client):
    response = client.post("/api/auth/register", json=ADMIN)
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture()
def campaign_id(client, admin_headers):
    response = client.post("/api/campaigns/create", headers=admin_headers, json={
        "campaign_name": "Dental clinics",
        "industry": "Healthcare",
        "location": "Pune",
        "target_role": "Owner",
        "offer": "Appointment reminders",
    })
    assert response.status_code == 200, response.text
    return response.json()["campaign_id"]
