from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Campaign
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