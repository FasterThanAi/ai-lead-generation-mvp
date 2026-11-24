import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import Principal, require_admin
from app.db.database import get_db
from app.db.models import AuditLog

router = APIRouter(prefix="/audit", tags=["Audit"])


def serialize_audit(entry: AuditLog) -> dict:
    try:
        details = json.loads(entry.details) if entry.details else None
    except ValueError:
        details = entry.details
    return {
        "id": entry.id,
        "actor_email": entry.actor_email,
        "action": entry.action,
        "entity_type": entry.entity_type,
        "entity_id": entry.entity_id,
        "summary": entry.summary,
        "details": details,
        "ip_address": entry.ip_address,
        "request_id": entry.request_id,
        "created_at": entry.created_at,
    }


@router.get("/")
def list_audit_logs(
    action: str | None = Query(None, max_length=100),
    entity_type: str | None = Query(None, max_length=100),
    q: str | None = Query(None, max_length=200),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _: Principal = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action.like(f"{action}%"))
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter((AuditLog.summary.ilike(like)) | (AuditLog.actor_email.ilike(like)))

    total = query.count()
    entries = (
        query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "status": "success",
        "data": [serialize_audit(entry) for entry in entries],
        "pagination": {"page": page, "page_size": page_size, "total": total},
    }
