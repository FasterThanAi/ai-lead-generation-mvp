from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import Principal, require_admin
from app.core.config import settings
from app.db.database import get_db
from app.db.models import Campaign, EmailDraft, Lead, SuppressedEmail, User

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/status")
def system_status(_: Principal = Depends(require_admin), db: Session = Depends(get_db)):
    """Integration and platform configuration overview for the Settings page."""
    return {
        "status": "success",
        "app": {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.APP_ENV,
            "database": "postgresql" if settings.DATABASE_URL.startswith("postgres") else "sqlite",
            "redis": bool(settings.REDIS_URL),
            "auth_enabled": settings.AUTH_ENABLED,
            "rate_limiting": settings.RATE_LIMIT_ENABLED,
            "metrics": settings.METRICS_ENABLED,
        },
        "integrations": {
            "gemini": bool(settings.GEMINI_API_KEY),
            "gmail_oauth": bool(settings.GMAIL_CLIENT_ID and settings.GMAIL_CLIENT_SECRET),
            "hunter": bool(settings.HUNTER_API_KEY),
            "apollo": bool(settings.APOLLO_API_KEY),
            "vapi": bool(settings.VAPI_ENABLED and settings.VAPI_API_KEY),
            "n8n": bool(settings.N8N_WEBHOOK_URL),
            "unsubscribe_links": bool(settings.UNSUBSCRIBE_LINKS_ENABLED and settings.PUBLIC_API_URL),
        },
        "counts": {
            "users": db.query(func.count(User.id)).scalar() or 0,
            "campaigns": db.query(func.count(Campaign.id)).scalar() or 0,
            "leads": db.query(func.count(Lead.id)).scalar() or 0,
            "email_drafts": db.query(func.count(EmailDraft.id)).scalar() or 0,
            "suppressed": db.query(func.count(SuppressedEmail.id)).scalar() or 0,
        },
        "limits": {
            "gmail_daily_limit": settings.GMAIL_DAILY_LIMIT,
            "max_upload_mb": settings.MAX_UPLOAD_MB,
            "csv_max_rows": settings.CSV_MAX_ROWS,
        },
    }
