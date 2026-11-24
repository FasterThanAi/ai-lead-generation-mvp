import csv
import io

from app.core.config import settings
from app.db.models import CallLog, Lead


def _lead(client, headers, campaign_id, **overrides):
    payload = {"campaign_id": campaign_id, "company_name": "Acme Dental", **overrides}
    return client.post("/api/leads/create", headers=headers, json=payload).json()


def test_duplicate_detection_ignores_case_scheme_and_www(client, admin_headers, campaign_id):
    first = _lead(client, admin_headers, campaign_id, website="https://www.Acme.com/")
    assert first["status"] == "success"
    again = _lead(client, admin_headers, campaign_id, website="acme.COM")
    assert again["skipped"] is True and again["lead_id"] == first["lead_id"]

    by_email = _lead(client, admin_headers, campaign_id, company_name="Other", email="Owner@Clinic.io")
    dupe_email = _lead(client, admin_headers, campaign_id, company_name="Other 2", email="owner@clinic.io")
    assert dupe_email["lead_id"] == by_email["lead_id"]


def test_invalid_email_is_dropped_and_long_values_are_clipped(client, admin_headers, campaign_id, db):
    created = _lead(client, admin_headers, campaign_id, company_name="X" * 400, email="not-an-email")
    lead = db.get(Lead, created["lead_id"])
    assert lead.email is None
    assert len(lead.company_name) == 255


def _upload(client, headers, campaign_id, text):
    return client.post(f"/api/leads/upload-csv/{campaign_id}", headers=headers,
                       files={"file": ("leads.csv", text.encode(), "text/csv")})


def test_csv_upload_dedupes_and_reports(client, admin_headers, campaign_id):
    text = (
        "Company_Name,website,email\n"
        "Alpha,alpha.com,a@alpha.com\n"
        "Alpha again,https://www.alpha.com,\n"
        "Beta,,bad-email\n"
        ",gamma.com,\n"
    )
    body = _upload(client, admin_headers, campaign_id, text).json()
    assert body["inserted_count"] == 2
    assert body["duplicate_count"] == 1
    assert body["invalid_email_count"] == 1
    assert body["missing_company_count"] == 1


def test_csv_upload_limits(client, admin_headers, campaign_id, monkeypatch):
    assert _upload(client, admin_headers, campaign_id, "name,website\nA,a.com\n").status_code == 400

    monkeypatch.setattr(settings, "CSV_MAX_ROWS", 2)
    rows = "company_name\n" + "\n".join(f"Co {i}" for i in range(3)) + "\n"
    assert _upload(client, admin_headers, campaign_id, rows).status_code == 413

    monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 0)
    assert _upload(client, admin_headers, campaign_id, "company_name\nA\n").status_code == 413


def test_csv_export_neutralises_formulas(client, admin_headers, campaign_id):
    _lead(client, admin_headers, campaign_id, company_name='=HYPERLINK("http://evil","x")')
    response = client.get(f"/api/leads/campaign/{campaign_id}/export-csv", headers=admin_headers)
    rows = list(csv.reader(io.StringIO(response.text)))
    assert rows[1][0].startswith("'=")


def test_search_filters_sorts_and_paginates(client, admin_headers, campaign_id):
    for index in range(7):
        _lead(client, admin_headers, campaign_id, company_name=f"Clinic {index}",
              email=f"c{index}@clinic{index}.com" if index % 2 == 0 else None)
    page = client.get("/api/leads/search", headers=admin_headers,
                      params={"campaign_id": campaign_id, "page_size": 3, "sort": "company_name", "order": "asc"}).json()
    assert page["pagination"] == {"page": 1, "page_size": 3, "total": 7, "pages": 3}
    assert [lead["company_name"] for lead in page["data"]] == ["Clinic 0", "Clinic 1", "Clinic 2"]

    with_email = client.get("/api/leads/search", headers=admin_headers, params={"has_email": True}).json()
    assert with_email["pagination"]["total"] == 4
    query = client.get("/api/leads/search", headers=admin_headers, params={"q": "clinic 5"}).json()
    assert [lead["company_name"] for lead in query["data"]] == ["Clinic 5"]


def test_edit_bulk_update_and_delete_leads(client, admin_headers, campaign_id, db):
    ids = [_lead(client, admin_headers, campaign_id, company_name=f"Co {i}")["lead_id"] for i in range(3)]
    db.add(CallLog(lead_id=ids[0], campaign_id=campaign_id, status="ended"))
    db.commit()

    edited = client.patch(f"/api/leads/{ids[0]}", headers=admin_headers, json={"status": "qualified"})
    assert edited.json()["data"]["status"] == "qualified"
    assert client.patch(f"/api/leads/{ids[0]}", headers=admin_headers, json={"status": "bogus"}).status_code == 400

    updated = client.post("/api/leads/bulk-update", headers=admin_headers,
                          json={"lead_ids": ids, "do_not_call": True}).json()
    assert updated["updated"] == 3

    deleted = client.post("/api/leads/bulk-delete", headers=admin_headers, json={"lead_ids": ids[:2]}).json()
    assert deleted["deleted"] == 2
    db.expire_all()
    assert db.query(CallLog).first().lead_id is None  # call history kept, detached
    assert client.delete(f"/api/leads/{ids[2]}", headers=admin_headers).json()["deleted"] == 1


def test_campaign_list_edit_duplicate_delete(client, admin_headers, campaign_id):
    _lead(client, admin_headers, campaign_id, company_name="Lead A")
    campaigns = client.get("/api/campaigns/", headers=admin_headers).json()["data"]
    assert campaigns[0]["lead_count"] == 1 and campaigns[0]["sent_count"] == 0

    patched = client.patch(f"/api/campaigns/{campaign_id}", headers=admin_headers, json={"location": "Mumbai"})
    assert patched.json()["data"]["location"] == "Mumbai"
    assert client.patch(f"/api/campaigns/{campaign_id}", headers=admin_headers,
                        json={"campaign_name": "  "}).status_code == 422

    copy = client.post(f"/api/campaigns/{campaign_id}/duplicate", headers=admin_headers).json()
    assert copy["data"]["campaign_name"].endswith("(copy)")

    deleted = client.delete(f"/api/campaigns/{campaign_id}", headers=admin_headers).json()
    assert deleted["deleted_leads"] == 1
    assert client.get(f"/api/campaigns/{campaign_id}/summary", headers=admin_headers).status_code == 404
