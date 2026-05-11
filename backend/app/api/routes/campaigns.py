from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Campaign, EmailDraft, Lead
from app.schemas.campaign_schema import CampaignCreate

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
