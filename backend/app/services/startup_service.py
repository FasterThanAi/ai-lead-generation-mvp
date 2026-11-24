"""One-off tasks executed when an API instance boots."""
import logging
from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.db.models import EmailDraft, EmailExtractionJob, LeadResearchJob, LeadScoringJob, User
from app.utils.time_utils import utc_now

logger = logging.getLogger(__name__)
JOB_MODELS = (EmailExtractionJob, LeadResearchJob, LeadScoringJob)


def bootstrap_admin(db: Session) -> None:
    """Create the first admin from ADMIN_EMAIL/ADMIN_PASSWORD on an empty install."""
    if not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD:
        return
    if db.query(User.id).filter(User.email == settings.ADMIN_EMAIL).first():
        return
    db.add(User(email=settings.ADMIN_EMAIL, full_name="Administrator",
                password_hash=hash_password(settings.ADMIN_PASSWORD), role="admin"))
    db.commit()
    logger.info("Bootstrapped admin account %s", settings.ADMIN_EMAIL)


def recover_stale_work(db: Session) -> dict:
    """Background jobs run in-process. If an instance died mid-job, mark it failed
    so the UI stops showing a spinner and the user can retry."""
    cutoff = utc_now() - timedelta(minutes=settings.STALE_JOB_MINUTES)
    summary = {}
    for model in JOB_MODELS:
        stale = (
            db.query(model)
            .filter(model.status.in_(("pending", "running")), model.started_at < cutoff)
            .all()
        )
        for job in stale:
            job.status = "failed"
            job.error = job.error or "Job was interrupted by a server restart. Please run it again."
            job.finished_at = utc_now()
        summary[model.__tablename__] = len(stale)

    # A draft stuck in "sending" means the process died between claim and Gmail
    # confirmation. Mark it failed (not approved) so it is never sent twice blindly.
    stuck_drafts = (
        db.query(EmailDraft)
        .filter(EmailDraft.status == "sending", EmailDraft.updated_at < cutoff)
        .all()
    )
    for draft in stuck_drafts:
        draft.status = "failed"
        draft.send_error = "Sending was interrupted. Check Gmail Sent before retrying."
    summary["email_drafts_sending"] = len(stuck_drafts)
    db.commit()
    if any(summary.values()):
        logger.warning("Recovered stale work on startup: %s", summary)
    return summary
