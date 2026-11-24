import csv
import io
import logging
import time
from datetime import timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.db.database import SessionLocal, get_db
from app.db.models import CallLog, CallScript, Campaign, DiscoveredLead, EmailExtractionJob, Lead
from app.schemas.lead_schema import LeadBulkAction, LeadCreate, LeadUpdate
from app.services.audit_service import record_audit
from app.services.email_guesser_service import find_email_for_website
from app.services.lead_research_service import (
    LeadResearchError,
    research_lead,
    serialize_research_result,
)
from app.services.suppression_service import is_valid_email, normalize_email
from app.utils.time_utils import utc_now

router = APIRouter(
    prefix="/leads",
    tags=["Leads"]
)

logger = logging.getLogger(__name__)
RUNNING_EXTRACTION_STATUSES = {"pending", "running"}
STALE_EXTRACTION_JOB_AGE = timedelta(hours=1)


def clean_optional(value):
    if value is None:
        return None

    value = str(value).strip()
    return value or None


def append_source(existing_source, source_label):
    existing = clean_optional(existing_source)
    label = clean_optional(source_label)

    if not label:
        return existing

    if not existing:
        return label

    if label.lower() in existing.lower():
        return existing

    return f"{existing}; {label}"


LEAD_COLUMN_LIMITS = {
    "company_name": 255,
    "website": 255,
    "industry": 255,
    "location": 255,
    "contact_name": 255,
    "contact_role": 255,
    "email": 255,
    "phone": 100,
    "source": 100,
}
FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def clip(value, field):
    """Trim and cut to the column width so Postgres never rejects an over-long value."""
    cleaned = clean_optional(value)
    if cleaned is None:
        return None
    return cleaned[: LEAD_COLUMN_LIMITS.get(field, 255)]


def clean_lead_email(value):
    email = normalize_email(value)
    if not email:
        return None
    return email[:255] if is_valid_email(email) else None


def website_key_for(website):
    """Comparable form of a website: no scheme, no www, no trailing slash, lower case."""
    if not website:
        return None
    key = website.strip().lower()
    for prefix in ("https://", "http://"):
        if key.startswith(prefix):
            key = key[len(prefix):]
    if key.startswith("www."):
        key = key[4:]
    return key.rstrip("/") or None


def existing_lead_keys(db: Session, campaign_id: int):
    rows = db.query(Lead.website, Lead.email).filter(Lead.campaign_id == campaign_id).all()
    websites = {website_key_for(website) for website, _ in rows if website}
    emails = {normalize_email(email) for _, email in rows if email}
    websites.discard(None)
    return websites, emails


def find_duplicate_lead(db: Session, campaign_id: int, website=None, email=None, phone=None):
    key = website_key_for(website)
    if key:
        candidates = (
            db.query(Lead)
            .filter(Lead.campaign_id == campaign_id, func.lower(Lead.website).like(f"%{key}%"))
            .all()
        )
        for candidate in candidates:
            if website_key_for(candidate.website) == key:
                return candidate
    if email:
        match = (
            db.query(Lead)
            .filter(Lead.campaign_id == campaign_id, func.lower(Lead.email) == email)
            .first()
        )
        if match:
            return match
    if phone and not key:
        return db.query(Lead).filter(Lead.campaign_id == campaign_id, Lead.phone == phone).first()
    return None


def csv_safe(value):
    """Prefix values that spreadsheets would execute as formulas (CSV injection)."""
    if isinstance(value, str) and value.startswith(FORMULA_PREFIXES):
        return "'" + value
    return value


def csv_safe_row(values):
    return [csv_safe(value) for value in values]


def get_campaign_or_404(campaign_id: int, db: Session):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()

    if not campaign:
        raise HTTPException(
            status_code=404,
            detail=f"Campaign with id {campaign_id} was not found"
        )

    return campaign


def get_lead_or_404(lead_id: int, db: Session):
    lead = (
        db.query(Lead)
        .options(joinedload(Lead.campaign))
        .filter(Lead.id == lead_id)
        .first()
    )

    if not lead:
        raise HTTPException(
            status_code=404,
            detail=f"Lead with id {lead_id} was not found"
        )

    return lead


