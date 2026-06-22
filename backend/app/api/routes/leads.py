import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.db.database import get_db
from app.db.models import Campaign, Lead
from app.schemas.lead_schema import LeadCreate
from app.services.lead_research_service import (
    LeadResearchError,
    research_lead,
    serialize_research_result,
)
from app.services.scraper_service import find_emails_from_website

router = APIRouter(
    prefix="/leads",
    tags=["Leads"]
)


def clean_optional(value):
    if value is None:
        return None

    value = str(value).strip()
    return value or None


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
    saved_email = lead.email

    if found_emails:
        if not clean_optional(lead.email):
            lead.email = found_emails[0]

        lead.status = "email_found"
        saved_email = lead.email
    elif scraper_error:
        lead.status = "extraction_failed"
    else:
        lead.status = "email_not_found"

    return saved_email


@router.post("/create")
def create_lead(lead: LeadCreate, db: Session = Depends(get_db)):
    get_campaign_or_404(lead.campaign_id, db)

    company_name = clean_optional(lead.company_name)

    if not company_name:
        raise HTTPException(
            status_code=400,
            detail="company_name is required"
        )

    # Check for duplicate by website (normalized)
    website = clean_optional(lead.website)
    if website:
        existing = db.query(Lead).filter(
            Lead.campaign_id == lead.campaign_id,
            Lead.website == website.lower()
        ).first()
        if existing:
            return {
                "status": "skipped",
                "message": "Lead already exists",
                "lead_id": existing.id,
                "skipped": True
            }

    # Check for duplicate by phone (if no website)
    phone = clean_optional(getattr(lead, "phone", None))
    if phone and not website:
        existing = db.query(Lead).filter(
            Lead.campaign_id == lead.campaign_id,
            Lead.phone == phone
        ).first()
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
        industry=clean_optional(lead.industry),
        location=clean_optional(lead.location),
        contact_name=clean_optional(lead.contact_name),
        contact_role=clean_optional(lead.contact_role),
        email=clean_optional(lead.email),
        phone=phone,
        source_url=clean_optional(getattr(lead, "source_url", None)),
        profile_url=clean_optional(getattr(lead, "profile_url", None)),
        source=clean_optional(lead.source) or "Manual",
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
        writer.writerow([
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
            lead.ai_score or "",
            lead.ai_priority or "",
            lead.created_at or ""
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=campaign_{campaign_id}_leads.csv"
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
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    get_campaign_or_404(campaign_id, db)

    contents = await file.read()

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="CSV file is empty"
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

    leads_to_insert = []

    for row in reader:
        normalized_row = {
            key.strip(): value
            for key, value in row.items()
            if key is not None
        }

        company_name = clean_optional(normalized_row.get("company_name"))

        if not company_name:
            continue

        leads_to_insert.append(
            Lead(
                campaign_id=campaign_id,
                company_name=company_name,
                website=clean_optional(normalized_row.get("website")),
                industry=clean_optional(normalized_row.get("industry")),
                location=clean_optional(normalized_row.get("location")),
                contact_name=clean_optional(normalized_row.get("contact_name")),
                contact_role=clean_optional(normalized_row.get("contact_role")),
                email=clean_optional(normalized_row.get("email")),
                phone=clean_optional(normalized_row.get("phone")),
                source_url=clean_optional(normalized_row.get("source_url")),
                profile_url=clean_optional(normalized_row.get("profile_url")),
                source=clean_optional(normalized_row.get("source")) or "CSV",
            )
        )

    if not leads_to_insert:
        raise HTTPException(
            status_code=400,
            detail="CSV has no valid rows with company_name"
        )

    db.add_all(leads_to_insert)
    db.commit()

    return {
        "status": "success",
        "message": "CSV uploaded successfully",
        "inserted_count": len(leads_to_insert)
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

    extraction_result = find_emails_from_website(lead.website)
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

        if not website:
            lead.status = "website_missing"
            summary["website_missing"] += 1
        elif clean_optional(lead.email):
            lead.status = "email_found"
            summary["email_found"] += 1
        else:
            try:
                extraction_result = find_emails_from_website(website)
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
