from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Campaign, Lead
from app.services import hunter_service

router = APIRouter(
    prefix="/hunter",
    tags=["Hunter"],
)

VALID_ENRICH_MODES = {"domain", "finder"}


class DomainSearchRequest(BaseModel):
    domain: str
    limit: int = Field(default=10, ge=1, le=100)


class EmailFinderRequest(BaseModel):
    domain: str
    first_name: str
    last_name: str


class EmailVerifyRequest(BaseModel):
    email: str


class BulkEnrichRequest(BaseModel):
    campaign_id: int
    mode: str = "domain"
    limit: int = Field(default=20, ge=1, le=50)
    min_confidence: int = Field(default=50, ge=0, le=100)


def clean_text(value):
    return str(value or "").strip()


def normalize_mode(mode):
    normalized_mode = clean_text(mode).lower() or "domain"
    if normalized_mode not in VALID_ENRICH_MODES:
        raise HTTPException(status_code=400, detail="mode must be either 'domain' or 'finder'.")
    return normalized_mode


def split_contact_name(name):
    parts = [part for part in clean_text(name).split() if part]
    if len(parts) < 2:
        return None, None
    return parts[0], " ".join(parts[1:])


def append_source(existing_source, source_label):
    existing = clean_text(existing_source)
    if not existing:
        return source_label
    if source_label.lower() in existing.lower():
        return existing
    return f"{existing}; {source_label}"


def lead_display_name(lead: Lead):
    return clean_text(lead.contact_name) or clean_text(lead.company_name) or f"Lead {lead.id}"


def hunter_email_value(email_payload):
    return clean_text(email_payload.get("value") or email_payload.get("email")).lower()


def hunter_email_score(email_payload):
    try:
        return int(email_payload.get("confidence", email_payload.get("score", 0)) or 0)
    except (TypeError, ValueError):
        return 0


def choose_domain_search_email(emails, min_confidence=50, allow_fallback=False):
    normalized_emails = [email for email in emails if hunter_email_value(email)]
    if not normalized_emails:
        return None

    sorted_emails = sorted(
        normalized_emails,
        key=hunter_email_score,
        reverse=True,
    )
    qualified_emails = [
        email for email in sorted_emails
        if hunter_email_score(email) >= min_confidence
    ]
    personal_emails = [
        email for email in qualified_emails
        if clean_text(email.get("type")).lower() == "personal"
    ]

    if personal_emails:
        return personal_emails[0]

    if qualified_emails:
        return qualified_emails[0]

    if allow_fallback:
        return sorted_emails[0]

    return None


def apply_hunter_email_to_lead(lead: Lead, email_payload, source_label="Hunter"):
    email = hunter_email_value(email_payload)
    if not email:
        return None

    lead.email = email
    lead.status = "email_found"
    lead.source = append_source(lead.source, source_label)

    first_name = clean_text(email_payload.get("first_name"))
    last_name = clean_text(email_payload.get("last_name"))
    if not clean_text(lead.contact_name) and (first_name or last_name):
        lead.contact_name = " ".join([first_name, last_name]).strip() or None

    position = clean_text(email_payload.get("position"))
    if not clean_text(lead.contact_role) and position:
        lead.contact_role = position

    return email


async def find_email_for_lead(lead: Lead, mode="domain", min_confidence=50, allow_fallback=False):
    website = clean_text(lead.website)
    if not website:
        return None, "Lead has no website.", None

    if mode == "finder":
        first_name, last_name = split_contact_name(lead.contact_name)
        if not first_name or not last_name:
            return None, "Lead needs a first and last contact name for Hunter Email Finder.", None

        result = await hunter_service.email_finder(website, first_name, last_name)
        if result.get("error") and not result.get("email"):
            return None, result["error"], result
        if not result.get("email"):
            return None, "No email found via Hunter.", result
        if hunter_email_score(result) < min_confidence:
            return None, "Hunter found an email below the confidence threshold.", result
        return {
            "value": result.get("email"),
            "confidence": result.get("score"),
            "type": result.get("type"),
        }, None, result

    result = await hunter_service.domain_search(website, limit=5)
    emails = result.get("emails") or []
    if result.get("error") and not emails:
        return None, result["error"], result

    chosen = choose_domain_search_email(emails, min_confidence=min_confidence, allow_fallback=allow_fallback)
    if not chosen:
        return None, "No email found via Hunter.", result

    return chosen, None, result


