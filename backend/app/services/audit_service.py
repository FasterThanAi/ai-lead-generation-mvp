"""Append-only audit trail for security-relevant and outbound actions."""
import json
import logging

from fastapi import Request
from sqlalchemy.orm import Session

from app.core.logging import request_id_var
from app.db.models import AuditLog

logger = logging.getLogger(__name__)


def record_audit(
    db: Session,
    action: str,
    *,
    actor=None,
    entity_type: str | None = None,
    entity_id=None,
    summary: str | None = None,
    details: dict | None = None,
    request: Request | None = None,
    commit: bool = True,
) -> None:
    """Persist an audit entry. Failures are logged, never raised to the caller."""
    try:
        entry = AuditLog(
            actor_id=getattr(actor, "id", None),
            actor_email=getattr(actor, "email", None),
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            summary=(summary or "")[:2000] or None,
            details=json.dumps(details, default=str)[:10000] if details else None,
            ip_address=(request.client.host if request and request.client else None),
            request_id=request_id_var.get(),
        )
        db.add(entry)
        if commit:
            db.commit()
    except Exception:  # noqa: BLE001 - auditing must not break the user action
        logger.exception("Could not write audit log entry for %s", action)
        if commit:
            db.rollback()