def serialize_lead(lead: Lead):
    return {
        "id": lead.id,
        "campaign_id": lead.campaign_id,
        "company_name": lead.company_name,
        "website": lead.website,
        "industry": lead.industry,
        "location": lead.location,
        "contact_name": lead.contact_name,
        "contact_role": lead.contact_role,
        "email": lead.email,
        "phone": lead.phone,
        "source_url": lead.source_url,
        "profile_url": lead.profile_url,
        "source": lead.source,
        "status": lead.status,
        "call_status": lead.call_status,
        "last_call_outcome": lead.last_call_outcome,
        "last_called_at": lead.last_called_at,
        "do_not_call": lead.do_not_call,
        "ai_score": lead.ai_score,
        "ai_fit_score": lead.ai_fit_score,
        "ai_contact_confidence_score": lead.ai_contact_confidence_score,
        "ai_priority": lead.ai_priority,
        "ai_qualification": lead.ai_qualification,
        "ai_score_reason": lead.ai_score_reason,
        "ai_contact_confidence_reason": lead.ai_contact_confidence_reason,
        "ai_outreach_angle": lead.ai_outreach_angle,
        "ai_pain_point": lead.ai_pain_point,
        "ai_recommended_cta": lead.ai_recommended_cta,
        "ai_final_priority_reason": lead.ai_final_priority_reason,
        "ai_scored_at": lead.ai_scored_at,
        "ai_model_used": lead.ai_model_used,
        "ai_score_error": lead.ai_score_error,
        "research_status": lead.research_status,
        "research_summary": lead.research_summary,
        "research_business_type": lead.research_business_type,
        "research_target_customers": lead.research_target_customers,
        "research_products_services": lead.research_products_services,
        "research_pain_points": lead.research_pain_points,
        "research_use_case_fit": lead.research_use_case_fit,
        "research_outreach_angle": lead.research_outreach_angle,
        "research_risk_flags": lead.research_risk_flags,
        "research_confidence": lead.research_confidence,
        "research_sources": lead.research_sources,
        "research_error": lead.research_error,
        "research_used_fallback": lead.research_used_fallback,
        "researched_at": lead.researched_at,
        "created_at": lead.created_at,
    }


def apply_extraction_result_to_lead(lead: Lead, extraction_result: dict):
    found_emails = extraction_result.get("emails", [])
    scraper_error = extraction_result.get("error")
    source_label = clean_optional(extraction_result.get("source"))
    saved_email = lead.email

    if found_emails:
        if not clean_optional(lead.email):
            lead.email = found_emails[0]

        lead.status = "email_found"
        lead.source = append_source(lead.source, source_label)
        saved_email = lead.email
    elif scraper_error:
        lead.status = "extraction_failed"
    else:
        lead.status = "email_not_found"

    return saved_email


def lead_needs_email_filters(campaign_id: int):
    return (
        Lead.campaign_id == campaign_id,
        or_(Lead.email.is_(None), Lead.email == ""),
        Lead.website.is_not(None),
        Lead.website != "",
    )


def serialize_extraction_job(job: EmailExtractionJob):
    total = job.total_leads or 0
    processed = job.processed or 0
    percentage = round((processed / total) * 100) if total else 0

    return {
        "job_id": job.id,
        "campaign_id": job.campaign_id,
        "status": job.status,
        "total": total,
        "total_leads": total,
        "processed": processed,
        "found": job.found or 0,
        "skipped": job.skipped or 0,
        "failed": job.failed or 0,
        "percentage": min(100, percentage),
        "remaining": max(total - processed, 0),
        "started_at": job.started_at,
        "finished_at": job.finished_at,
        "error": job.error,
    }


