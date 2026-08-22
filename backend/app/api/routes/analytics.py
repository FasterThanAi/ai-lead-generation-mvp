from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Campaign, Lead

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"]
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


def serialize_top_ai_lead(lead: Lead):
    return {
        "lead_id": lead.id,
        "company_name": lead.company_name,
        "lead_email": lead.email,
        "ai_score": lead.ai_score,
        "ai_fit_score": lead.ai_fit_score,
        "ai_contact_confidence_score": lead.ai_contact_confidence_score,
        "ai_priority": lead.ai_priority,
        "ai_qualification": lead.ai_qualification,
        "ai_score_reason": lead.ai_score_reason,
        "ai_contact_confidence_reason": lead.ai_contact_confidence_reason,
        "ai_final_priority_reason": lead.ai_final_priority_reason,
    }


@router.get("/campaign/{campaign_id}")
def get_campaign_analytics(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()

    if not campaign:
        raise HTTPException(
            status_code=404,
            detail=f"Campaign with id {campaign_id} was not found"
        )

    lead_count = count_rows(db, Lead, Lead.campaign_id == campaign_id)
    scored_leads = count_rows(db, Lead, Lead.campaign_id == campaign_id, Lead.ai_score.isnot(None))
    researched_leads = count_rows(db, Lead, Lead.campaign_id == campaign_id, Lead.research_status == "researched")
    research_failed = count_rows(db, Lead, Lead.campaign_id == campaign_id, Lead.research_status == "failed")
    average_ai_score = (
        db.query(func.avg(Lead.ai_score))
        .filter(
            Lead.campaign_id == campaign_id,
            Lead.ai_score.isnot(None),
        )
        .scalar()
    )
    average_research_confidence = (
        db.query(func.avg(Lead.research_confidence))
        .filter(
            Lead.campaign_id == campaign_id,
            Lead.research_confidence.isnot(None),
        )
        .scalar()
    )
    top_ai_leads = (
        db.query(Lead)
        .filter(
            Lead.campaign_id == campaign_id,
            Lead.ai_score.isnot(None),
        )
        .order_by(Lead.ai_score.desc(), Lead.ai_scored_at.desc(), Lead.id.desc())
        .limit(5)
        .all()
    )

    return {
        "status": "success",
        "data": {
            "campaign_id": campaign.id,
            "campaign_name": campaign.campaign_name,
            "lead_count": lead_count,
            "draft_count": 0,
            "generated_count": 0,
            "approved_count": 0,
            "rejected_count": 0,
            "sent_count": 0,
            "failed_count": 0,
            "replied_count": 0,
            "classified_replies": 0,
            "high_priority_replies": 0,
            "interested_replies": 0,
            "pricing_replies": 0,
            "meeting_request_replies": 0,
            "not_interested_replies": 0,
            "unsubscribe_replies": 0,
            "wrong_person_replies": 0,
            "out_of_office_replies": 0,
            "reply_rate": 0.0,
            "send_success_rate": 0.0,
            "needs_follow_up_count": 0,
            "followups_generated_count": 0,
            "followups_approved_count": 0,
            "followups_sent_count": 0,
            "followups_failed_count": 0,
            "followups_pending_count": 0,
            "response_drafts_generated": 0,
            "response_drafts_approved": 0,
            "response_drafts_sent": 0,
            "response_drafts_failed": 0,
            "scored_leads": scored_leads,
            "unscored_leads": max(lead_count - scored_leads, 0),
            "average_ai_score": round(float(average_ai_score), 1) if average_ai_score is not None else 0.0,
            "researched_leads": researched_leads,
            "research_failed": research_failed,
            "average_research_confidence": round(float(average_research_confidence), 1) if average_research_confidence is not None else 0.0,
            "high_priority_leads": count_rows(db, Lead, Lead.campaign_id == campaign_id, Lead.ai_priority == "High"),
            "medium_priority_leads": count_rows(db, Lead, Lead.campaign_id == campaign_id, Lead.ai_priority == "Medium"),
            "low_priority_leads": count_rows(db, Lead, Lead.campaign_id == campaign_id, Lead.ai_priority == "Low"),
            "hot_leads": count_rows(db, Lead, Lead.campaign_id == campaign_id, Lead.ai_qualification == "Hot"),
            "warm_leads": count_rows(db, Lead, Lead.campaign_id == campaign_id, Lead.ai_qualification == "Warm"),
            "cold_leads": count_rows(db, Lead, Lead.campaign_id == campaign_id, Lead.ai_qualification == "Cold"),
            "not_relevant_leads": count_rows(db, Lead, Lead.campaign_id == campaign_id, Lead.ai_qualification == "Not Relevant"),
            "top_ai_leads": [
                serialize_top_ai_lead(lead)
                for lead in top_ai_leads
            ],
            "recent_replies": [],
            "recent_followups": [],
        }
    }
