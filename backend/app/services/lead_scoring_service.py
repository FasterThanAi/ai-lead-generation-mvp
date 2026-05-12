from google import genai
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Campaign, Lead
from app.services.ai_service import clean_value, extract_json_from_text
from app.utils.time_utils import utc_now

ROLE_KEYWORDS = (
    "hr",
    "founder",
    "owner",
    "manager",
    "director",
    "operations",
    "training",
)


class LeadScoringError(RuntimeError):
    pass


def clamp_score(score):
    try:
        numeric_score = int(round(float(score)))
    except (TypeError, ValueError):
        return None

    return max(0, min(numeric_score, 100))


def get_priority_for_score(score: int):
    if score >= 80:
        return "High"
    if score >= 50:
        return "Medium"
    return "Low"


def get_qualification_for_score(score: int):
    if score >= 80:
        return "Hot"
    if score >= 60:
        return "Warm"
    if score >= 30:
        return "Cold"
    return "Not Relevant"


def contains_match(left_value, right_value):
    left = clean_value(left_value).lower()
    right = clean_value(right_value).lower()

    return bool(left and right and (left in right or right in left))


def has_target_role_match(lead_role, campaign_role):
    role_text = clean_value(lead_role).lower()

    if contains_match(lead_role, campaign_role):
        return True

    return any(keyword in role_text for keyword in ROLE_KEYWORDS)


def fallback_score_lead(campaign: Campaign, lead: Lead):
    score = 30

    if contains_match(lead.industry, campaign.industry):
        score += 25
    if has_target_role_match(lead.contact_role, campaign.target_role):
        score += 20
    if contains_match(lead.location, campaign.location):
        score += 15
    if clean_value(lead.email):
        score += 10
    if clean_value(lead.website):
        score += 10

    score = min(score, 100)
    priority = get_priority_for_score(score)
    qualification = get_qualification_for_score(score)
    company_name = clean_value(lead.company_name) or "This lead"
    campaign_offer = clean_value(campaign.offer) or "the campaign offer"

    return {
        "score": score,
        "priority": priority,
        "qualification": qualification,
        "reason": (
            f"{company_name} was scored using available fit signals such as industry, role, "
            "location, email, and website completeness."
        ),
        "outreach_angle": f"Connect the lead's role and company context to {campaign_offer}.",
        "pain_point": "The lead may need a clearer, faster way to evaluate and adopt the offered solution.",
        "recommended_cta": "Ask whether a short call would be useful to explore fit.",
    }


def build_lead_scoring_prompt(campaign: Campaign, lead: Lead):
    return f"""
You are a B2B sales lead qualification assistant.
Evaluate how well this lead fits the campaign.
Return only JSON.

Campaign:
- Campaign name: {clean_value(campaign.campaign_name)}
- Industry: {clean_value(campaign.industry)}
- Location: {clean_value(campaign.location)}
- Target role: {clean_value(campaign.target_role)}
- Offer: {clean_value(campaign.offer)}

Lead:
- Company name: {clean_value(lead.company_name)}
- Website: {clean_value(lead.website)}
- Industry: {clean_value(lead.industry)}
- Location: {clean_value(lead.location)}
- Contact name: {clean_value(lead.contact_name)}
- Contact role: {clean_value(lead.contact_role)}
- Email: {clean_value(lead.email)}
- Source: {clean_value(lead.source)}
- Status: {clean_value(lead.status)}

Rules:
- Score from 0 to 100 based on campaign fit and reachable business context.
- Priority must be High, Medium, or Low.
- Qualification must be Hot, Warm, Cold, or Not Relevant.
- Explain the score in 1-3 sentences.
- Suggest a practical outreach angle.
- Identify the likely pain point.
- Suggest a recommended CTA.
- Do not invent facts about the lead.
- Return valid JSON only with this exact shape:
{{
  "score": 0,
  "priority": "High|Medium|Low",
  "qualification": "Hot|Warm|Cold|Not Relevant",
  "reason": "...",
  "outreach_angle": "...",
  "pain_point": "...",
  "recommended_cta": "..."
}}
""".strip()


