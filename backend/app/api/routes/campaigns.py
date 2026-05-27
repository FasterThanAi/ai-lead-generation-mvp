from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Campaign, EmailDraft, Lead
from app.schemas.campaign_schema import CampaignCreate
from app.services.lead_research_service import research_lead

router = APIRouter(
    prefix="/campaigns",
    tags=["Campaigns"]
)

@router.post("/create")
def create_campaign(campaign: CampaignCreate, db: Session = Depends(get_db)):
    new_campaign = Campaign(
        campaign_name=campaign.campaign_name,
        industry=campaign.industry,
        location=campaign.location,
        target_role=campaign.target_role,
        offer=campaign.offer,
    )

    db.add(new_campaign)
    db.commit()
    db.refresh(new_campaign)

    return {
        "status": "success",
        "message": "Campaign created successfully",
        "campaign_id": new_campaign.id
    }

@router.get("/")
def get_campaigns(db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).all()

    return {
        "status": "success",
        "data": campaigns
    }


def serialize_campaign(campaign: Campaign):
    return {
        "id": campaign.id,
        "campaign_name": campaign.campaign_name,
        "industry": campaign.industry,
        "location": campaign.location,
        "target_role": campaign.target_role,
        "offer": campaign.offer,
        "created_at": campaign.created_at,
    }


def count_rows(db: Session, model, *filters):
    query = db.query(func.count(model.id))

    if filters:
        query = query.filter(*filters)

    return query.scalar() or 0


@router.post("/{campaign_id}/research-leads")
def research_campaign_leads(
    campaign_id: int,
    limit: int = Query(5, ge=1),
    db: Session = Depends(get_db),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()

    if not campaign:
        raise HTTPException(
            status_code=404,
            detail=f"Campaign with id {campaign_id} was not found"
        )

    effective_limit = min(limit, 10)
    leads = (
        db.query(Lead)
        .filter(
            Lead.campaign_id == campaign_id,
            Lead.research_status.in_(("not_researched", "failed")),
        )
        .order_by(Lead.created_at.desc(), Lead.id.desc())
        .limit(effective_limit)
        .all()
    )
    results = []
    researched_count = 0
    failed_count = 0

    for lead in leads:
        try:
            result = research_lead(db, lead.id)
            researched_count += 1 if result.get("research_status") == "researched" else 0
            failed_count += 1 if result.get("research_status") == "failed" else 0
            results.append({
                "lead_id": lead.id,
                "company_name": lead.company_name,
                "research_status": result.get("research_status"),
                "research_confidence": result.get("research_confidence"),
                "error": result.get("research_error"),
            })
        except Exception:
            failed_count += 1
            results.append({
                "lead_id": lead.id,
                "company_name": lead.company_name,
                "research_status": "failed",
                "error": "Lead research failed. Please try again.",
            })

    return {
        "status": "success",
        "message": "Campaign lead research completed",
        "campaign_id": campaign_id,
        "processed": len(leads),
        "researched": researched_count,
        "failed": failed_count,
        "remaining": count_rows(
            db,
            Lead,
            Lead.campaign_id == campaign_id,
            Lead.research_status.in_(("not_researched", "failed")),
        ),
        "results": results,
    }


@router.get("/{campaign_id}/summary")
def get_campaign_summary(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()

    if not campaign:
        raise HTTPException(
            status_code=404,
            detail=f"Campaign with id {campaign_id} was not found"
        )

    return {
        "status": "success",
        "data": {
            "campaign": serialize_campaign(campaign),
            "lead_count": count_rows(db, Lead, Lead.campaign_id == campaign_id),
            "researched_leads": count_rows(db, Lead, Lead.campaign_id == campaign_id, Lead.research_status == "researched"),
            "research_failed": count_rows(db, Lead, Lead.campaign_id == campaign_id, Lead.research_status == "failed"),
            "average_research_confidence": round(
                float(
                    db.query(func.avg(Lead.research_confidence))
                    .filter(
                        Lead.campaign_id == campaign_id,
                        Lead.research_confidence.isnot(None),
                    )
                    .scalar() or 0
                ),
                1,
            ),
            "emails_found": count_rows(
                db,
                Lead,
                Lead.campaign_id == campaign_id,
                Lead.email.isnot(None),
                Lead.email != "",
            ),
            "draft_count": count_rows(db, EmailDraft, EmailDraft.campaign_id == campaign_id),
            "generated_count": count_rows(
                db,
                EmailDraft,
                EmailDraft.campaign_id == campaign_id,
                EmailDraft.status == "generated",
            ),
            "approved_count": count_rows(
                db,
                EmailDraft,
                EmailDraft.campaign_id == campaign_id,
                EmailDraft.status == "approved",
            ),
            "sent_count": count_rows(
                db,
                EmailDraft,
                EmailDraft.campaign_id == campaign_id,
                EmailDraft.status.in_(("sent", "replied")),
            ),
            "failed_count": count_rows(
                db,
                EmailDraft,
                EmailDraft.campaign_id == campaign_id,
                EmailDraft.status == "failed",
            ),
            "replied_count": count_rows(
                db,
                EmailDraft,
                EmailDraft.campaign_id == campaign_id,
                EmailDraft.status == "replied",
            ),
        }
    }
