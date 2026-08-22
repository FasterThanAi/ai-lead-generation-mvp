import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Catalog, Product
from app.services.quality_service import compute_product_scores, score_catalog

router = APIRouter(
    prefix="/quality",
    tags=["Quality"]
)

logger = logging.getLogger(__name__)


@router.post("/product/{product_id}/score")
def score_product_endpoint(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail=f"Product with id {product_id} was not found")

    scores = compute_product_scores(db, product_id)
    return {
        "status": "success",
        "data": scores
    }


@router.get("/catalog/{catalog_id}/summary")
def get_catalog_quality_summary(catalog_id: int, db: Session = Depends(get_db)):
    catalog = db.query(Catalog).filter(Catalog.id == catalog_id).first()
    if not catalog:
        raise HTTPException(status_code=404, detail=f"Catalog with id {catalog_id} was not found")

    summary = score_catalog(db, catalog_id)
    return {
        "status": "success",
        "data": summary
    }
