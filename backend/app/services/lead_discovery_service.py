import ipaddress
import json
import re
from urllib.parse import urlparse, urlunparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup
from google import genai
from requests import exceptions as request_exceptions
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.db.models import Campaign, DiscoveredLead, DiscoveryJob, Lead
from app.services.ai_service import clean_value, extract_json_from_text
from app.services.lead_research_service import research_lead
from app.utils.time_utils import utc_now

REQUEST_TIMEOUT_SECONDS = 8
MAX_RESPONSE_BYTES = 1024 * 1024
MAX_TEXT_CHARS = 10000
MAX_CONTEXT_CHARS = 900
MAX_DISCOVERY_PAGES = 20
USER_AGENT = "AI Lead Generation MVP Discovery Bot/1.0"
VALID_TARGET_TYPES = {"professor", "college", "department", "company", "startup", "student", "general"}
VALID_SOURCE_MODES = {"manual_urls", "generated_queries", "search_api_later"}
VALID_JOB_STATUSES = {"draft", "running", "completed", "failed"}
VALID_RESULT_STATUSES = {"pending", "approved", "rejected", "imported"}
FAKE_EMAIL_DOMAINS = {"example.com", "example.org", "example.net"}
GENERIC_EMAIL_PREFIXES = {"info", "contact", "admin", "support", "hello", "admissions", "office", "enquiry", "enquiries"}
PERSONAL_EMAIL_DOMAINS = {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "rediffmail.com"}

robots_cache = {}


class LeadDiscoveryError(RuntimeError):
    pass


def _truncate(value, max_length: int | None = None):
    text = clean_value(value)

    if max_length and len(text) > max_length:
        return text[:max_length].rstrip()

    return text


def _safe_error_message(exc_or_message):
    text = clean_value(exc_or_message)

    if isinstance(exc_or_message, request_exceptions.SSLError) or "certificate" in text.lower():
        return "SSL certificate verification failed"
    if isinstance(exc_or_message, request_exceptions.Timeout) or "timed out" in text.lower() or "timeout" in text.lower():
        return "Website timeout"
    if isinstance(exc_or_message, request_exceptions.TooManyRedirects):
        return "Website blocked or unreadable"
    if "404" in text:
        return "Page not found"
    if isinstance(exc_or_message, request_exceptions.ConnectionError):
        return "Website unavailable"

    lower_text = text.lower()
    if "forbidden" in lower_text or "403" in lower_text:
        return "Website blocked or unreadable"
    if "not found" in lower_text:
        return "Page not found"

    return text[:160] or "Website blocked or unreadable"


def _is_private_or_local_host(hostname: str):
    host = clean_value(hostname).lower()

    if not host:
        return True

    if host in {"localhost", "127.0.0.1", "::1"} or host.endswith(".local"):
        return True

    try:
        ip_address = ipaddress.ip_address(host)
        return (
            ip_address.is_private
            or ip_address.is_loopback
            or ip_address.is_link_local
            or ip_address.is_reserved
            or ip_address.is_multicast
        )
    except ValueError:
        return False


def normalize_url(url: str) -> str:
    cleaned_url = clean_value(url)

    if not cleaned_url:
        raise LeadDiscoveryError("Website URL is missing")

    if cleaned_url.startswith("//"):
        cleaned_url = f"https:{cleaned_url}"

    parsed_url = urlparse(cleaned_url)

    if not parsed_url.scheme:
        cleaned_url = f"https://{cleaned_url}"
        parsed_url = urlparse(cleaned_url)

    if parsed_url.scheme not in {"http", "https"}:
        raise LeadDiscoveryError("Unsupported URL scheme")

    if not parsed_url.netloc or _is_private_or_local_host(parsed_url.hostname or ""):
        raise LeadDiscoveryError("Invalid public website URL")

    return urlunparse(parsed_url._replace(fragment="")).rstrip("/")


def _url_variants(url: str):
    normalized_url = normalize_url(url)
    parsed_url = urlparse(normalized_url)
    variants = []

    def add_variant(candidate):
        try:
            normalized_candidate = normalize_url(candidate)
        except LeadDiscoveryError:
            return
        if normalized_candidate not in variants:
            variants.append(normalized_candidate)

    add_variant(normalized_url)

    host = parsed_url.netloc
    if host.startswith("www."):
        add_variant(urlunparse(parsed_url._replace(netloc=host[4:])))
    else:
        add_variant(urlunparse(parsed_url._replace(netloc=f"www.{host}")))

    if parsed_url.scheme == "https":
        add_variant(urlunparse(parsed_url._replace(scheme="http")))

    root_path = "/" if parsed_url.path and parsed_url.path != "/" else parsed_url.path
    add_variant(urlunparse(parsed_url._replace(path=root_path, params="", query="", fragment="")))

    return variants[:4]


