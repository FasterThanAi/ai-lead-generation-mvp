import csv
import html
import io

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.api.deps import Principal, get_current_principal
from app.db.database import get_db
from app.db.models import SuppressedEmail
from app.schemas.auth_schema import SuppressionCreate
from app.services.audit_service import record_audit
from app.services.suppression_service import (
    is_suppressed,
    is_valid_email,
    normalize_email,
    suppress,
    verify_unsubscribe_token,
)

router = APIRouter(prefix="/suppression", tags=["Suppression list"])
public_router = APIRouter(prefix="/public", tags=["Public"])


def serialize_entry(entry: SuppressedEmail) -> dict:
    return {
        "id": entry.id,
        "email": entry.email,
        "reason": entry.reason,
        "note": entry.note,
        "created_by": entry.created_by,
        "created_at": entry.created_at,
    }


@router.get("/")
def list_suppressed(
    q: str | None = Query(None, max_length=255),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(SuppressedEmail)
    if q:
        query = query.filter(SuppressedEmail.email.ilike(f"%{q.strip().lower()}%"))
    total = query.count()
    entries = (
        query.order_by(SuppressedEmail.created_at.desc(), SuppressedEmail.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "status": "success",
        "data": [serialize_entry(entry) for entry in entries],
        "pagination": {"page": page, "page_size": page_size, "total": total},
    }


@router.get("/check")
def check_suppressed(email: str = Query(..., max_length=255), db: Session = Depends(get_db)):
    return {"status": "success", "email": normalize_email(email), "suppressed": is_suppressed(db, email)}


@router.post("/", status_code=201)
def add_suppressed(
    payload: SuppressionCreate,
    request: Request,
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
):
    entry, created = suppress(db, payload.email, payload.reason, payload.note, principal.email)
    if created:
        record_audit(db, "suppression.added", actor=principal, entity_type="suppression", entity_id=entry.id,
                     summary=f"Suppressed {entry.email}", request=request)
    return {"status": "success", "created": created, "data": serialize_entry(entry)}


@router.post("/import")
async def import_suppressed(
    request: Request,
    file: UploadFile = File(...),
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
):
    contents = await file.read(2 * 1024 * 1024 + 1)
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Suppression file must be 2 MB or smaller.")
    try:
        text = contents.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded.") from exc

    added = skipped = invalid = 0
    for row in csv.reader(io.StringIO(text)):
        for cell in row:
            email = normalize_email(cell)
            if not email or email == "email":
                continue
            if not is_valid_email(email):
                invalid += 1
                continue
            _, created = suppress(db, email, "import", None, principal.email)
            added += int(created)
            skipped += int(not created)

    record_audit(db, "suppression.imported", actor=principal, entity_type="suppression",
                 summary=f"Imported {added} suppressed addresses", request=request)
    return {"status": "success", "added": added, "already_present": skipped, "invalid": invalid}


@router.delete("/{entry_id}")
def remove_suppressed(
    entry_id: int,
    request: Request,
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
):
    entry = db.get(SuppressedEmail, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Suppression entry not found.")
    if entry.reason == "unsubscribed" and not principal.is_admin:
        raise HTTPException(status_code=403, detail="Only an admin can remove a recipient who unsubscribed.")
    email = entry.email
    db.delete(entry)
    db.commit()
    record_audit(db, "suppression.removed", actor=principal, entity_type="suppression", entity_id=entry_id,
                 summary=f"Removed {email} from suppression list", request=request)
    return {"status": "success"}


_PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title>
<style>body{{font-family:system-ui,-apple-system,sans-serif;background:#f6f7f9;color:#111827;
display:grid;place-items:center;min-height:100vh;margin:0}}main{{background:#fff;border:1px solid #e5e7eb;
border-radius:16px;padding:40px;max-width:420px;text-align:center}}h1{{font-size:20px;margin:0 0 8px}}
p{{color:#4b5563;line-height:1.5;margin:0}}</style></head><body><main><h1>{title}</h1><p>{body}</p></main></body></html>"""


def _invalid_link():
    return HTMLResponse(_PAGE.format(title="Link not valid",
                                     body="This unsubscribe link is invalid or incomplete."), status_code=400)


@public_router.get("/unsubscribe", response_class=HTMLResponse)
def unsubscribe_confirm(
    email: str = Query(..., max_length=255),
    token: str = Query(..., max_length=200),
):
    # GET never changes state: link scanners and previews open URLs automatically.
    if not verify_unsubscribe_token(email, token):
        return _invalid_link()
    safe_email = html.escape(normalize_email(email))
    form = (
        f'<form method="post"><input type="hidden" name="email" value="{safe_email}">'
        f'<input type="hidden" name="token" value="{html.escape(token)}">'
        '<button style="margin-top:20px;background:#111827;color:#fff;border:0;border-radius:10px;'
        'padding:10px 18px;font-size:15px;cursor:pointer">Unsubscribe</button></form>'
    )
    return HTMLResponse(_PAGE.format(title="Unsubscribe", body=f"Stop emails to <b>{safe_email}</b>?{form}"))


@public_router.post("/unsubscribe", response_class=HTMLResponse)
async def unsubscribe(request: Request, db: Session = Depends(get_db)):
    """Handles both the confirm form and RFC 8058 one-click POSTs from mail clients."""
    form = await request.form()
    email = str(form.get("email") or request.query_params.get("email") or "")[:255]
    token = str(form.get("token") or request.query_params.get("token") or "")[:200]
    if not verify_unsubscribe_token(email, token):
        return _invalid_link()
    entry, created = suppress(db, email, "unsubscribed", "Recipient used unsubscribe link", "recipient")
    if created:
        record_audit(db, "suppression.unsubscribed", entity_type="suppression", entity_id=entry.id,
                     summary=f"{entry.email} unsubscribed", request=request)
    return HTMLResponse(_PAGE.format(title="You have been unsubscribed",
                                     body="You will not receive further emails from us at this address."))