@router.get("/status")
def hunter_status():
    return hunter_service.get_hunter_status()


@router.post("/domain-search")
async def domain_search(payload: DomainSearchRequest):
    result = await hunter_service.domain_search(payload.domain, payload.limit)
    if result.get("error") and not result.get("emails"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/email-finder")
async def email_finder(payload: EmailFinderRequest):
    result = await hunter_service.email_finder(payload.domain, payload.first_name, payload.last_name)
    if result.get("error") and not result.get("email"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/verify")
async def verify_email(payload: EmailVerifyRequest):
    return await hunter_service.email_verifier(payload.email)


@router.post("/enrich-lead/{lead_id}")
async def enrich_lead(
    lead_id: int,
    mode: str = Query(default="domain"),
    min_confidence: int = Query(default=50, ge=0, le=100),
    db: Session = Depends(get_db),
):
    normalized_mode = normalize_mode(mode)
    lead = db.get(Lead, lead_id)

    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")

    if clean_text(lead.email):
        return {
            "message": "Lead already has an email.",
            "email": lead.email,
            "updated": False,
        }

    chosen, error, raw_result = await find_email_for_lead(
        lead,
        mode=normalized_mode,
        min_confidence=min_confidence,
        allow_fallback=True,
    )

    if not chosen:
        if error == "No email found via Hunter.":
            lead.status = "email_not_found"
            db.commit()
        return {
            "message": error or "No email found via Hunter.",
            "updated": False,
            "raw_result": raw_result,
        }

    saved_email = apply_hunter_email_to_lead(lead, chosen)
    db.commit()
    db.refresh(lead)

    return {
        "message": "Email found and saved.",
        "email": saved_email,
        "confidence": hunter_email_score(chosen),
        "type": chosen.get("type"),
        "updated": True,
    }


@router.post("/bulk-enrich")
async def bulk_enrich(payload: BulkEnrichRequest, db: Session = Depends(get_db)):
    normalized_mode = normalize_mode(payload.mode)
    campaign = db.get(Campaign, payload.campaign_id)

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")

    leads_missing_email = (
        db.query(Lead)
        .filter(Lead.campaign_id == payload.campaign_id)
        .filter(or_(Lead.email.is_(None), Lead.email == ""))
        .filter(Lead.website.is_not(None), Lead.website != "")
        .order_by(Lead.created_at.desc())
        .limit(payload.limit)
        .all()
    )

    if not leads_missing_email:
        return {
            "message": "No leads need Hunter enrichment.",
            "enriched": 0,
            "skipped": 0,
            "failed": 0,
            "results": [],
        }

    enriched = 0
    skipped = 0
    failed = 0
    results = []

    for lead in leads_missing_email:
        chosen, error, _raw_result = await find_email_for_lead(
            lead,
            mode=normalized_mode,
            min_confidence=payload.min_confidence,
            allow_fallback=False,
        )

        if not chosen:
            if error and "Hunter API error" in error:
                failed += 1
                status = "error"
            else:
                skipped += 1
                status = "not_found"

            results.append({
                "lead_id": lead.id,
                "name": lead_display_name(lead),
                "status": status,
                "reason": error or "No email found via Hunter.",
            })
            continue

        saved_email = apply_hunter_email_to_lead(lead, chosen)
        enriched += 1
        results.append({
            "lead_id": lead.id,
            "name": lead_display_name(lead),
            "status": "found",
            "email": saved_email,
            "confidence": hunter_email_score(chosen),
            "type": chosen.get("type"),
        })

    db.commit()

    return {
        "message": "Hunter bulk enrichment completed.",
        "enriched": enriched,
        "skipped": skipped,
        "failed": failed,
        "results": results,
    }