def _allowed_by_robots(url: str):
    parsed_url = urlparse(url)
    robots_url = f"{parsed_url.scheme}://{parsed_url.netloc}/robots.txt"

    if robots_url not in robots_cache:
        parser = RobotFileParser()
        parser.set_url(robots_url)

        try:
            response = requests.get(
                robots_url,
                timeout=REQUEST_TIMEOUT_SECONDS,
                headers={"User-Agent": USER_AGENT},
            )
            if response.status_code >= 400:
                robots_cache[robots_url] = None
            else:
                parser.parse(response.text.splitlines())
                robots_cache[robots_url] = parser
        except requests.RequestException:
            robots_cache[robots_url] = None

    parser = robots_cache[robots_url]

    if parser is None:
        return True, None

    if not parser.can_fetch(USER_AGENT, url):
        return False, "Website blocked or unreadable"

    return True, None


def _fetch_single_url(url: str):
    allowed, robots_error = _allowed_by_robots(url)
    if not allowed:
        return {"status": "error", "url": url, "error": robots_error}

    try:
        response = requests.get(
            url,
            timeout=REQUEST_TIMEOUT_SECONDS,
            headers={"User-Agent": USER_AGENT},
            stream=True,
            allow_redirects=True,
        )

        if response.status_code == 404:
            return {"status": "error", "url": url, "error": "Page not found"}
        if response.status_code >= 400:
            return {"status": "error", "url": url, "error": "Website blocked or unreadable"}

        content_type = response.headers.get("content-type", "").lower()
        if content_type and not any(allowed_type in content_type for allowed_type in ("text/html", "text/plain", "application/xhtml")):
            return {"status": "error", "url": url, "error": "Website blocked or unreadable"}

        chunks = []
        total_bytes = 0
        for chunk in response.iter_content(chunk_size=16384):
            if not chunk:
                continue
            total_bytes += len(chunk)
            if total_bytes > MAX_RESPONSE_BYTES:
                break
            chunks.append(chunk)

        if not chunks:
            return {"status": "error", "url": url, "error": "No readable website text found"}

        response.encoding = response.encoding or response.apparent_encoding or "utf-8"
        html = b"".join(chunks).decode(response.encoding or "utf-8", errors="replace")

        return {
            "status": "success",
            "url": response.url or url,
            "html": html,
            "truncated": total_bytes > MAX_RESPONSE_BYTES,
        }
    except requests.RequestException as exc:
        return {"status": "error", "url": url, "error": _safe_error_message(exc)}


def fetch_public_page(url: str) -> dict:
    errors = []

    try:
        variants = _url_variants(url)
    except LeadDiscoveryError as exc:
        return {"status": "error", "url": clean_value(url), "error": str(exc)}

    for variant in variants:
        result = _fetch_single_url(variant)
        if result.get("status") == "success":
            return result
        if result.get("error"):
            errors.append(result["error"])

    return {
        "status": "error",
        "url": variants[0] if variants else clean_value(url),
        "error": _dedupe(errors)[0] if errors else "Website unavailable",
    }


def extract_clean_text(html: str) -> str:
    if not html:
        return ""

    soup = BeautifulSoup(html, "html.parser")

    for tag in soup(["script", "style", "noscript", "svg", "nav", "footer"]):
        tag.decompose()

    text = soup.get_text("\n", strip=True)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text[:MAX_TEXT_CHARS].strip()


def extract_emails_regex(text: str):
    if not text:
        return []

    pattern = r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"
    emails = []
    seen = set()

    for match in re.findall(pattern, text):
        email = match.strip(".,;:()[]{}<>\"'").lower()
        domain = email.split("@")[-1]
        if domain in FAKE_EMAIL_DOMAINS:
            continue
        if email not in seen:
            seen.add(email)
            emails.append(email)

    return emails