def get_extraction_job_or_404(job_id: int, db: Session):
    job = db.get(EmailExtractionJob, job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Email extraction job not found")

    return job


def mark_stale_extraction_jobs_failed(db: Session, campaign_id: int):
    cutoff = utc_now() - STALE_EXTRACTION_JOB_AGE
    jobs = (
        db.query(EmailExtractionJob)
        .filter(
            EmailExtractionJob.campaign_id == campaign_id,
            EmailExtractionJob.status.in_(RUNNING_EXTRACTION_STATUSES),
        )
        .all()
    )
    changed = False

    for job in jobs:
        started_at = job.started_at
        if started_at and started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)

        if not started_at or started_at < cutoff:
            job.status = "failed"
            job.finished_at = utc_now()
            job.error = job.error or "Email extraction stopped before completing. Start a new extraction job."
            changed = True

    if changed:
        db.commit()


def update_job_counts_for_lead(job: EmailExtractionJob, lead: Lead):
    if lead.status == "email_found" and clean_optional(lead.email):
        job.found = (job.found or 0) + 1
    elif lead.status == "extraction_failed":
        job.failed = (job.failed or 0) + 1
    else:
        job.skipped = (job.skipped or 0) + 1


def _run_extraction_job(job_id: int, campaign_id: int, limit: int):
    db = SessionLocal()
    job = None

    try:
        job = db.get(EmailExtractionJob, job_id)
        if not job:
            logger.warning("Email extraction job %s disappeared before it could start.", job_id)
            return

        job.status = "running"
        db.commit()

        leads = (
            db.query(Lead)
            .filter(*lead_needs_email_filters(campaign_id))
            .order_by(Lead.created_at.desc(), Lead.id.desc())
            .limit(limit)
            .all()
        )

        job.total_leads = len(leads)
        db.commit()

        if not leads:
            job.status = "completed"
            job.finished_at = utc_now()
            db.commit()
            return

        for lead in leads:
            try:
                time.sleep(1)
                extraction_result = find_email_for_website(lead.website, lead.contact_name)
                apply_extraction_result_to_lead(lead, extraction_result)
                update_job_counts_for_lead(job, lead)
            except Exception as exc:
                logger.exception("Email extraction failed for lead %s in job %s", lead.id, job_id)
                lead.status = "extraction_failed"
                job.failed = (job.failed or 0) + 1
                if not job.error:
                    job.error = str(exc)
            finally:
                job.processed = (job.processed or 0) + 1
                db.commit()

        job.status = "completed"
        job.finished_at = utc_now()
        db.commit()
    except Exception as exc:
        logger.exception("Email extraction job %s failed", job_id)
        db.rollback()

        if job:
            job.status = "failed"
            job.error = str(exc)
            job.finished_at = utc_now()
            db.commit()
    finally:
        db.close()


@router.post("/create")
def create_lead(lead: LeadCreate, request: Request, db: Session = Depends(get_db)):
    get_campaign_or_404(lead.campaign_id, db)

    company_name = clip(lead.company_name, "company_name")

    if not company_name:
        raise HTTPException(
            status_code=400,
            detail="company_name is required"
        )

    website = clip(lead.website, "website")
    email = clean_lead_email(lead.email)
    phone = clip(getattr(lead, "phone", None), "phone")

    existing = find_duplicate_lead(db, lead.campaign_id, website=website, email=email, phone=phone)
    if existing:
        return {
            "status": "skipped",
            "message": "Lead already exists",
            "lead_id": existing.id,
            "skipped": True
        }

    new_lead = Lead(
        campaign_id=lead.campaign_id,
        company_name=company_name,
        website=website,
        industry=clip(lead.industry, "industry"),
        location=clip(lead.location, "location"),
        contact_name=clip(lead.contact_name, "contact_name"),
        contact_role=clip(lead.contact_role, "contact_role"),
        email=email,
        phone=phone,
        source_url=clean_optional(getattr(lead, "source_url", None)),
        profile_url=clean_optional(getattr(lead, "profile_url", None)),
        source=clip(lead.source, "source") or "Manual",
    )

    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)

    return {
        "status": "success",
        "message": "Lead created successfully",
        "lead_id": new_lead.id
    }


