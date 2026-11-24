import base64
import email
from datetime import timedelta
from types import SimpleNamespace

from app.api.routes import gmail as gmail_routes
from app.db.models import EmailDraft, EmailExtractionJob, Lead
from app.services import gmail_service
from app.services.startup_service import recover_stale_work
from app.services.suppression_service import unsubscribe_token
from app.utils.send_guard import claim_for_sending
from app.utils.time_utils import utc_now


def _draft(db, campaign_id, status="approved", to="owner@clinic.io"):
    lead = Lead(campaign_id=campaign_id, company_name="Clinic", email=to)
    db.add(lead)
    db.commit()
    draft = EmailDraft(campaign_id=campaign_id, lead_id=lead.id, subject="Hello", body="Hi there", status=status)
    db.add(draft)
    db.commit()
    return draft


def test_claim_for_sending_succeeds_only_once(client, admin_headers, campaign_id, db):
    draft = _draft(db, campaign_id)
    assert claim_for_sending(db, draft) is True
    assert draft.status == "sending"
    assert claim_for_sending(db, draft) is False


def test_suppressed_recipient_is_never_sent(client, admin_headers, campaign_id, db, monkeypatch):
    client.post("/api/suppression/", headers=admin_headers, json={"email": "Owner@Clinic.io", "reason": "manual"})
    called = []
    monkeypatch.setattr(gmail_service, "get_gmail_service", lambda _db: called.append(1))
    result = gmail_service.send_email_via_gmail(db, "owner@clinic.io", "Hi", "Body")
    assert result["success"] is False and "suppression" in result["error"]
    assert called == []


def test_send_endpoint_marks_suppressed_draft_failed(client, admin_headers, campaign_id, db, monkeypatch):
    draft = _draft(db, campaign_id)
    client.post("/api/suppression/", headers=admin_headers, json={"email": "owner@clinic.io"})
    monkeypatch.setattr(gmail_routes, "ensure_gmail_ready", lambda _db: None)
    response = client.post(f"/api/gmail/send-draft/{draft.id}", headers=admin_headers).json()
    assert response["data"]["status"] == "failed"
    assert "suppression" in response["data"]["error"]


def test_message_headers_cannot_be_injected_and_include_unsubscribe():
    payload = gmail_service.create_message("owner@clinic.io", "Hi\r\nBcc: victim@evil.test", "Body", "me@co.test")
    message = email.message_from_bytes(base64.urlsafe_b64decode(payload["raw"]))
    assert message["Bcc"] is None
    assert "\n" not in message["Subject"]
    assert "".join(message["List-Unsubscribe"].split()).startswith("<https://api.example.test/api/public/unsubscribe")
    assert message["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"


def test_successful_send_is_audited(client, admin_headers, campaign_id, db, monkeypatch):
    fake_service = SimpleNamespace(users=lambda: SimpleNamespace(messages=lambda: SimpleNamespace(
        send=lambda userId, body: SimpleNamespace(execute=lambda: {"id": "gm-1", "threadId": "t-1"}))))
    monkeypatch.setattr(gmail_service, "get_gmail_service", lambda _db: fake_service)
    monkeypatch.setattr(gmail_service, "get_connected_gmail_token", lambda _db: SimpleNamespace(email="me@co.test"))
    monkeypatch.setattr(gmail_routes, "ensure_gmail_ready", lambda _db: None)
    draft = _draft(db, campaign_id)

    response = client.post(f"/api/gmail/send-draft/{draft.id}", headers=admin_headers).json()
    assert response["data"]["status"] == "sent"
    again = client.post(f"/api/gmail/send-draft/{draft.id}", headers=admin_headers)
    assert again.status_code == 400  # only approved drafts can be sent

    actions = [entry["action"] for entry in client.get("/api/audit/", headers=admin_headers).json()["data"]]
    assert actions.count("email.sent") == 1


def test_unsubscribe_flow_requires_valid_signature_and_post(client, admin_headers):
    address = "reader@news.test"
    token = unsubscribe_token(address)
    assert client.get("/api/public/unsubscribe", params={"email": address, "token": "forged"}).status_code == 400

    confirm = client.get("/api/public/unsubscribe", params={"email": address, "token": token})
    assert confirm.status_code == 200 and "<form" in confirm.text
    check = client.get("/api/suppression/check", headers=admin_headers, params={"email": address}).json()
    assert check["suppressed"] is False  # GET never unsubscribes

    done = client.post("/api/public/unsubscribe", data={"email": address, "token": token})
    assert done.status_code == 200
    check = client.get("/api/suppression/check", headers=admin_headers, params={"email": address}).json()
    assert check["suppressed"] is True


def test_suppression_import_and_listing(client, admin_headers):
    csv_text = "email\na@x.io\nb@x.io\nnot-email\na@x.io\n"
    result = client.post("/api/suppression/import", headers=admin_headers,
                         files={"file": ("s.csv", csv_text.encode(), "text/csv")}).json()
    assert result == {"status": "success", "added": 2, "already_present": 1, "invalid": 1}
    listing = client.get("/api/suppression/", headers=admin_headers, params={"q": "a@"}).json()
    assert listing["pagination"]["total"] == 1


def test_startup_recovery_fails_stale_jobs_and_stuck_sends(client, admin_headers, campaign_id, db):
    old = utc_now() - timedelta(hours=3)
    job = EmailExtractionJob(campaign_id=campaign_id, status="running", started_at=old)
    draft = _draft(db, campaign_id, status="sending")
    draft.updated_at = old
    db.add(job)
    db.commit()

    summary = recover_stale_work(db)
    db.refresh(job)
    db.refresh(draft)
    assert summary["email_extraction_jobs"] == 1 and job.status == "failed"
    assert draft.status == "failed" and "interrupted" in draft.send_error
