from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.db.database import get_db
from app.db.models import Campaign, EmailDraft, FollowUpDraft, Lead

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


def serialize_recent_reply(email_draft: EmailDraft):
    lead = email_draft.lead

    return {
        "email_draft_id": email_draft.id,
        "lead_id": email_draft.lead_id,
        "company_name": lead.company_name if lead else None,
        "lead_email": lead.email if lead else None,
        "reply_snippet": email_draft.reply_snippet,
        "replied_at": email_draft.replied_at,
    }


def serialize_recent_follow_up(follow_up: FollowUpDraft):
    lead = follow_up.lead

    return {
        "follow_up_id": follow_up.id,
        "original_email_draft_id": follow_up.original_email_draft_id,
        "lead_id": follow_up.lead_id,
        "company_name": lead.company_name if lead else None,
        "lead_email": lead.email if lead else None,
        "follow_up_number": follow_up.follow_up_number,
        "status": follow_up.status,
        "sent_at": follow_up.sent_at,
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
    draft_count = count_rows(db, EmailDraft, EmailDraft.campaign_id == campaign_id)
    generated_count = count_rows(
        db,
        EmailDraft,
        EmailDraft.campaign_id == campaign_id,
        EmailDraft.status == "generated",
    )
    approved_count = count_rows(
        db,
        EmailDraft,
        EmailDraft.campaign_id == campaign_id,
        EmailDraft.status == "approved",
    )
    rejected_count = count_rows(
        db,
        EmailDraft,
        EmailDraft.campaign_id == campaign_id,
        EmailDraft.status == "rejected",
    )
    sent_count = count_rows(
        db,
        EmailDraft,
        EmailDraft.campaign_id == campaign_id,
        EmailDraft.status.in_(("sent", "replied")),
    )
    failed_count = count_rows(
        db,
        EmailDraft,
        EmailDraft.campaign_id == campaign_id,
        EmailDraft.status == "failed",
    )
    replied_count = count_rows(
        db,
        EmailDraft,
        EmailDraft.campaign_id == campaign_id,
        EmailDraft.status == "replied",
    )
    needs_follow_up_count = count_rows(
        db,
        EmailDraft,
        EmailDraft.campaign_id == campaign_id,
        EmailDraft.status == "sent",
    )
    recent_replies = (
        db.query(EmailDraft)
        .options(joinedload(EmailDraft.lead))
        .filter(
            EmailDraft.campaign_id == campaign_id,
            EmailDraft.status == "replied",
        )
        .order_by(EmailDraft.replied_at.desc(), EmailDraft.updated_at.desc(), EmailDraft.id.desc())
        .limit(5)
        .all()
    )
    followups_generated_count = count_rows(
        db,
        FollowUpDraft,
        FollowUpDraft.campaign_id == campaign_id,
        FollowUpDraft.status == "generated",
    )
    followups_approved_count = count_rows(
        db,
        FollowUpDraft,
        FollowUpDraft.campaign_id == campaign_id,
        FollowUpDraft.status == "approved",
    )
    followups_sent_count = count_rows(
        db,
        FollowUpDraft,
        FollowUpDraft.campaign_id == campaign_id,
        FollowUpDraft.status == "sent",
    )
    followups_failed_count = count_rows(
        db,
        FollowUpDraft,
        FollowUpDraft.campaign_id == campaign_id,
        FollowUpDraft.status == "failed",
    )
    followups_pending_count = count_rows(
        db,
        FollowUpDraft,
        FollowUpDraft.campaign_id == campaign_id,
        FollowUpDraft.status.in_(("generated", "approved", "sending")),
    )
    recent_followups = (
        db.query(FollowUpDraft)
        .options(joinedload(FollowUpDraft.lead))
        .filter(FollowUpDraft.campaign_id == campaign_id)
        .order_by(FollowUpDraft.created_at.desc(), FollowUpDraft.id.desc())
        .limit(5)
        .all()
    )

    return {
        "status": "success",
        "data": {
            "campaign_id": campaign.id,
            "campaign_name": campaign.campaign_name,
            "lead_count": lead_count,
            "draft_count": draft_count,
            "generated_count": generated_count,
            "approved_count": approved_count,
            "rejected_count": rejected_count,
            "sent_count": sent_count,
            "failed_count": failed_count,
            "replied_count": replied_count,
            "reply_rate": rate_percentage(replied_count, sent_count),
            "send_success_rate": rate_percentage(sent_count, sent_count + failed_count),
            "needs_follow_up_count": needs_follow_up_count,
            "followups_generated_count": followups_generated_count,
            "followups_approved_count": followups_approved_count,
            "followups_sent_count": followups_sent_count,
            "followups_failed_count": followups_failed_count,
            "followups_pending_count": followups_pending_count,
            "recent_replies": [
                serialize_recent_reply(email_draft)
                for email_draft in recent_replies
            ],
            "recent_followups": [
                serialize_recent_follow_up(follow_up)
                for follow_up in recent_followups
            ],
        }
    }
