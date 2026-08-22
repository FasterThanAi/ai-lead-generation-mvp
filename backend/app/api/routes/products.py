import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.db.database import get_db
from app.db.models import Catalog, Product, ProductAttribute, SourceDocument, AttributeConflict
from app.schemas.product_schema import ProductCreate, ProductResponse

router = APIRouter(
    prefix="/products",
    tags=["Products"]
)

logger = logging.getLogger(__name__)


@router.post("/", response_model=ProductResponse)
@router.post("/create", response_model=ProductResponse)
def create_product(product_in: ProductCreate, db: Session = Depends(get_db)):
    catalog = db.query(Catalog).filter(Catalog.id == product_in.catalog_id).first()
    if not catalog:
        raise HTTPException(status_code=404, detail=f"Catalog with id {product_in.catalog_id} was not found")

    new_product = Product(
        catalog_id=product_in.catalog_id,
        part_number=product_in.part_number,
        manufacturer=product_in.manufacturer,
        short_description=product_in.short_description,
        category=product_in.category,
        canonical_name=product_in.canonical_name,
        long_description=product_in.long_description,
        status="pending",
    )
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product


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
        query = query.filter(Product.status.in_(["needs_review", "pending"]))

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
def get_product_detail(product_id: int, db: Session = Depends(get_db)):
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
