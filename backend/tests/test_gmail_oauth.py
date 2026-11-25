from app.core.config import settings


def test_oauth_start_without_config_is_a_clear_503(client, admin_headers, monkeypatch):
    monkeypatch.setattr(settings, "GMAIL_CLIENT_ID", "")
    response = client.get("/api/gmail/oauth/start", headers=admin_headers)
    assert response.status_code == 503
    assert "GMAIL_CLIENT_ID" in response.json()["detail"]


def test_status_reports_redirect_uri_for_google_console(client, admin_headers, monkeypatch):
    monkeypatch.setattr(settings, "GMAIL_CLIENT_ID", "id")
    monkeypatch.setattr(settings, "GMAIL_CLIENT_SECRET", "secret")
    monkeypatch.setattr(settings, "GMAIL_REDIRECT_URI", "http://localhost:8000/api/gmail/oauth/callback")
    body = client.get("/api/gmail/status", headers=admin_headers).json()
    assert body["connected"] is False
    assert body["oauth_configured"] is True
    assert body["redirect_uri"].endswith("/api/gmail/oauth/callback")


def test_callback_reports_cancelled_sign_in(client):
    response = client.get("/api/gmail/oauth/callback", params={"error": "access_denied"}, follow_redirects=False)
    assert response.status_code == 303
    assert "gmail=error" in response.headers["location"]
    assert "cancelled" in response.headers["location"]


def test_callback_with_unknown_state_returns_error_not_crash(client):
    response = client.get("/api/gmail/oauth/callback", params={"code": "abc", "state": "forged"}, follow_redirects=False)
    assert response.status_code == 303
    assert "gmail=error" in response.headers["location"]
