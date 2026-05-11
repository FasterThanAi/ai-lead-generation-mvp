from datetime import datetime

from google import genai
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import EmailDraft, FollowUpDraft
from app.services.ai_service import (
    AIConfigurationError,
    AIServiceError,
    clean_value,
    extract_json_from_text,
)

MAX_FOLLOW_UPS_PER_EMAIL = 2
UNSENT_FOLLOW_UP_STATUSES = {"generated", "approved", "rejected", "sending", "failed"}


class FollowUpRuleError(ValueError):
    pass


class FollowUpSaveError(RuntimeError):
    pass


def _has_reply(original_email_draft: EmailDraft):
    return (
        original_email_draft.status == "replied"
        or bool(original_email_draft.replied_at)
        or bool(original_email_draft.reply_message_id)
    )


def _ensure_follow_up_allowed(original_email_draft: EmailDraft):
    if _has_reply(original_email_draft):
        raise FollowUpRuleError("Cannot generate follow-up because this lead has already replied.")

    if original_email_draft.status != "sent":
        raise FollowUpRuleError("Only sent emails can receive follow-ups.")

    lead = original_email_draft.lead
    lead_email = clean_value(lead.email if lead else "")

    if not lead_email:
        raise FollowUpRuleError("Lead email is missing.")


def _get_follow_ups_for_original(db: Session, original_email_draft_id: int):
    return (
        db.query(FollowUpDraft)
        .filter(FollowUpDraft.original_email_draft_id == original_email_draft_id)
        .order_by(FollowUpDraft.follow_up_number.asc(), FollowUpDraft.created_at.asc())
        .all()
    )


def _get_latest_follow_up(follow_ups: list[FollowUpDraft]):
    if not follow_ups:
        return None

    return sorted(
        follow_ups,
        key=lambda follow_up: (follow_up.follow_up_number or 0, follow_up.created_at or datetime.min, follow_up.id or 0),
        reverse=True,
    )[0]


def _get_target_follow_up_number(follow_ups: list[FollowUpDraft], force: bool):
    latest_follow_up = _get_latest_follow_up(follow_ups)

    if not latest_follow_up:
        return 1, None

    if latest_follow_up.status in UNSENT_FOLLOW_UP_STATUSES:
        if force:
            return latest_follow_up.follow_up_number, latest_follow_up

        return latest_follow_up.follow_up_number, latest_follow_up

    next_follow_up_number = (latest_follow_up.follow_up_number or 0) + 1

    if next_follow_up_number > MAX_FOLLOW_UPS_PER_EMAIL:
        raise FollowUpRuleError("Maximum follow-up limit reached.")

    return next_follow_up_number, None


def build_fallback_follow_up(campaign, lead, original_email_draft, follow_up_number: int):
    company_name = clean_value(lead.company_name) or "your company"
    contact_name = clean_value(lead.contact_name)
    greeting = f"Hi {contact_name}," if contact_name else "Hi Team,"
    offer = clean_value(campaign.offer)
    subject = clean_value(original_email_draft.subject)

    body_offer = (
        f"I wanted to quickly follow up on my earlier note about {offer}."
        if offer
        else "I wanted to quickly follow up on my earlier note."
    )
    cta = (
        "Would it be worth a short conversation to see if this is relevant for "
        f"{company_name}?"
    )

    return {
        "subject": subject if subject.lower().startswith("re:") else f"Re: {subject or f'Quick follow-up for {company_name}'}",
        "body": (
            f"{greeting}\n\n"
            f"{body_offer} I know timing can be busy, so I wanted to check once more.\n\n"
            f"{cta}\n\n"
            "Regards,\n"
            "Team"
        ),
    }


def build_follow_up_prompt(campaign, lead, original_email_draft, follow_up_number: int):
    return f"""
Generate one polite B2B follow-up email draft using only the data below.

Campaign data:
- Campaign name: {clean_value(campaign.campaign_name)}
- Offer: {clean_value(campaign.offer)}

Lead data:
- Company name: {clean_value(lead.company_name)}
- Contact name: {clean_value(lead.contact_name)}
- Contact role: {clean_value(lead.contact_role)}
- Email: {clean_value(lead.email)}

Original email:
- Subject: {clean_value(original_email_draft.subject)}
- Body: {clean_value(original_email_draft.body)}

Follow-up number: {follow_up_number}

Rules:
- Write a polite follow-up because there has been no reply yet.
- Reference the original email naturally.
- Keep the email under 120 words.
- Keep it short, calm, and not spammy.
- Include one simple CTA.
- Do not claim false facts.
- Do not invent achievements, clients, revenue, awards, partnerships, or facts about the lead company.
- Do not use emojis.
- Return valid JSON only with this exact format:
{{
  "subject": "...",
  "body": "..."
}}
""".strip()


