import json
import re

from google import genai
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import EmailDraft, ReplyResponseDraft
from app.services.ai_service import clean_value
from app.utils.time_utils import utc_now

ACTIVE_RESPONSE_DRAFT_STATUSES = ("generated", "approved")
FALLBACK_RESPONSE_MODEL = "fallback-template"
FALLBACK_RESPONSE_ERROR = "Gemini response draft generation failed. Fallback draft was used."


class ReplyResponseRuleError(ValueError):
    pass


class ReplyResponseSaveError(RuntimeError):
    pass


def _truncate(value, max_length: int | None = None):
    text = clean_value(value)

    if max_length and len(text) > max_length:
        return text[:max_length].rstrip()

    return text


def _lead_display_name(email_draft: EmailDraft):
    lead = email_draft.lead

    return (
        clean_value(lead.contact_name if lead else "")
        or clean_value(lead.company_name if lead else "")
        or "there"
    )


def _build_subject(email_draft: EmailDraft):
    subject = clean_value(email_draft.subject) or "Your reply"

    if subject.lower().startswith("re:"):
        return subject[:255]

    return f"Re: {subject}"[:255]


def _strip_markdown_code_block(text: str):
    cleaned_text = clean_value(text)
    code_block_match = re.search(r"```(?:json)?\s*(.*?)\s*```", cleaned_text, flags=re.IGNORECASE | re.DOTALL)

    if code_block_match:
        return code_block_match.group(1).strip()

    return cleaned_text


