import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Campaign, Lead
from app.schemas.lead_schema import LeadCreate

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


@router.post("/create")
def create_lead(lead: LeadCreate, db: Session = Depends(get_db)):
    get_campaign_or_404(lead.campaign_id, db)

    company_name = clean_optional(lead.company_name)

    if not company_name:
        raise HTTPException(
            status_code=400,
            detail="company_name is required"
        )

    new_lead = Lead(
        campaign_id=lead.campaign_id,
        company_name=company_name,
        website=clean_optional(lead.website),
        industry=clean_optional(lead.industry),
        location=clean_optional(lead.location),
        contact_name=clean_optional(lead.contact_name),
        contact_role=clean_optional(lead.contact_role),
        email=clean_optional(lead.email),
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
        "data": leads
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
        "data": leads
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