def extract_phone_regex(text: str):
    if not text:
        return []

    patterns = [
        r"(?:\+91[\s-]?)?[6-9]\d{9}",
        r"(?:\+91[\s-]?)?(?:0[\s-]?)?[1-9]\d{2,4}[\s-]?\d{6,8}",
        r"\+\d{1,3}[\s-]?\d{6,14}",
    ]
    phones = []
    seen = set()

    for pattern in patterns:
        for match in re.findall(pattern, text):
            phone = re.sub(r"\s+", " ", clean_value(match)).strip(".,;:()[]{}<>\"'")
            digits = re.sub(r"\D", "", phone)
            if len(digits) < 8 or len(digits) > 15:
                continue
            if digits not in seen:
                seen.add(digits)
                phones.append(phone)

    return phones[:8]


def extract_context_around_email(text: str, email: str):
    lower_text = text.lower()
    index = lower_text.find(email.lower())

    if index == -1:
        return _truncate(text, MAX_CONTEXT_CHARS)

    start = max(0, index - 500)
    end = min(len(text), index + len(email) + 500)

    return _truncate(text[start:end], MAX_CONTEXT_CHARS)


def _dedupe(values):
    result = []
    seen = set()

    for value in values:
        text = clean_value(value)
        if text and text not in seen:
            seen.add(text)
            result.append(text)

    return result


def _extract_json_array(text):
    cleaned_text = clean_value(text)

    if cleaned_text.startswith("```"):
        cleaned_text = re.sub(r"^```(?:json)?", "", cleaned_text, flags=re.IGNORECASE).strip()
        cleaned_text = re.sub(r"```$", "", cleaned_text).strip()

    try:
        parsed = json.loads(cleaned_text)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\[.*\]", cleaned_text, flags=re.DOTALL)
    if not match:
        raise ValueError("No JSON array found in Gemini response.")

    parsed = json.loads(match.group(0))
    if not isinstance(parsed, list):
        raise ValueError("Gemini response did not contain a JSON array.")

    return parsed


def _split_lines(value):
    return [
        item.strip()
        for item in clean_value(value).splitlines()
        if item.strip()
    ]


def _infer_organization(page_text: str, source_url: str):
    lines = [
        line.strip()
        for line in clean_value(page_text).splitlines()
        if line.strip()
    ]

    for line in lines[:10]:
        if 3 <= len(line) <= 120 and "@" not in line:
            return line

    parsed_url = urlparse(source_url)
    return parsed_url.netloc.replace("www.", "")


def _risk_flags_for_contact(email: str | None, source_error: str | None = None):
    flags = []
    email_value = clean_value(email).lower()

    if email_value:
        local_part, _, domain = email_value.partition("@")
        if local_part in GENERIC_EMAIL_PREFIXES:
            flags.append("Generic email address")
        if domain in PERSONAL_EMAIL_DOMAINS:
            flags.append("Personal email address")

    if source_error:
        flags.append(source_error)

    return "; ".join(flags) or None


def _fallback_contacts(contexts, job: DiscoveryJob):
    contacts = []

    for item in contexts:
        email = clean_value(item.get("email"))
        phone = clean_value(item.get("phone"))
        source_url = clean_value(item.get("source_url"))
        organization = clean_value(item.get("organization")) or _infer_organization(item.get("page_text", ""), source_url)

        confidence = 45 if email.split("@")[0] in GENERIC_EMAIL_PREFIXES else 65
        if not email and phone:
            confidence = 35

        contacts.append({
            "name": None,
            "organization": organization,
            "department": clean_value(job.department) or None,
            "designation": clean_value(job.target_role) or None,
            "email": email or None,
            "phone": phone or None,
            "lead_type": clean_value(job.target_type) or "general",
            "location": clean_value(job.location) or None,
            "confidence": confidence,
            "fit_reason": "Contact detail was found on a public source page and needs user review.",
            "risk_flags": _risk_flags_for_contact(email),
            "source_url": source_url,
            "raw_context": clean_value(item.get("context")),
        })

    return contacts


