import json
import re

from google import genai

from app.core.config import settings
from app.services.knowledge_service import build_knowledge_context, search_relevant_knowledge


class AIConfigurationError(RuntimeError):
    pass


class AIServiceError(RuntimeError):
    pass


def clean_value(value):
    if value is None:
        return ""

    return str(value).strip()


def build_fallback_email(campaign, lead):
    company_name = clean_value(lead.company_name) or "your company"
    greeting_name = clean_value(lead.contact_name)
    greeting = f"Hi {greeting_name}," if greeting_name else "Hi Team,"
    offer = clean_value(campaign.offer)
    context = clean_value(lead.industry) or clean_value(campaign.industry)

    context_sentence = (
        f"I wanted to reach out because {company_name} is connected to the {context} space."
        if context
        else f"I wanted to reach out to {company_name}."
    )
    offer_sentence = (
        f"We help teams with {offer}."
        if offer
        else "We help teams explore practical ways to improve their outreach and growth workflows."
    )

    return {
        "subject": f"Quick question for {company_name}",
        "body": (
            f"{greeting}\n\n"
            f"{context_sentence} {offer_sentence}\n\n"
            "Would you be open to a brief conversation this week to see if this could be useful?\n\n"
            "Regards,\n"
            "Team"
        ),
    }


def extract_json_from_text(text):
    cleaned_text = text.strip()

    if cleaned_text.startswith("```"):
        cleaned_text = re.sub(r"^```(?:json)?", "", cleaned_text, flags=re.IGNORECASE).strip()
        cleaned_text = re.sub(r"```$", "", cleaned_text).strip()

    try:
        return json.loads(cleaned_text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", cleaned_text, flags=re.DOTALL)

    if not match:
        raise ValueError("No JSON object found in Gemini response.")

    return json.loads(match.group(0))


def build_knowledge_query(campaign, lead):
    return " ".join(
        part
        for part in [
            clean_value(campaign.offer),
            clean_value(campaign.industry),
            clean_value(campaign.target_role),
            clean_value(lead.industry),
            clean_value(lead.contact_role),
            clean_value(lead.company_name),
        ]
        if part
    )


def build_prompt(campaign, lead, knowledge_context: str = ""):
    contact_name = clean_value(lead.contact_name)
    greeting_rule = (
        f'Start the email body with "Hi {contact_name},".'
        if contact_name
        else 'Start the email body with "Hi Team,".'
    )
    knowledge_section = (
        knowledge_context
        if clean_value(knowledge_context)
        else "No matching company knowledge was found."
    )

    return f"""
Generate one professional B2B cold email draft using only the data below.

Campaign data:
- Campaign name: {clean_value(campaign.campaign_name)}
- Target industry: {clean_value(campaign.industry)}
- Target location: {clean_value(campaign.location)}
- Target role: {clean_value(campaign.target_role)}
- Offer: {clean_value(campaign.offer)}

Lead data:
- Company name: {clean_value(lead.company_name)}
- Website: {clean_value(lead.website)}
- Industry: {clean_value(lead.industry)}
- Location: {clean_value(lead.location)}
- Contact name: {clean_value(lead.contact_name)}
- Contact role: {clean_value(lead.contact_role)}
- Email: {clean_value(lead.email)}

Company knowledge:
{knowledge_section}

Rules:
- Keep the email under 130 words.
- Be professional, natural, and not overly salesy.
- Mention the company name.
- Mention industry or context only if it is available in the data.
- Tailor to the contact role if it is available.
- Use saved company knowledge if it is relevant.
- Include a soft CTA.
- Do not use emojis.
- Do not make fake claims.
- Do not invent achievements, clients, revenue, awards, partnerships, or facts about the lead company.
- Do not invent product, pricing, case study, or demo details not present in the campaign data or company knowledge.
- Do not say "I noticed" unless the supporting information is explicitly available above.
- If the campaign offer is empty, use generic professional outreach without inventing an offer.
- {greeting_rule}
- Return valid JSON only with this exact format:
{{
  "subject": "...",
  "body": "..."
}}
""".strip()


def generate_cold_email(campaign, lead, db=None) -> dict:
    if not settings.GEMINI_API_KEY:
        raise AIConfigurationError("Gemini API key is not configured.")

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    knowledge_context = ""

    if db is not None:
        knowledge_entries = search_relevant_knowledge(
            db,
            build_knowledge_query(campaign, lead),
            limit=4,
        )
        knowledge_context = build_knowledge_context(knowledge_entries)

    prompt = build_prompt(campaign, lead, knowledge_context)

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )
        response_text = clean_value(getattr(response, "text", ""))
    except Exception as exc:
        raise AIServiceError("Gemini email generation failed. Please try again.") from exc

    if not response_text:
        return build_fallback_email(campaign, lead)

    try:
        parsed_response = extract_json_from_text(response_text)
    except (json.JSONDecodeError, ValueError):
        return build_fallback_email(campaign, lead)

    subject = clean_value(parsed_response.get("subject"))
    body = clean_value(parsed_response.get("body"))

    if not subject or not body:
        return build_fallback_email(campaign, lead)

    return {
        "subject": subject[:255],
        "body": body,
    }
