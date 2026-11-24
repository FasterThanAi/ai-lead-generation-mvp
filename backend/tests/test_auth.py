from conftest import ADMIN


def test_api_rejects_requests_without_credentials(client):
    response = client.get("/api/campaigns/")
    assert response.status_code == 401
    body = response.json()
    assert body["status"] == "error"
    assert body["request_id"]


def test_health_and_auth_config_are_public(client):
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/health/live").json() == {"status": "ok"}
    ready = client.get("/api/health/ready")
    assert ready.status_code == 200 and ready.json()["checks"]["database"] == "ok"
    config = client.get("/api/auth/config").json()
    assert config == {"auth_enabled": True, "registration_open": True, "needs_setup": True}


def test_first_user_becomes_admin_and_registration_then_closes(client, admin_headers):
    me = client.get("/api/auth/me", headers=admin_headers).json()["user"]
    assert me["email"] == ADMIN["email"] and me["role"] == "admin"

    assert client.get("/api/auth/config").json()["registration_open"] is False
    second = client.post("/api/auth/register", json={"email": "x@example.test", "password": "another-long-pass"})
    assert second.status_code == 403


def test_login_success_and_generic_failure(client, admin_headers):
    ok = client.post("/api/auth/login", json={"email": ADMIN["email"].upper(), "password": ADMIN["password"]})
    assert ok.status_code == 200 and ok.json()["access_token"]

    wrong_password = client.post("/api/auth/login", json={"email": ADMIN["email"], "password": "nope"})
    unknown_user = client.post("/api/auth/login", json={"email": "ghost@example.test", "password": "nope"})
    assert wrong_password.status_code == unknown_user.status_code == 401
    assert wrong_password.json()["detail"] == unknown_user.json()["detail"]


def test_tampered_token_is_rejected(client, admin_headers):
    token = admin_headers["Authorization"][:-2] + "xx"
    assert client.get("/api/campaigns/", headers={"Authorization": token}).status_code == 401


def test_password_rules_and_change_password(client, admin_headers):
    weak = client.post("/api/auth/users", headers=admin_headers,
                       json={"email": "m@example.test", "password": "short"})
    assert weak.status_code == 422

    bad = client.post("/api/auth/change-password", headers=admin_headers,
                      json={"current_password": "wrong", "new_password": "a-brand-new-password"})
    assert bad.status_code == 400
    good = client.post("/api/auth/change-password", headers=admin_headers,
                       json={"current_password": ADMIN["password"], "new_password": "a-brand-new-password"})
    assert good.status_code == 200
    login = client.post("/api/auth/login", json={"email": ADMIN["email"], "password": "a-brand-new-password"})
    assert login.status_code == 200


def test_admin_manages_members_and_members_cannot_admin(client, admin_headers):
    created = client.post("/api/auth/users", headers=admin_headers, json={
        "email": "member@example.test", "password": "member-password-1", "role": "member"})
    assert created.status_code == 201
    member_id = created.json()["user"]["id"]

    token = client.post("/api/auth/login", json={"email": "member@example.test",
                                                 "password": "member-password-1"}).json()["access_token"]
    member_headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/campaigns/", headers=member_headers).status_code == 200
    assert client.get("/api/auth/users", headers=member_headers).status_code == 403
    assert client.get("/api/audit/", headers=member_headers).status_code == 403

    disabled = client.patch(f"/api/auth/users/{member_id}", headers=admin_headers, json={"is_active": False})
    assert disabled.status_code == 200
    assert client.get("/api/campaigns/", headers=member_headers).status_code == 401


def test_admin_cannot_lock_themselves_out(client, admin_headers):
    me = client.get("/api/auth/me", headers=admin_headers).json()["user"]
    response = client.patch(f"/api/auth/users/{me['id']}", headers=admin_headers, json={"role": "member"})
    assert response.status_code == 400


def test_api_key_lifecycle(client, admin_headers):
    created = client.post("/api/auth/api-keys", headers=admin_headers, json={"name": "n8n"})
    assert created.status_code == 201
    raw_key = created.json()["api_key"]
    key_id = created.json()["data"]["id"]
    assert raw_key.startswith("lg_")

    listed = client.get("/api/auth/api-keys", headers=admin_headers).json()["data"]
    assert listed[0]["prefix"] == raw_key[:10]
    assert "key_hash" not in listed[0]

    assert client.get("/api/campaigns/", headers={"X-API-Key": raw_key}).status_code == 200
    client.delete(f"/api/auth/api-keys/{key_id}", headers=admin_headers)
    assert client.get("/api/campaigns/", headers={"X-API-Key": raw_key}).status_code == 401


def test_audit_log_records_sign_in_activity(client, admin_headers):
    client.post("/api/auth/login", json={"email": ADMIN["email"], "password": "bad-password"})
    entries = client.get("/api/audit/", headers=admin_headers).json()["data"]
    actions = {entry["action"] for entry in entries}
    assert {"auth.register", "auth.login_failed"} <= actions


def test_webhook_and_oauth_callback_paths_skip_user_auth(client):
    # Vapi has no secret configured in tests, so the webhook is reachable (non-production only).
    response = client.post("/api/calls/vapi/webhook", content=b"not json",
                           headers={"Content-Type": "application/json"})
    assert response.status_code == 400
    callback = client.get("/api/gmail/oauth/callback")
    assert callback.status_code == 400  # missing code, but not 401