def _build_contact_prompt(contexts, job: DiscoveryJob, campaign: Campaign | None):
    context_lines = []
    for index, item in enumerate(contexts, start=1):
        context_lines.append(
            "\n".join([
                f"CONTACT_CONTEXT_{index}",
                f"Source URL: {clean_value(item.get('source_url'))}",
                f"Found email: {clean_value(item.get('email'))}",
                f"Found phone: {clean_value(item.get('phone'))}",
                f"Page organization hint: {clean_value(item.get('organization'))}",
                f"Nearby text: {clean_value(item.get('context'))}",
            ])
        )

    campaign_context = "No campaign selected."
    if campaign:
        campaign_context = (
            f"Campaign: {clean_value(campaign.campaign_name)}\n"
            f"Industry: {clean_value(campaign.industry)}\n"
            f"Location: {clean_value(campaign.location)}\n"
            f"Target role: {clean_value(campaign.target_role)}\n"
            f"Offer: {clean_value(campaign.offer)}"
        )

    return f"""
Convert public contact snippets into structured lead JSON.
Use only facts present in the snippets, discovery job, and campaign context.
Do not invent email addresses, phone numbers, names, roles, organizations, or locations.
Return strict JSON array only.

Discovery job:
- Title: {clean_value(job.title)}
- Target type: {clean_value(job.target_type)}
- Department/domain: {clean_value(job.department)}
- Location: {clean_value(job.location)}
- Target role: {clean_value(job.target_role)}
- Goal: {clean_value(job.query_goal)}

{campaign_context}

Rules:
- Only include email if it appears as Found email.
- Only include phone if it appears as Found phone.
- If email is generic like info@, contact@, admissions@, admin@, mark risk_flags.
- If email is Gmail/Yahoo/Hotmail/Outlook/Rediffmail, mark risk_flags.
- If name or designation is unknown, use null.
- If the page is a faculty/department page, classify likely professor/department contacts.
- If the page is a company contact page, classify company/generic contacts.
- Always preserve source_url.

Public snippets:
{chr(10).join(context_lines)}

Return JSON array:
[
  {{
    "name": null,
    "organization": "...",
    "department": "...",
    "designation": "...",
    "email": "...",
    "phone": "...",
    "lead_type": "...",
    "location": "...",
    "confidence": 0,
    "fit_reason": "...",
    "risk_flags": "...",
    "source_url": "..."
  }}
]
""".strip()


def ai_structure_contacts(contexts, job: DiscoveryJob, campaign: Campaign | None = None):
    if not contexts:
        return []

    allowed_emails = {
        clean_value(item.get("email")).lower()
        for item in contexts
        if clean_value(item.get("email"))
    }
    allowed_phones = {
        clean_value(item.get("phone"))
        for item in contexts
        if clean_value(item.get("phone"))
    }

    if not settings.GEMINI_API_KEY:
        return _fallback_contacts(contexts, job)

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=_build_contact_prompt(contexts, job, campaign),
        )
        parsed = _extract_json_array(clean_value(getattr(response, "text", "")))
    except Exception:
        return _fallback_contacts(contexts, job)

    if not isinstance(parsed, list):
        return _fallback_contacts(contexts, job)

    structured_contacts = []
    fallback_by_email = {
        clean_value(item.get("email")).lower(): item
        for item in _fallback_contacts(contexts, job)
        if clean_value(item.get("email"))
    }
    fallback_by_phone = {
        clean_value(item.get("phone")): item
        for item in _fallback_contacts(contexts, job)
        if clean_value(item.get("phone"))
    }

    for item in parsed:
        if not isinstance(item, dict):
            continue

        email = clean_value(item.get("email")).lower()
        phone = clean_value(item.get("phone"))

        if email and email not in allowed_emails:
            email = ""
        if phone and phone not in allowed_phones:
            phone = ""
        if not email and not phone:
            continue

        fallback = fallback_by_email.get(email) or fallback_by_phone.get(phone) or {}
        confidence = item.get("confidence")
        try:
            confidence = max(0, min(100, int(confidence)))
        except (TypeError, ValueError):
            confidence = fallback.get("confidence") or 50

        structured_contacts.append({
            "name": _truncate(item.get("name"), 255) or None,
            "organization": _truncate(item.get("organization") or fallback.get("organization"), 255) or None,
            "department": _truncate(item.get("department") or fallback.get("department"), 255) or None,
            "designation": _truncate(item.get("designation") or fallback.get("designation"), 255) or None,
            "email": email or None,
            "phone": _truncate(phone, 100) or None,
            "lead_type": _truncate(item.get("lead_type") or fallback.get("lead_type"), 100) or None,
            "location": _truncate(item.get("location") or fallback.get("location"), 255) or None,
            "confidence": confidence,
            "fit_reason": _truncate(item.get("fit_reason") or fallback.get("fit_reason"), 1200) or None,
            "risk_flags": _truncate(item.get("risk_flags") or fallback.get("risk_flags") or _risk_flags_for_contact(email), 1200) or None,
            "source_url": _truncate(item.get("source_url") or fallback.get("source_url"), 1000),
            "raw_context": _truncate(fallback.get("raw_context"), 1200) or None,
        })

    return structured_contacts or _fallback_contacts(contexts, job)