@router.get("/")
def get_leads(db: Session = Depends(get_db)):
    leads = db.query(Lead).order_by(Lead.created_at.desc()).all()

    return {
        "status": "success",
        "data": [serialize_lead(lead) for lead in leads],
    }


@router.get("/campaign/{campaign_id}")
def get_campaign_leads(campaign_id: int, db: Session = Depends(get_db)):
    get_campaign_or_404(campaign_id, db)

    leads = (
        db.query(Lead)
        .filter(Lead.campaign_id == campaign_id)
        .order_by(Lead.created_at.desc())
        .all()
    )

    return {
        "status": "success",
        "data": [serialize_lead(lead) for lead in leads],
    }


@router.post("/campaign/{campaign_id}/extract-emails-async")
def extract_emails_async(
    campaign_id: int,
    background_tasks: BackgroundTasks,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    get_campaign_or_404(campaign_id, db)
    mark_stale_extraction_jobs_failed(db, campaign_id)

    running_job = (
        db.query(EmailExtractionJob)
        .filter(
            EmailExtractionJob.campaign_id == campaign_id,
            EmailExtractionJob.status.in_(RUNNING_EXTRACTION_STATUSES),
        )
        .order_by(EmailExtractionJob.started_at.desc(), EmailExtractionJob.id.desc())
        .first()
    )

    if running_job:
        return {
            "status": running_job.status,
            "message": "Email extraction is already running for this campaign.",
            "poll_url": f"/api/leads/extraction-job/{running_job.id}",
            **serialize_extraction_job(running_job),
        }

    total = db.query(Lead).filter(*lead_needs_email_filters(campaign_id)).count()

    if total == 0:
        return {
            "job_id": None,
            "campaign_id": campaign_id,
            "message": "No leads need email extraction.",
            "total": 0,
            "total_leads": 0,
            "processed": 0,
            "found": 0,
            "skipped": 0,
            "failed": 0,
            "percentage": 100,
            "remaining": 0,
            "status": "nothing_to_do",
        }

    actual_limit = min(limit, total)
    job = EmailExtractionJob(
        campaign_id=campaign_id,
        status="running",
        total_leads=actual_limit,
        processed=0,
        found=0,
        skipped=0,
        failed=0,
        error=None,
    )

    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(
        _run_extraction_job,
        job_id=job.id,
        campaign_id=campaign_id,
        limit=actual_limit,
    )

    return {
        "status": "running",
        "message": f"Email extraction started for {actual_limit} leads.",
        "poll_url": f"/api/leads/extraction-job/{job.id}",
        **serialize_extraction_job(job),
    }


@router.get("/extraction-job/{job_id}")
def get_extraction_job(job_id: int, db: Session = Depends(get_db)):
    job = get_extraction_job_or_404(job_id, db)
    return serialize_extraction_job(job)


@router.get("/campaign/{campaign_id}/extraction-status")
def get_campaign_extraction_status(campaign_id: int, db: Session = Depends(get_db)):
    get_campaign_or_404(campaign_id, db)
    mark_stale_extraction_jobs_failed(db, campaign_id)

    total = db.query(Lead).filter(Lead.campaign_id == campaign_id).count()
    with_email = (
        db.query(Lead)
        .filter(
            Lead.campaign_id == campaign_id,
            Lead.email.is_not(None),
            Lead.email != "",
        )
        .count()
    )
    eligible_without_email = db.query(Lead).filter(*lead_needs_email_filters(campaign_id)).count()
    without_email = max(total - with_email, 0)

    running_job = (
        db.query(EmailExtractionJob)
        .filter(
            EmailExtractionJob.campaign_id == campaign_id,
            EmailExtractionJob.status.in_(RUNNING_EXTRACTION_STATUSES),
        )
        .order_by(EmailExtractionJob.started_at.desc(), EmailExtractionJob.id.desc())
        .first()
    )

    return {
        "campaign_id": campaign_id,
        "total_leads": total,
        "with_email": with_email,
        "without_email": without_email,
        "eligible_without_email": eligible_without_email,
        "coverage_percent": round((with_email / total * 100) if total > 0 else 0),
        "running_job_id": running_job.id if running_job else None,
        "running_job": serialize_extraction_job(running_job) if running_job else None,
    }


@router.get("/campaign/{campaign_id}/export-csv")
def export_leads_csv(campaign_id: int, db: Session = Depends(get_db)):
    get_campaign_or_404(campaign_id, db)

    leads = (
        db.query(Lead)
        .filter(Lead.campaign_id == campaign_id)
        .order_by(Lead.created_at.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "company_name", "website", "email", "phone",
        "contact_name", "contact_role", "location", "industry",
        "source", "status", "ai_score", "ai_priority", "created_at"
    ])

    # Rows
    for lead in leads:
        writer.writerow(csv_safe_row([
            lead.company_name or "",
            lead.website or "",
            lead.email or "",
            lead.phone or "",
            lead.contact_name or "",
            lead.contact_role or "",
            lead.location or "",
            lead.industry or "",
            lead.source or "",
            lead.status or "",
            "" if lead.ai_score is None else lead.ai_score,
            lead.ai_priority or "",
            lead.created_at or ""
        ]))

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="campaign_{campaign_id}_leads.csv"'
        }
    )