def extract_first_json_object(text: str):
    cleaned_text = _strip_markdown_code_block(text)

    try:
        parsed = json.loads(cleaned_text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    decoder = json.JSONDecoder()

    for match in re.finditer(r"\{", cleaned_text):
        try:
            parsed, _ = decoder.raw_decode(cleaned_text[match.start():])
        except json.JSONDecodeError:
            continue

        if isinstance(parsed, dict):
            return parsed

    raise ValueError("No valid JSON object found in Gemini response draft output.")


def fallback_response_draft(email_draft: EmailDraft):
    name = _lead_display_name(email_draft)
    intent = clean_value(email_draft.reply_intent) or "Neutral"
    offer = clean_value(email_draft.campaign.offer if email_draft.campaign else "")
    offer_sentence = (
        f"Our system helps teams with {offer}."
        if offer
        else "Our system helps teams make training and onboarding easier to manage."
    )

    if intent == "Asked for Pricing":
        body = (
            f"Hi {name},\n\n"
            "Thanks for your reply. Pricing usually depends on the team size, use case, and the level of setup needed, "
            "so I do not want to guess without a little more context.\n\n"
            "I can share a short demo overview and discuss the right pricing range after understanding your requirements. "
            "Would a brief call be convenient this week?\n\n"
            "Regards,\nTeam"
        )
    elif intent in {"Asked for More Info", "Interested"}:
        body = (
            f"Hi {name},\n\n"
            f"Thanks for your reply. {offer_sentence} It can help with onboarding, SOP training, quizzes, and visibility into employee progress.\n\n"
            "I can share a short overview and walk you through how it would fit your team. Would you like to schedule a brief demo?\n\n"
            "Regards,\nTeam"
        )
    elif intent == "Meeting Request":
        body = (
            f"Hi {name},\n\n"
            "Thanks for your reply. Happy to set up a short call to discuss this.\n\n"
            "Please share a suitable time, or I can send across a few available slots for this week.\n\n"
            "Regards,\nTeam"
        )
    elif intent in {"Not Interested", "Unsubscribe"}:
        body = (
            f"Hi {name},\n\n"
            "Thanks for letting me know. I understand, and we will not follow up further on this.\n\n"
            "Regards,\nTeam"
        )
    elif intent == "Wrong Person":
        body = (
            f"Hi {name},\n\n"
            "Thanks for letting me know. Would you be able to point me to the right HR, training, or operations contact for this discussion?\n\n"
            "If not, no problem at all.\n\n"
            "Regards,\nTeam"
        )
    elif intent == "Out of Office":
        body = (
            f"Hi {name},\n\n"
            "Thanks for the update. I will follow up later when the timing is better.\n\n"
            "Regards,\nTeam"
        )
    else:
        body = (
            f"Hi {name},\n\n"
            "Thanks for your reply. Could you let me know what information would be most helpful for you at this stage?\n\n"
            "I can keep it brief and share only the details that are relevant.\n\n"
            "Regards,\nTeam"
        )

    return {
        "subject": _build_subject(email_draft),
        "body": body,
    }


def build_response_prompt(email_draft: EmailDraft):
    campaign = email_draft.campaign
    lead = email_draft.lead

    return f"""
You are an AI sales assistant.
Write a professional reply email draft based on the lead's reply.
Keep it concise, helpful, and non-pushy.
Do not invent exact pricing if pricing data is not available.
If the lead asks for pricing, explain that pricing depends on requirements and suggest a short call or ask for details.
If the lead asks for more info, briefly explain product value and offer a demo.
If the lead asks for meeting, suggest sharing available slots.
If the lead is not interested or unsubscribes, generate a polite acknowledgement and do not push.
If wrong person, ask politely for the right contact.
If out of office, draft a short acknowledgement and mention follow-up later.
Do not claim attachments or links are included unless available.
Do not send the email. Only draft it for human approval.
Keep the response draft under 160 words.
Return only JSON.

Campaign:
- campaign_name: {clean_value(campaign.campaign_name if campaign else "")}
- industry: {clean_value(campaign.industry if campaign else "")}
- location: {clean_value(campaign.location if campaign else "")}
- target_role: {clean_value(campaign.target_role if campaign else "")}
- offer: {clean_value(campaign.offer if campaign else "")}

Lead:
- company_name: {clean_value(lead.company_name if lead else "")}
- industry: {clean_value(lead.industry if lead else "")}
- location: {clean_value(lead.location if lead else "")}
- contact_name: {clean_value(lead.contact_name if lead else "")}
- contact_role: {clean_value(lead.contact_role if lead else "")}
- email: {clean_value(lead.email if lead else "")}

Original email:
- subject: {clean_value(email_draft.subject)}
- body: {clean_value(email_draft.body)}

Reply:
- reply_snippet: {clean_value(email_draft.reply_snippet)}
- replied_at: {clean_value(email_draft.replied_at)}

Classification:
- reply_intent: {clean_value(email_draft.reply_intent)}
- reply_sentiment: {clean_value(email_draft.reply_sentiment)}
- reply_priority: {clean_value(email_draft.reply_priority)}
- reply_summary: {clean_value(email_draft.reply_summary)}
- reply_next_action: {clean_value(email_draft.reply_next_action)}
- reply_suggested_response_direction: {clean_value(email_draft.reply_suggested_response_direction)}

Expected JSON:
{{
  "subject": "...",
  "body": "..."
}}
""".strip()


def parse_response_draft_output(response_text: str, email_draft: EmailDraft):
    fallback = fallback_response_draft(email_draft)
    parsed_response = extract_first_json_object(response_text)
    subject = _truncate(parsed_response.get("subject"), 255) or fallback["subject"]
    body = _truncate(parsed_response.get("body")) or fallback["body"]

    return {
        "subject": subject,
        "body": body,
    }


def get_active_response_draft(db: Session, email_draft_id: int):
    return (
        db.query(ReplyResponseDraft)
        .filter(
            ReplyResponseDraft.original_email_draft_id == email_draft_id,
            ReplyResponseDraft.status.in_(ACTIVE_RESPONSE_DRAFT_STATUSES),
        )
        .order_by(ReplyResponseDraft.created_at.desc(), ReplyResponseDraft.id.desc())
        .first()
    )


def _reject_active_response_drafts(db: Session, email_draft_id: int):
    active_drafts = (
        db.query(ReplyResponseDraft)
        .filter(
            ReplyResponseDraft.original_email_draft_id == email_draft_id,
            ReplyResponseDraft.status.in_(ACTIVE_RESPONSE_DRAFT_STATUSES),
        )
        .all()
    )
    now = utc_now()

    for response_draft in active_drafts:
        response_draft.status = "rejected"
        response_draft.rejected_at = now


def _ensure_generation_allowed(email_draft: EmailDraft):
    if email_draft.status != "replied":
        raise ReplyResponseRuleError("Only replied emails can have response drafts.")

    if not clean_value(email_draft.reply_snippet):
        raise ReplyResponseRuleError("No reply text available for response draft generation.")

    if not clean_value(email_draft.reply_intent):
        raise ReplyResponseRuleError("Please classify the reply before generating a response draft.")


def _save_response_draft(db: Session, response_draft: ReplyResponseDraft):
    try:
        db.add(response_draft)
        db.commit()
        db.refresh(response_draft)
    except SQLAlchemyError as exc:
        db.rollback()
        raise ReplyResponseSaveError("Response draft could not be saved.") from exc


def generate_response_draft_for_reply(db: Session, email_draft: EmailDraft, force: bool = False) -> dict:
    _ensure_generation_allowed(email_draft)

    existing_response_draft = get_active_response_draft(db, email_draft.id)

    if existing_response_draft and not force:
        return {
            "created": False,
            "message": "Existing response draft returned",
            "response_draft": existing_response_draft,
        }

    if force and existing_response_draft:
        _reject_active_response_drafts(db, email_draft.id)

    model_used = settings.GEMINI_MODEL
    send_error = None

    if settings.GEMINI_API_KEY:
        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=build_response_prompt(email_draft),
            )
            response_text = clean_value(getattr(response, "text", ""))
            if not response_text:
                raise ValueError("Gemini response draft output was empty.")
            generated_response = parse_response_draft_output(response_text, email_draft)
        except Exception:
            generated_response = fallback_response_draft(email_draft)
            model_used = FALLBACK_RESPONSE_MODEL
            send_error = FALLBACK_RESPONSE_ERROR
    else:
        generated_response = fallback_response_draft(email_draft)
        model_used = FALLBACK_RESPONSE_MODEL
        send_error = FALLBACK_RESPONSE_ERROR

    now = utc_now()
    response_draft = ReplyResponseDraft(
        original_email_draft_id=email_draft.id,
        campaign_id=email_draft.campaign_id,
        lead_id=email_draft.lead_id,
        subject=generated_response["subject"][:255],
        body=generated_response["body"],
        status="generated",
        intent_used=email_draft.reply_intent,
        next_action_used=email_draft.reply_next_action,
        model_used=model_used,
        generated_at=now,
        send_error=send_error,
    )

    _save_response_draft(db, response_draft)

    return {
        "created": True,
        "message": "Response draft generated successfully",
        "response_draft": response_draft,
    }