def _make_contexts_for_page(source_url: str, html: str, page_text: str):
    combined_text = f"{page_text}\n{html}"
    emails = extract_emails_regex(combined_text)
    phones = extract_phone_regex(page_text)
    organization = _infer_organization(page_text, source_url)
    contexts = []

    for email in emails:
        contexts.append({
            "email": email,
            "phone": phones[0] if phones else "",
            "source_url": source_url,
            "organization": organization,
            "context": extract_context_around_email(page_text, email),
            "page_text": page_text,
        })

    if not emails:
        for phone in phones[:2]:
            contexts.append({
                "email": "",
                "phone": phone,
                "source_url": source_url,
                "organization": organization,
                "context": _truncate(page_text, MAX_CONTEXT_CHARS),
                "page_text": page_text,
            })

    return contexts


def _contact_exists(db: Session, job_id: int, email: str | None, phone: str | None, source_url: str):
    query = db.query(DiscoveredLead).filter(DiscoveredLead.discovery_job_id == job_id)

    if email:
        return query.filter(DiscoveredLead.email == email).first() is not None

    if phone:
        return query.filter(
            DiscoveredLead.phone == phone,
            DiscoveredLead.source_url == source_url,
        ).first() is not None

    return False


def run_discovery_job(db: Session, job_id: int):
    job = (
        db.query(DiscoveryJob)
        .options(joinedload(DiscoveryJob.campaign))
        .filter(DiscoveryJob.id == job_id)
        .first()
    )

    if not job:
        raise LeadDiscoveryError("Discovery job was not found.")

    job.status = "running"
    job.errors = None
    job.pages_attempted = 0
    job.updated_at = utc_now()
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()

    source_urls = _split_lines(job.source_urls)
    errors = []
    inserted_count = 0

    if not source_urls:
        if clean_value(job.generated_queries):
            errors.append("Generated search queries are ready. Add public source URLs before running discovery.")
        else:
            errors.append("Add public source URLs before running discovery.")
        job.status = "completed"
        job.errors = "\n".join(errors)
        job.contacts_found = db.query(DiscoveredLead).filter(DiscoveredLead.discovery_job_id == job.id).count()
        job.updated_at = utc_now()
        db.commit()
        db.refresh(job)
        return {
            "job_id": job.id,
            "status": job.status,
            "pages_attempted": job.pages_attempted,
            "contacts_found": job.contacts_found,
            "inserted": 0,
            "errors": errors,
        }

    effective_limit = max(1, min(job.limit or 20, MAX_DISCOVERY_PAGES))
    source_urls = source_urls[:effective_limit]

    try:
        for source_url in source_urls:
            job.pages_attempted += 1
            result = fetch_public_page(source_url)

            if result.get("status") != "success":
                errors.append(f"{source_url}: {result.get('error') or 'Website unavailable'}")
                continue

            page_text = extract_clean_text(result.get("html", ""))
            if not page_text:
                errors.append(f"{source_url}: No readable website text found")
                continue

            contexts = _make_contexts_for_page(result.get("url") or source_url, result.get("html", ""), page_text)
            if not contexts:
                errors.append(f"{source_url}: No public email found")
                continue

            structured_contacts = ai_structure_contacts(contexts, job, job.campaign)

            for contact in structured_contacts:
                email = clean_value(contact.get("email")).lower() or None
                phone = clean_value(contact.get("phone")) or None
                contact_source_url = clean_value(contact.get("source_url")) or result.get("url") or source_url

                if not email and not phone:
                    continue
                if _contact_exists(db, job.id, email, phone, contact_source_url):
                    continue

                discovered_lead = DiscoveredLead(
                    discovery_job_id=job.id,
                    campaign_id=job.campaign_id,
                    name=_truncate(contact.get("name"), 255) or None,
                    organization=_truncate(contact.get("organization"), 255) or None,
                    department=_truncate(contact.get("department"), 255) or None,
                    designation=_truncate(contact.get("designation"), 255) or None,
                    email=email,
                    phone=_truncate(phone, 100) or None,
                    website=contact_source_url,
                    profile_url=contact_source_url,
                    source_url=contact_source_url,
                    lead_type=_truncate(contact.get("lead_type"), 100) or clean_value(job.target_type) or None,
                    location=_truncate(contact.get("location"), 255) or clean_value(job.location) or None,
                    confidence=contact.get("confidence"),
                    fit_reason=_truncate(contact.get("fit_reason"), 1200) or None,
                    risk_flags=_truncate(contact.get("risk_flags"), 1200) or _risk_flags_for_contact(email),
                    raw_context=_truncate(contact.get("raw_context"), 1200) or None,
                    status="pending",
                )
                db.add(discovered_lead)
                inserted_count += 1

        db.flush()
        job.contacts_found = db.query(DiscoveredLead).filter(DiscoveredLead.discovery_job_id == job.id).count()
        job.status = "completed"
        job.errors = "\n".join(_dedupe(errors)) or None
        job.updated_at = utc_now()
        db.commit()
        db.refresh(job)
    except SQLAlchemyError as exc:
        db.rollback()
        job.status = "failed"
        job.errors = "Discovery results could not be saved."
        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
        raise LeadDiscoveryError("Discovery results could not be saved.") from exc

    return {
        "job_id": job.id,
        "status": job.status,
        "pages_attempted": job.pages_attempted,
        "contacts_found": job.contacts_found,
        "inserted": inserted_count,
        "errors": _dedupe(errors),
    }


