"""Do-not-contact list. Every outbound email passes through is_suppressed()."""
import re
from urllib.parse import quote

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import sign_value, verify_signed_value
from app.db.models import SuppressedEmail

UNSUBSCRIBE_PURPOSE = "unsubscribe"
EMAIL_PATTERN = re.compile(r"^[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def normalize_email(value) -> str:
    return (str(value or "")).strip().lower()


def is_valid_email(value) -> bool:
    return bool(EMAIL_PATTERN.match(normalize_email(value)))


def is_suppressed(db: Session, email) -> bool:
    normalized = normalize_email(email)
    if not normalized:
        return False
    return db.query(SuppressedEmail.id).filter(SuppressedEmail.email == normalized).first() is not None


def suppress(db: Session, email, reason="manual", note=None, created_by=None) -> tuple[SuppressedEmail, bool]:
    """Add an address; returns (entry, created)."""
    normalized = normalize_email(email)
    existing = db.query(SuppressedEmail).filter(SuppressedEmail.email == normalized).first()
    if existing:
        return existing, False
    entry = SuppressedEmail(email=normalized, reason=reason, note=note, created_by=created_by)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry, True


def unsubscribe_token(email) -> str:
    return sign_value(normalize_email(email), UNSUBSCRIBE_PURPOSE)


def verify_unsubscribe_token(email, token) -> bool:
    return verify_signed_value(normalize_email(email), token or "", UNSUBSCRIBE_PURPOSE)


def unsubscribe_url(email) -> str | None:
    if not settings.UNSUBSCRIBE_LINKS_ENABLED or not settings.PUBLIC_API_URL:
        return None
    normalized = normalize_email(email)
    return (
        f"{settings.PUBLIC_API_URL}/api/public/unsubscribe"
        f"?email={quote(normalized)}&token={unsubscribe_token(normalized)}"
    )
