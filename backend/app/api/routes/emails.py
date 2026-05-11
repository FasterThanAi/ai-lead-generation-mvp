from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from app.db.database import get_db
from app.db.models import EmailDraft
from app.schemas.email_schema import EmailDraftUpdate

router = APIRouter(
    prefix="/emails",
    tags=["Email Drafts"]
)

ALLOWED_EMAIL_STATUSES = {"generated", "approved", "rejected", "failed", "replied"}


def serialize_email_draft(email_draft: EmailDraft):
    lead = email_draft.lead

    return {
        "id": email_draft.id,
        "campaign_id": email_draft.campaign_id,
        "lead_id": email_draft.lead_id,
        "subject": email_draft.subject,
        "body": email_draft.body,
        "status": email_draft.status,
        "ai_model": email_draft.ai_model,
        "sent_at": email_draft.sent_at,
        "send_error": email_draft.send_error,
        "gmail_message_id": email_draft.gmail_message_id,
        "reply_checked_at": email_draft.reply_checked_at,
        "reply_message_id": email_draft.reply_message_id,
        "reply_snippet": email_draft.reply_snippet,
        "replied_at": email_draft.replied_at,
        "created_at": email_draft.created_at,
        "lead_company_name": lead.company_name if lead else None,
        "lead_contact_name": lead.contact_name if lead else None,
        "lead_contact_role": lead.contact_role if lead else None,
        "lead_email": lead.email if lead else None,
    }


def email_draft_query(db: Session):
    return db.query(EmailDraft).options(joinedload(EmailDraft.lead))


@router.get("/")
def get_email_drafts(db: Session = Depends(get_db)):
    email_drafts = (
        email_draft_query(db)
        .order_by(EmailDraft.created_at.desc())
        .all()
    )

    return {
        "status": "success",
        "data": [serialize_email_draft(email_draft) for email_draft in email_drafts]
    }


@router.get("/campaign/{campaign_id}")
def get_campaign_email_drafts(campaign_id: int, db: Session = Depends(get_db)):
    email_drafts = (
        email_draft_query(db)
        .filter(EmailDraft.campaign_id == campaign_id)
        .order_by(EmailDraft.created_at.desc())
        .all()
    )

    return {
        "status": "success",
        "data": [serialize_email_draft(email_draft) for email_draft in email_drafts]
    }


@router.get("/lead/{lead_id}")
def get_lead_email_drafts(lead_id: int, db: Session = Depends(get_db)):
    email_drafts = (
        email_draft_query(db)
        .filter(EmailDraft.lead_id == lead_id)
        .order_by(EmailDraft.created_at.desc())
        .all()
    )

    return {
        "status": "success",
        "data": [serialize_email_draft(email_draft) for email_draft in email_drafts]
    }


@router.patch("/{email_id}/status")
def update_email_draft_status(
    email_id: int,
    email_update: EmailDraftUpdate,
    db: Session = Depends(get_db)
):
    if email_update.status not in ALLOWED_EMAIL_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Status must be one of: generated, approved, rejected, failed, replied"
        )

    email_draft = (
        email_draft_query(db)
        .filter(EmailDraft.id == email_id)
        .first()
    )

    if not email_draft:
        raise HTTPException(
            status_code=404,
            detail=f"Email draft with id {email_id} was not found"
        )

    if email_draft.status in {"sending", "sent", "replied"}:
        raise HTTPException(
            status_code=400,
            detail="Sending, sent, or replied email drafts cannot be manually updated."
        )

    if email_update.status == "replied":
        raise HTTPException(
            status_code=400,
            detail="Use reply checking to mark sent drafts as replied."
        )

    email_draft.status = email_update.status

    try:
        db.commit()
        db.refresh(email_draft)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Email status could not be updated."
        ) from exc

    return {
        "status": "success",
        "message": "Email status updated successfully",
        "data": serialize_email_draft(email_draft)
    }