def _fallback_search_queries(payload: dict):
    target_type = clean_value(payload.get("target_type")).lower()
    department = clean_value(payload.get("department")) or clean_value(payload.get("query_goal")) or "target audience"
    location = clean_value(payload.get("location")) or "India"
    role = clean_value(payload.get("target_role"))

    if target_type in {"professor", "college", "department", "student"} or any(
        keyword in f"{department} {role}".lower()
        for keyword in ("professor", "faculty", "hod", "college", "department", "research")
    ):
        return [
            f'site:.ac.in "faculty" "{department}" "email" "{location}"',
            f'site:.edu.in "engineering college" "{role or "HOD"}" "email"',
            f'site:.ac.in "{department}" "HOD" "email"',
            f'site:.ac.in "{department}" "research" "faculty" "email"',
        ]

    if "restaurant" in f"{department} {payload.get('query_goal')}".lower():
        return [
            f'"restaurant" "{location}" "contact" "email"',
            f'"restaurant owner" "{location}" "official website"',
            f'"best restaurants" "{location}" "contact us"',
        ]

    return [
        f'"{department}" "{location}" "contact" "email"',
        f'"{department}" "{role or "manager"}" "official website"',
        f'"{department}" "{location}" "team" "contact"',
        f'"{department}" "{location}" "directory"',
    ]


def generate_search_queries(payload: dict):
    fallback_queries = _fallback_search_queries(payload)

    if not settings.GEMINI_API_KEY:
        return fallback_queries

    prompt = f"""
Generate safe manual search queries for finding public source URLs.
Do not suggest scraping LinkedIn or search result pages. LinkedIn may be used only as manual search or user-provided URLs.
Return strict JSON only: {{"queries": ["..."]}}

Context:
- Title: {clean_value(payload.get("title"))}
- Target type: {clean_value(payload.get("target_type"))}
- Department/domain: {clean_value(payload.get("department"))}
- Location: {clean_value(payload.get("location"))}
- Target role: {clean_value(payload.get("target_role"))}
- Goal: {clean_value(payload.get("query_goal"))}
- Offer: {clean_value(payload.get("offer"))}

Examples:
- site:.ac.in "faculty" "computer science" "email" "India"
- site:.edu.in "engineering college" "HOD" "email"
- "restaurant" "Pune" "contact" "email"
- "SaaS startup" "CTO" "security" "contact"
""".strip()

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )
        parsed = extract_json_from_text(clean_value(getattr(response, "text", "")))
        queries = parsed.get("queries") if isinstance(parsed, dict) else None
        if isinstance(queries, list):
            cleaned_queries = _dedupe(_truncate(query, 220) for query in queries)
            return cleaned_queries[:8] or fallback_queries
    except Exception:
        return fallback_queries

    return fallback_queries


