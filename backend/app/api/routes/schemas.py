import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.schema_service import generate_attribute_schema

router = APIRouter(
    prefix="/schemas",
    tags=["Schemas"]
)

logger = logging.getLogger(__name__)


@router.post("/generate")
def generate_schema_endpoint(
    payload: dict,
    db: Session = Depends(get_db)
):
    catalog_id = payload.get("catalog_id")
    category_name = payload.get("category_name")
    source_document_id = payload.get("source_document_id")
    sample_text = payload.get("sample_text")

    if not catalog_id:
        raise HTTPException(status_code=400, detail="Missing required field 'catalog_id'")
    if not category_name:
        raise HTTPException(status_code=400, detail="Missing required field 'category_name'")

    try:
        result = generate_attribute_schema(
            db=db,
            catalog_id=int(catalog_id),
            category_name=str(category_name),
            sample_text=sample_text,
            source_document_id=int(source_document_id) if source_document_id else None,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