def parse_ai_scoring_response(response_text: str, campaign: Campaign, lead: Lead):
    fallback_result = fallback_score_lead(campaign, lead)

    try:
        parsed_response = extract_json_from_text(clean_value(response_text))
    except Exception as exc:
        fallback_result["warning"] = "Gemini response was not valid JSON. Fallback scoring was used."
        fallback_result["error"] = str(exc)
        return fallback_result

    score = clamp_score(parsed_response.get("score"))

    if score is None:
        fallback_result["warning"] = "Gemini response did not include a valid score. Fallback scoring was used."
        return fallback_result

    return {
        "score": score,
        "priority": get_priority_for_score(score),
        "qualification": get_qualification_for_score(score),
        "reason": clean_value(parsed_response.get("reason")) or fallback_result["reason"],
        "outreach_angle": clean_value(parsed_response.get("outreach_angle")) or fallback_result["outreach_angle"],
        "pain_point": clean_value(parsed_response.get("pain_point")) or fallback_result["pain_point"],
        "recommended_cta": clean_value(parsed_response.get("recommended_cta")) or fallback_result["recommended_cta"],
        "warning": None,
    }


def serialize_lead_score(lead: Lead):
    return {
        "lead_id": lead.id,
        "ai_score": lead.ai_score,
        "ai_priority": lead.ai_priority,
        "ai_qualification": lead.ai_qualification,
        "ai_score_reason": lead.ai_score_reason,
        "ai_outreach_angle": lead.ai_outreach_angle,
        "ai_pain_point": lead.ai_pain_point,
        "ai_recommended_cta": lead.ai_recommended_cta,
        "ai_scored_at": lead.ai_scored_at,
        "ai_model_used": lead.ai_model_used,
        "ai_score_error": lead.ai_score_error,
    }


def save_lead_score(db: Session, lead: Lead, result: dict, model_used: str | None, error_message: str | None = None):
    lead.ai_score = result["score"]
    lead.ai_priority = result["priority"]
    lead.ai_qualification = result["qualification"]
    lead.ai_score_reason = result["reason"]
    lead.ai_outreach_angle = result["outreach_angle"]
    lead.ai_pain_point = result["pain_point"]
    lead.ai_recommended_cta = result["recommended_cta"]
    lead.ai_scored_at = utc_now()
    lead.ai_model_used = model_used
    lead.ai_score_error = error_message or result.get("warning")

    try:
        db.commit()
        db.refresh(lead)
    except SQLAlchemyError as exc:
        db.rollback()
        raise LeadScoringError("Lead score could not be saved.") from exc


def score_lead_with_ai(db: Session, lead: Lead, campaign: Campaign, force: bool = False) -> dict:
    if lead.ai_score is not None and not force:
        return {
            "created": False,
            "message": "Existing lead score returned",
            "data": serialize_lead_score(lead),
        }

    result = None
    model_used = settings.GEMINI_MODEL
    error_message = None

    if settings.GEMINI_API_KEY:
        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=build_lead_scoring_prompt(campaign, lead),
            )
            result = parse_ai_scoring_response(clean_value(getattr(response, "text", "")), campaign, lead)
        except Exception as exc:
            error_message = "Gemini lead scoring failed. Fallback scoring was used."
            result = fallback_score_lead(campaign, lead)
            result["warning"] = error_message
    else:
        error_message = "Gemini API key is not configured. Fallback scoring was used."
        result = fallback_score_lead(campaign, lead)
        result["warning"] = error_message
        model_used = None

    save_lead_score(db, lead, result, model_used=model_used, error_message=error_message)

    return {
        "created": True,
        "message": "Lead scored successfully",
        "data": serialize_lead_score(lead),
    }


def score_lead_safely(db: Session, lead: Lead, campaign: Campaign, force: bool = False) -> dict:
    try:
        return score_lead_with_ai(db, lead, campaign, force=force)
    except Exception as exc:
        lead.ai_score_error = "AI lead scoring failed. Please try again."
        lead.ai_scored_at = utc_now()

        try:
            db.commit()
            db.refresh(lead)
        except SQLAlchemyError:
            db.rollback()

        return {
            "created": False,
            "failed": True,
            "message": str(exc),
            "data": serialize_lead_score(lead),
        }
