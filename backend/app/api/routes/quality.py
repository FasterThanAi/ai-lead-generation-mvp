import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Product, Catalog

router = APIRouter(
    prefix="/quality",
    tags=["Quality"]
)

logger = logging.getLogger(__name__)


@router.post("/product/{product_id}/score")
def score_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail=f"Product with id {product_id} was not found")

    return {
        "status": "success",
        "message": "Quality scoring endpoint ready (Phase 7)",
        "product_id": product_id,
        "completeness_score": product.completeness_score,
        "confidence_score": product.confidence_score,
        "quality_grade": product.quality_grade,
    }


@router.get("/catalog/{catalog_id}/summary")
def get_catalog_quality_summary(catalog_id: int, db: Session = Depends(get_db)):
    catalog = db.query(Catalog).filter(Catalog.id == catalog_id).first()
    if not catalog:
        raise HTTPException(status_code=404, detail=f"Catalog with id {catalog_id} was not found")

    return {
        "status": "success",
        "message": "Catalog quality summary ready (Phase 7)",
        "catalog_id": catalog_id,
    }