@router.get("/{lead_id}/research")
def get_lead_research(lead_id: int, db: Session = Depends(get_db)):
    lead = get_lead_or_404(lead_id, db)

    return {
        "status": "success",
        **serialize_research_result(lead),
    }


@router.post("/{lead_id}/research")
def research_one_lead(lead_id: int, db: Session = Depends(get_db)):
    get_lead_or_404(lead_id, db)

    try:
        result = research_lead(db, lead_id)
    except LeadResearchError as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc) or "Lead research failed. Please try again.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Lead research failed. Please try again.",
        ) from exc

    return {
        "status": "success",
        "message": "Lead research completed",
        **result,
    }


@router.post("/upload-csv/{campaign_id}")
async def upload_leads_csv(
    campaign_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    get_campaign_or_404(campaign_id, db)

    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    contents = await file.read(max_bytes + 1)

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="CSV file is empty"
        )

    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"CSV file is larger than {settings.MAX_UPLOAD_MB} MB"
        )

    try:
        decoded_csv = contents.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail="CSV file must be UTF-8 encoded"
        ) from exc

    reader = csv.DictReader(io.StringIO(decoded_csv))

    if not reader.fieldnames:
        raise HTTPException(
            status_code=400,
            detail="CSV file is missing headers"
        )

    normalized_headers = {(name or "").strip().lower() for name in reader.fieldnames}
    if "company_name" not in normalized_headers:
        raise HTTPException(
            status_code=400,
            detail="CSV must include a company_name column"
        )

    existing_websites, existing_emails = existing_lead_keys(db, campaign_id)
    leads_to_insert = []
    duplicates = 0
    invalid_emails = 0
    missing_company = 0

    for row_number, row in enumerate(reader, start=1):
        if row_number > settings.CSV_MAX_ROWS:
            raise HTTPException(
                status_code=413,
                detail=f"CSV has more than {settings.CSV_MAX_ROWS} rows. Split it into smaller files."
            )

        normalized_row = {
            key.strip().lower(): value
            for key, value in row.items()
            if key is not None
        }

        company_name = clip(normalized_row.get("company_name"), "company_name")

        if not company_name:
            missing_company += 1
            continue

        raw_email = clean_optional(normalized_row.get("email"))
        email = clean_lead_email(raw_email)
        if raw_email and not email:
            invalid_emails += 1

        website = clip(normalized_row.get("website"), "website")
        website_key = website_key_for(website)

        if (website_key and website_key in existing_websites) or (email and email in existing_emails):
            duplicates += 1
            continue

        if website_key:
            existing_websites.add(website_key)
        if email:
            existing_emails.add(email)

        leads_to_insert.append(
            Lead(
                campaign_id=campaign_id,
                company_name=company_name,
                website=website,
                industry=clip(normalized_row.get("industry"), "industry"),
                location=clip(normalized_row.get("location"), "location"),
                contact_name=clip(normalized_row.get("contact_name"), "contact_name"),
                contact_role=clip(normalized_row.get("contact_role"), "contact_role"),
                email=email,
                phone=clip(normalized_row.get("phone"), "phone"),
                source_url=clean_optional(normalized_row.get("source_url")),
                profile_url=clean_optional(normalized_row.get("profile_url")),
                source=clip(normalized_row.get("source"), "source") or "CSV",
            )
        )

    if not leads_to_insert and not duplicates:
        raise HTTPException(
            status_code=400,
            detail="CSV has no valid rows with company_name"
        )

    db.add_all(leads_to_insert)
    db.commit()
    record_audit(db, "leads.imported", actor=getattr(request.state, "principal", None), entity_type="campaign",
                 entity_id=campaign_id, summary=f"Imported {len(leads_to_insert)} leads from CSV", request=request,
                 details={"duplicates": duplicates, "invalid_emails": invalid_emails, "missing_company": missing_company})

    return {
        "status": "success",
        "message": "CSV uploaded successfully",
        "inserted_count": len(leads_to_insert),
        "duplicate_count": duplicates,
        "invalid_email_count": invalid_emails,
        "missing_company_count": missing_company,
    }