def _parse_follow_up_response(response_text: str, fallback: dict):
    cleaned_text = clean_value(response_text)

    if not cleaned_text:
        return fallback

    try:
        parsed_response = extract_json_from_text(cleaned_text)
        subject = clean_value(parsed_response.get("subject"))
        body = clean_value(parsed_response.get("body"))

        if subject and body:
            return {
                "subject": subject[:255],
                "body": body,
            }
    except Exception:
        pass

    subject = fallback["subject"]
    body = cleaned_text

    if cleaned_text.lower().startswith("subject:"):
        lines = [line.strip() for line in cleaned_text.splitlines() if line.strip()]
        subject_line = next((line for line in lines if line.lower().startswith("subject:")), "")
        body_lines = [line for line in lines if line != subject_line and not line.lower().startswith("body:")]

        if subject_line:
            subject = clean_value(subject_line.split(":", 1)[1]) or subject
        if body_lines:
            body = "\n".join(body_lines)

    return {
        "subject": subject[:255],
        "body": body or fallback["body"],
    }


def generate_follow_up_content(campaign, lead, original_email_draft, follow_up_number: int):
    fallback = build_fallback_follow_up(campaign, lead, original_email_draft, follow_up_number)

    if not settings.GEMINI_API_KEY:
        raise AIConfigurationError("Gemini API key is not configured.")

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    prompt = build_follow_up_prompt(campaign, lead, original_email_draft, follow_up_number)

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )
        response_text = clean_value(getattr(response, "text", ""))
    except Exception as exc:
        raise AIServiceError("Gemini follow-up generation failed. Please try again.") from exc

    return _parse_follow_up_response(response_text, fallback)


def _save_follow_up(db: Session, follow_up_draft: FollowUpDraft):
    try:
        db.add(follow_up_draft)
        db.commit()
        db.refresh(follow_up_draft)
    except SQLAlchemyError as exc:
        db.rollback()
        raise FollowUpSaveError("Follow-up draft could not be saved.") from exc


def generate_follow_up_for_draft(
    db: Session,
    original_email_draft: EmailDraft,
    force: bool = False,
) -> dict:
    _ensure_follow_up_allowed(original_email_draft)

    follow_ups = _get_follow_ups_for_original(db, original_email_draft.id)
    target_follow_up_number, existing_follow_up = _get_target_follow_up_number(follow_ups, force)

    if existing_follow_up and not force:
        return {
            "created": False,
            "message": "Existing follow-up draft returned",
            "follow_up_draft": existing_follow_up,
        }

    if target_follow_up_number > MAX_FOLLOW_UPS_PER_EMAIL:
        raise FollowUpRuleError("Maximum follow-up limit reached.")

    campaign = original_email_draft.campaign
    lead = original_email_draft.lead
    generated_email = generate_follow_up_content(
        campaign,
        lead,
        original_email_draft,
        target_follow_up_number,
    )
    now = datetime.utcnow()

    if existing_follow_up and force:
        existing_follow_up.subject = generated_email["subject"]
        existing_follow_up.body = generated_email["body"]
        existing_follow_up.status = "generated"
        existing_follow_up.model_used = settings.GEMINI_MODEL
        existing_follow_up.generated_at = now
        existing_follow_up.approved_at = None
        existing_follow_up.rejected_at = None
        existing_follow_up.send_error = None
        follow_up_draft = existing_follow_up
    else:
        follow_up_draft = FollowUpDraft(
            original_email_draft_id=original_email_draft.id,
            campaign_id=original_email_draft.campaign_id,
            lead_id=original_email_draft.lead_id,
            follow_up_number=target_follow_up_number,
            subject=generated_email["subject"],
            body=generated_email["body"],
            status="generated",
            model_used=settings.GEMINI_MODEL,
            generated_at=now,
        )

    _save_follow_up(db, follow_up_draft)

    return {
        "created": True,
        "message": "Follow-up draft generated",
        "follow_up_draft": follow_up_draft,
    }
