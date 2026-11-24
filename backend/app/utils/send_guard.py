"""Atomic 'approved' -> 'sending' transition so a draft is never sent twice.

Two concurrent requests (double click, two tabs, two API replicas) both read the
draft as approved. A conditional UPDATE lets exactly one of them win the claim.
"""
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.utils.time_utils import utc_now

ALREADY_SENDING_ERROR = "This draft is already being sent or is no longer approved."


def claim_for_sending(db: Session, draft) -> bool:
    model = type(draft)
    values = {"status": "sending", "send_error": None}
    if hasattr(model, "updated_at"):
        values["updated_at"] = utc_now()
    result = db.execute(
        update(model)
        .where(model.id == draft.id, model.status == "approved")
        .values(**values)
        .execution_options(synchronize_session=False)
    )
    db.commit()
    db.refresh(draft)
    return result.rowcount == 1
