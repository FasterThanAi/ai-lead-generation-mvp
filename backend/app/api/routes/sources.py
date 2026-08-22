import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import SourceDocument, Product

router = APIRouter(
    prefix="/sources",
    tags=["Sources"]
)

logger = logging.getLogger(__name__)


@router.get("/")
def get_sources(product_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(SourceDocument)
    if product_id is not None:
        query = query.filter(SourceDocument.product_id == product_id)
    sources = query.order_by(SourceDocument.created_at.desc(), SourceDocument.id.desc()).all()
    return {
        "status": "success",
        "data": sources
    }


@router.get("/{source_id}")
def get_source(source_id: int, db: Session = Depends(get_db)):
    source = db.query(SourceDocument).filter(SourceDocument.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail=f"Source document with id {source_id} was not found")
    return {
        "status": "success",
        "data": source
    }


@router.delete("/{source_id}")
def delete_source(source_id: int, db: Session = Depends(get_db)):
    source = db.query(SourceDocument).filter(SourceDocument.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail=f"Source document with id {source_id} was not found")
    db.delete(source)
    db.commit()
    return {
        "status": "success",
        "message": f"Source document {source_id} deleted successfully"
    }