@router.post("/extract-email/{lead_id}")
def extract_email_for_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = get_lead_or_404(lead_id, db)

    if not clean_optional(lead.website):
        lead.status = "website_missing"
        db.commit()

        raise HTTPException(
            status_code=400,
            detail="Lead website is missing"
        )

    extraction_result = find_email_for_website(lead.website, lead.contact_name)
    saved_email = apply_extraction_result_to_lead(lead, extraction_result)

    db.commit()
    db.refresh(lead)

    return {
        "status": "success",
        "message": "Email extraction completed",
        "lead_id": lead.id,
        "found_emails": extraction_result.get("emails", []),
        "saved_email": saved_email,
        "pages_checked": extraction_result.get("pages_checked", []),
        "source": extraction_result.get("source"),
        "method": extraction_result.get("method"),
        "verification": extraction_result.get("verification"),
        "lead_status": lead.status,
        "error": extraction_result.get("error")
    }


@router.post("/extract-emails/campaign/{campaign_id}")
def extract_emails_for_campaign(campaign_id: int, db: Session = Depends(get_db)):
    get_campaign_or_404(campaign_id, db)

    leads = (
        db.query(Lead)
        .filter(Lead.campaign_id == campaign_id)
        .order_by(Lead.created_at.desc())
        .all()
    )

    if not leads:
        return {
            "status": "success",
            "message": "No leads found for this campaign",
            "campaign_id": campaign_id,
            "total_leads": 0,
            "processed": 0,
            "email_found": 0,
            "email_not_found": 0,
            "website_missing": 0,
            "extraction_failed": 0,
            "results": []
        }

    summary = {
        "email_found": 0,
        "email_not_found": 0,
        "website_missing": 0,
        "extraction_failed": 0,
    }
    results = []

    for lead in leads:
        website = clean_optional(lead.website)
        found_emails = []
        saved_email = lead.email
        pages_checked = []
        extraction_error = None
        extraction_result = None

        if not website:
            lead.status = "website_missing"
            summary["website_missing"] += 1
        elif clean_optional(lead.email):
            lead.status = "email_found"
            summary["email_found"] += 1
        else:
            try:
                extraction_result = find_email_for_website(website, lead.contact_name)
                found_emails = extraction_result.get("emails", [])
                pages_checked = extraction_result.get("pages_checked", [])
                extraction_error = extraction_result.get("error")
                saved_email = apply_extraction_result_to_lead(lead, extraction_result)
                summary[lead.status] += 1
            except Exception as exc:
                lead.status = "extraction_failed"
                extraction_error = str(exc)
                summary["extraction_failed"] += 1

        results.append({
            "lead_id": lead.id,
            "company_name": lead.company_name,
            "website": lead.website,
            "found_emails": found_emails,
            "saved_email": saved_email,
            "status": lead.status,
            "pages_checked": pages_checked,
            "source": extraction_result.get("source") if extraction_result else None,
            "method": extraction_result.get("method") if extraction_result else None,
            "verification": extraction_result.get("verification") if extraction_result else None,
            "error": extraction_error,
        })

    db.commit()

    return {
        "status": "success",
        "message": "Campaign email extraction completed",
        "campaign_id": campaign_id,
        "total_leads": len(leads),
        "processed": len(results),
        "email_found": summary["email_found"],
        "email_not_found": summary["email_not_found"],
        "website_missing": summary["website_missing"],
        "extraction_failed": summary["extraction_failed"],
        "results": results
    }


