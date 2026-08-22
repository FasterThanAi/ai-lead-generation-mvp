from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.db.database import get_db
from app.db.models import Campaign, Lead

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)


def count_rows(db: Session, model, *filters):
    query = db.query(func.count(model.id))

    if filters:
        query = query.filter(*filters)

    return query.scalar() or 0


def rate_percentage(numerator: int, denominator: int):
    if denominator <= 0:
        return 0.0

    return round((numerator / denominator) * 100, 1)


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


def serialize_top_ai_lead(lead: Lead):
    campaign = lead.campaign

    return {
        "lead_id": lead.id,
        "campaign_id": lead.campaign_id,
        "company_name": lead.company_name,
        "lead_email": lead.email,
        "ai_score": lead.ai_score,
        "ai_fit_score": lead.ai_fit_score,
        "ai_contact_confidence_score": lead.ai_contact_confidence_score,
        "ai_priority": lead.ai_priority,
        "ai_qualification": lead.ai_qualification,
        "campaign_name": campaign.campaign_name if campaign else None,
    }


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    average_ai_score = (
        db.query(func.avg(Lead.ai_score))
        .filter(Lead.ai_score.isnot(None))
        .scalar()
    )
    average_research_confidence = (
        db.query(func.avg(Lead.research_confidence))
        .filter(Lead.research_confidence.isnot(None))
        .scalar()
    )
    latest_campaigns = (
        db.query(Campaign)
        .order_by(Campaign.created_at.desc(), Campaign.id.desc())
        .limit(5)
        .all()
    )
    top_ai_leads = (
        db.query(Lead)
        .options(joinedload(Lead.campaign))
        .filter(Lead.ai_score.isnot(None))
        .order_by(Lead.ai_score.desc(), Lead.ai_scored_at.desc(), Lead.id.desc())
        .limit(5)
        .all()
    )

    return {
        "status": "success",
        "data": {
            "total_campaigns": count_rows(db, Campaign),
            "total_leads": count_rows(db, Lead),
            "emails_generated": 0,
            "emails_approved": 0,
            "emails_sent": 0,
            "emails_failed": 0,
            "emails_replied": 0,
            "reply_rate": 0.0,
            "total_classified_replies": 0,
            "high_priority_replies": 0,
            "interested_replies": 0,
            "pricing_replies": 0,
            "meeting_request_replies": 0,
            "total_followups_generated": 0,
            "total_followups_sent": 0,
            "total_response_drafts": 0,
            "response_drafts_sent": 0,
            "total_scored_leads": count_rows(db, Lead, Lead.ai_score.isnot(None)),
            "average_ai_score": round(float(average_ai_score), 1) if average_ai_score is not None else 0.0,
            "researched_leads": count_rows(db, Lead, Lead.research_status == "researched"),
            "research_failed": count_rows(db, Lead, Lead.research_status == "failed"),
            "average_research_confidence": round(float(average_research_confidence), 1) if average_research_confidence is not None else 0.0,
            "high_priority_leads": count_rows(db, Lead, Lead.ai_priority == "High"),
            "hot_leads": count_rows(db, Lead, Lead.ai_qualification == "Hot"),
            "gmail_connected": False,
            "latest_campaigns": [serialize_campaign(campaign) for campaign in latest_campaigns],
            "recent_email_drafts": [],
            "top_ai_leads": [serialize_top_ai_lead(lead) for lead in top_ai_leads],
        }
    }