def approve_or_reject_results(db: Session, result_ids: list[int], status: str):
    if status not in {"approved", "rejected"}:
        raise LeadDiscoveryError("Invalid result status.")

    if not result_ids:
        return 0

    results = db.query(DiscoveredLead).filter(DiscoveredLead.id.in_(result_ids)).all()

    for result in results:
        if result.status != "imported":
            result.status = status
            result.updated_at = utc_now()

    db.commit()
    return len(results)


def import_selected_results(db: Session, job_id: int, result_ids: list[int], allow_no_email: bool = False):
    job = (
        db.query(DiscoveryJob)
        .options(joinedload(DiscoveryJob.campaign))
        .filter(DiscoveryJob.id == job_id)
        .first()
    )

    if not job:
        raise LeadDiscoveryError("Discovery job was not found.")

    if not job.campaign_id or not job.campaign:
        raise LeadDiscoveryError("Select a campaign before importing discovered leads.")

    results = (
        db.query(DiscoveredLead)
        .filter(
            DiscoveredLead.discovery_job_id == job_id,
            DiscoveredLead.id.in_(result_ids),
        )
        .all()
    )
    imported = 0
    skipped_duplicates = 0
    skipped_no_email = 0
    skipped_rejected = 0
    imported_lead_ids = []

    try:
        for result in results:
            if result.status in {"rejected", "imported"}:
                skipped_rejected += 1
                continue

            email = clean_value(result.email).lower()
            if not email and not allow_no_email:
                skipped_no_email += 1
                continue

            if email:
                duplicate = (
                    db.query(Lead)
                    .filter(
                        Lead.campaign_id == job.campaign_id,
                        Lead.email == email,
                    )
                    .first()
                )
                if duplicate:
                    skipped_duplicates += 1
                    result.status = "imported"
                    result.imported_lead_id = duplicate.id
                    result.updated_at = utc_now()
                    continue

            organization = clean_value(result.organization) or (email.split("@")[-1] if email else "Discovered contact")
            lead = Lead(
                campaign_id=job.campaign_id,
                company_name=organization[:255],
                website=clean_value(result.website) or clean_value(result.profile_url) or clean_value(result.source_url),
                industry=clean_value(result.department) or clean_value(result.lead_type) or clean_value(job.campaign.industry),
                location=clean_value(result.location) or clean_value(job.location) or clean_value(job.campaign.location),
                contact_name=clean_value(result.name) or None,
                contact_role=clean_value(result.designation) or clean_value(job.target_role) or None,
                email=email or None,
                phone=clean_value(result.phone) or None,
                source_url=clean_value(result.source_url) or None,
                profile_url=clean_value(result.profile_url) or None,
                source="discovery",
                status="new",
            )
            db.add(lead)
            db.flush()
            result.status = "imported"
            result.imported_lead_id = lead.id
            result.updated_at = utc_now()
            imported += 1
            imported_lead_ids.append(lead.id)

        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise LeadDiscoveryError("Discovered leads could not be imported.") from exc

    return {
        "processed": len(results),
        "imported": imported,
        "skipped_duplicates": skipped_duplicates,
        "skipped_no_email": skipped_no_email,
        "skipped_rejected": skipped_rejected,
        "imported_lead_ids": imported_lead_ids,
    }


def research_imported_leads(db: Session, job_id: int, limit: int = 5):
    effective_limit = max(1, min(limit, 10))
    results = (
        db.query(DiscoveredLead)
        .filter(
            DiscoveredLead.discovery_job_id == job_id,
            DiscoveredLead.status == "imported",
            DiscoveredLead.imported_lead_id.isnot(None),
        )
        .order_by(DiscoveredLead.updated_at.desc(), DiscoveredLead.id.desc())
        .limit(effective_limit)
        .all()
    )
    researched = 0
    failed = 0
    output = []

    for result in results:
        try:
            research_result = research_lead(db, result.imported_lead_id)
            if research_result.get("research_status") == "researched":
                researched += 1
            else:
                failed += 1
            output.append(research_result)
        except Exception:
            failed += 1
            output.append({
                "lead_id": result.imported_lead_id,
                "research_status": "failed",
                "research_error": "Lead research failed. Please try again.",
            })

    return {
        "processed": len(results),
        "researched": researched,
        "failed": failed,
        "results": output,
    }


def parse_json_list(value):
    text = clean_value(value)
    if not text:
        return []

    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

    return _split_lines(text)