# --- Search, edit, delete, bulk actions -----------------------------------

SORTABLE_FIELDS = {
    "created_at": Lead.created_at,
    "company_name": Lead.company_name,
    "ai_score": Lead.ai_score,
    "status": Lead.status,
}
EDITABLE_STATUSES = {"new", "email_found", "email_not_found", "website_missing", "extraction_failed",
                     "contacted", "qualified", "disqualified"}
MAX_BULK = 500


@router.get("/search")
def search_leads(
    q: str | None = Query(None, max_length=200),
    campaign_id: int | None = Query(None),
    status: str | None = Query(None, max_length=100),
    priority: str | None = Query(None, max_length=50),
    has_email: bool | None = Query(None),
    min_score: int | None = Query(None, ge=0, le=100),
    sort: str = Query("created_at"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Server-side filtered, sorted and paginated lead list for large campaigns."""
    query = db.query(Lead)
    if campaign_id is not None:
        query = query.filter(Lead.campaign_id == campaign_id)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(
            Lead.company_name.ilike(like),
            Lead.contact_name.ilike(like),
            Lead.email.ilike(like),
            Lead.website.ilike(like),
            Lead.location.ilike(like),
        ))
    if status:
        query = query.filter(Lead.status == status)
    if priority:
        query = query.filter(func.lower(Lead.ai_priority) == priority.lower())
    if has_email is True:
        query = query.filter(Lead.email.is_not(None), Lead.email != "")
    elif has_email is False:
        query = query.filter(or_(Lead.email.is_(None), Lead.email == ""))
    if min_score is not None:
        query = query.filter(Lead.ai_score >= min_score)

    total = query.count()
    column = SORTABLE_FIELDS.get(sort, Lead.created_at)
    ordering = column.asc() if order == "asc" else column.desc()
    leads = query.order_by(ordering, Lead.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "status": "success",
        "data": [serialize_lead(lead) for lead in leads],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "pages": (total + page_size - 1) // page_size,
        },
    }


@router.get("/stats/overview")
def lead_overview(campaign_id: int | None = Query(None), db: Session = Depends(get_db)):
    query = db.query(Lead.status, func.count(Lead.id))
    if campaign_id is not None:
        query = query.filter(Lead.campaign_id == campaign_id)
    by_status = {status or "unknown": count for status, count in query.group_by(Lead.status).all()}
    priority_query = db.query(Lead.ai_priority, func.count(Lead.id))
    if campaign_id is not None:
        priority_query = priority_query.filter(Lead.campaign_id == campaign_id)
    by_priority = {(p or "unscored").lower(): c for p, c in priority_query.group_by(Lead.ai_priority).all()}
    return {"status": "success", "total": sum(by_status.values()), "by_status": by_status, "by_priority": by_priority}


@router.patch("/{lead_id}")
def update_lead(lead_id: int, payload: LeadUpdate, request: Request, db: Session = Depends(get_db)):
    lead = get_lead_or_404(lead_id, db)
    changes = payload.model_dump(exclude_unset=True)

    if "status" in changes and changes["status"] not in EDITABLE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {', '.join(sorted(EDITABLE_STATUSES))}")
    if "email" in changes and changes["email"]:
        email = clean_lead_email(changes["email"])
        if not email:
            raise HTTPException(status_code=400, detail="Enter a valid email address.")
        changes["email"] = email
    if "company_name" in changes and not clean_optional(changes["company_name"]):
        raise HTTPException(status_code=400, detail="company_name cannot be empty")

    for field, value in changes.items():
        if isinstance(value, str) or value is None:
            value = clip(value, field) if field in LEAD_COLUMN_LIMITS else value
        setattr(lead, field, value)
    db.commit()
    db.refresh(lead)
    record_audit(db, "lead.updated", actor=getattr(request.state, "principal", None), entity_type="lead",
                 entity_id=lead.id, summary=f"Updated {lead.company_name}", details=changes, request=request)
    return {"status": "success", "data": serialize_lead(lead)}


def _delete_leads(db: Session, leads: list[Lead]) -> int:
    lead_ids = [lead.id for lead in leads]
    if not lead_ids:
        return 0
    # These relationships have no ORM cascade; detach/remove them so the delete
    # succeeds on PostgreSQL's foreign keys while preserving call history.
    db.query(CallLog).filter(CallLog.lead_id.in_(lead_ids)).update({CallLog.lead_id: None}, synchronize_session=False)
    db.query(CallScript).filter(CallScript.lead_id.in_(lead_ids)).delete(synchronize_session=False)
    db.query(DiscoveredLead).filter(DiscoveredLead.imported_lead_id.in_(lead_ids)).update(
        {DiscoveredLead.imported_lead_id: None}, synchronize_session=False
    )
    for lead in leads:
        db.delete(lead)
    db.commit()
    return len(lead_ids)


@router.delete("/{lead_id}")
def delete_lead(lead_id: int, request: Request, db: Session = Depends(get_db)):
    lead = get_lead_or_404(lead_id, db)
    name = lead.company_name
    _delete_leads(db, [lead])
    record_audit(db, "lead.deleted", actor=getattr(request.state, "principal", None), entity_type="lead",
                 entity_id=lead_id, summary=f"Deleted lead {name}", request=request)
    return {"status": "success", "deleted": 1}


def _bulk_leads(db: Session, payload: LeadBulkAction) -> list[Lead]:
    ids = list(dict.fromkeys(payload.lead_ids))
    if not ids:
        raise HTTPException(status_code=400, detail="Select at least one lead.")
    if len(ids) > MAX_BULK:
        raise HTTPException(status_code=400, detail=f"Bulk actions are limited to {MAX_BULK} leads at a time.")
    return db.query(Lead).filter(Lead.id.in_(ids)).all()


@router.post("/bulk-delete")
def bulk_delete_leads(payload: LeadBulkAction, request: Request, db: Session = Depends(get_db)):
    leads = _bulk_leads(db, payload)
    deleted = _delete_leads(db, leads)
    record_audit(db, "lead.bulk_deleted", actor=getattr(request.state, "principal", None), entity_type="lead",
                 summary=f"Deleted {deleted} leads", details={"lead_ids": [lead_id for lead_id in payload.lead_ids][:MAX_BULK]},
                 request=request)
    return {"status": "success", "deleted": deleted}


@router.post("/bulk-update")
def bulk_update_leads(payload: LeadBulkAction, request: Request, db: Session = Depends(get_db)):
    if payload.status is None and payload.do_not_call is None:
        raise HTTPException(status_code=400, detail="Choose a status or do-not-call value to apply.")
    if payload.status is not None and payload.status not in EDITABLE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {', '.join(sorted(EDITABLE_STATUSES))}")
    leads = _bulk_leads(db, payload)
    for lead in leads:
        if payload.status is not None:
            lead.status = payload.status
        if payload.do_not_call is not None:
            lead.do_not_call = payload.do_not_call
    db.commit()
    record_audit(db, "lead.bulk_updated", actor=getattr(request.state, "principal", None), entity_type="lead",
                 summary=f"Updated {len(leads)} lead{'' if len(leads) == 1 else 's'}",
                 details={"status": payload.status, "do_not_call": payload.do_not_call}, request=request)
    return {"status": "success", "updated": len(leads)}
