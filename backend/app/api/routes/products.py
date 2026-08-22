import logging
import os
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.db.database import get_db
from app.db.models import Catalog, Product, ProductAttribute, SourceDocument, AttributeConflict
from app.schemas.product_schema import ProductCreate, ProductResponse
from app.services.ingestion_service import (
    ingest_products,
    parse_product_csv,
    register_document,
    sanitize_filename,
)

router = APIRouter(
    prefix="/products",
    tags=["Products"]
)

logger = logging.getLogger(__name__)


def validate_file_safety(filename: str, file_bytes: bytes, allowed_exts: list[str] | None = None):
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_MB} MB."
        )

    ext = os.path.splitext(filename)[1].lower()
    valid_exts = allowed_exts or settings.ALLOWED_UPLOAD_EXTENSIONS
    if ext not in valid_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File extension '{ext}' is not allowed. Allowed extensions: {', '.join(valid_exts)}"
        )


@router.post("/import")
async def import_products_csv(
    file: UploadFile = File(...),
    catalog_id: int = Form(...),
    db: Session = Depends(get_db)
):
    catalog = db.query(Catalog).filter(Catalog.id == catalog_id).first()
    if not catalog:
        raise HTTPException(status_code=404, detail=f"Catalog with id {catalog_id} was not found")

    file_bytes = await file.read()
    filename = sanitize_filename(file.filename)
    validate_file_safety(filename, file_bytes, allowed_exts=[".csv", ".xlsx", ".xls"])

    parsed = parse_product_csv(file_bytes, filename=filename)
    valid_rows = parsed["valid"]
    rejected_rows = parsed["rejected"]

    ingest_result = ingest_products(db, catalog_id, valid_rows)

    return {
        "status": "success",
        "message": f"Successfully processed {len(valid_rows) + len(rejected_rows)} rows.",
        "catalog_id": catalog_id,
        "created": ingest_result["created"],
        "updated": ingest_result["updated"],
        "rejected": len(rejected_rows),
        "total": len(valid_rows) + len(rejected_rows),
        "rejected_details": rejected_rows,
    }


@router.get("/")
def get_products(
    catalog_id: int | None = Query(None),
    status: str | None = Query(None),
    q: str | None = Query(None),
    min_confidence: int | None = Query(None),
    needs_review: bool | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Product)

    if catalog_id is not None:
        query = query.filter(Product.catalog_id == catalog_id)

    if status:
        query = query.filter(Product.status == status)

    if min_confidence is not None:
        query = query.filter(Product.confidence_score >= min_confidence)

    if needs_review is True:
        # Needs review only matches products in 'needs_review' status
        query = query.filter(Product.status == "needs_review")
    elif needs_review is False:
        query = query.filter(Product.status != "needs_review")

    if q:
        search_pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Product.part_number.ilike(search_pattern),
                Product.manufacturer.ilike(search_pattern),
                Product.canonical_name.ilike(search_pattern),
                Product.category.ilike(search_pattern),
            )
        )

    total_count = query.count()
    products = query.order_by(Product.created_at.desc(), Product.id.desc()).offset(offset).limit(limit).all()

    return {
        "status": "success",
        "total": total_count,
        "limit": limit,
        "offset": offset,
        "data": products
    }


@router.get("/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = (
        db.query(Product)
        .options(
            joinedload(Product.attributes),
            joinedload(Product.source_documents),
            joinedload(Product.conflicts),
        )
        .filter(Product.id == product_id)
        .first()
    )

    if not product:
        raise HTTPException(status_code=404, detail=f"Product with id {product_id} was not found")

    return {
        "status": "success",
        "data": {
            "id": product.id,
            "catalog_id": product.catalog_id,
            "part_number": product.part_number,
            "manufacturer": product.manufacturer,
            "short_description": product.short_description,
            "category": product.category,
            "canonical_name": product.canonical_name,
            "long_description": product.long_description,
            "status": product.status,
            "completeness_score": product.completeness_score,
            "confidence_score": product.confidence_score,
            "quality_grade": product.quality_grade,
            "enriched_at": product.enriched_at,
            "model_used": product.model_used,
            "error": product.error,
            "created_at": product.created_at,
            "attributes": product.attributes,
            "sources": product.source_documents,
            "conflicts": product.conflicts,
        }
    }


@router.post("/{product_id}/documents")
async def upload_product_documents(
    product_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail=f"Product with id {product_id} was not found")

    registered_docs = []
    for file in files:
        file_bytes = await file.read()
        filename = sanitize_filename(file.filename)
        validate_file_safety(filename, file_bytes)

        source_doc = register_document(
            db=db,
            product_id=product_id,
            filename=filename,
            file_bytes=file_bytes
        )
        registered_docs.append(source_doc)

    return {
        "status": "success",
        "product_id": product_id,
        "count": len(registered_docs),
        "data": registered_docs
    }


@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail=f"Product with id {product_id} was not found")
    db.delete(product)
    db.commit()
    return {
        "status": "success",
        "message": f"Product {product_id} deleted successfully"
    }
