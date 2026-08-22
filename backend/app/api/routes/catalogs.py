import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Catalog, Product, EnrichmentJob
from app.schemas.catalog_schema import CatalogCreate, CatalogResponse

router = APIRouter(
    prefix="/catalogs",
    tags=["Catalogs"]
)

logger = logging.getLogger(__name__)


@router.post("/", response_model=CatalogResponse)
@router.post("/create", response_model=CatalogResponse)
def create_catalog(catalog_in: CatalogCreate, db: Session = Depends(get_db)):
    new_catalog = Catalog(
        name=catalog_in.name,
        vertical=catalog_in.vertical,
        description=catalog_in.description,
    )
    db.add(new_catalog)
    db.commit()
    db.refresh(new_catalog)
    return new_catalog


@router.get("/")
def get_catalogs(db: Session = Depends(get_db)):
    catalogs = db.query(Catalog).order_by(Catalog.created_at.desc(), Catalog.id.desc()).all()
    return {
        "status": "success",
        "data": catalogs
    }


@router.get("/{catalog_id}")
def get_catalog(catalog_id: int, db: Session = Depends(get_db)):
    catalog = db.query(Catalog).filter(Catalog.id == catalog_id).first()
    if not catalog:
        raise HTTPException(status_code=404, detail=f"Catalog with id {catalog_id} was not found")
    return {
        "status": "success",
        "data": catalog
    }


@router.delete("/{catalog_id}")
def delete_catalog(catalog_id: int, db: Session = Depends(get_db)):
    catalog = db.query(Catalog).filter(Catalog.id == catalog_id).first()
    if not catalog:
        raise HTTPException(status_code=404, detail=f"Catalog with id {catalog_id} was not found")
    db.delete(catalog)
    db.commit()
    return {
        "status": "success",
        "message": f"Catalog {catalog_id} deleted successfully"
    }


@router.get("/{catalog_id}/summary")
def get_catalog_summary(catalog_id: int, db: Session = Depends(get_db)):
    catalog = db.query(Catalog).filter(Catalog.id == catalog_id).first()
    if not catalog:
        raise HTTPException(status_code=404, detail=f"Catalog with id {catalog_id} was not found")

    total_products = db.query(func.count(Product.id)).filter(Product.catalog_id == catalog_id).scalar() or 0
    approved_products = db.query(func.count(Product.id)).filter(
        Product.catalog_id == catalog_id,
        Product.status == "approved"
    ).scalar() or 0
    needs_review = db.query(func.count(Product.id)).filter(
        Product.catalog_id == catalog_id,
        Product.status == "needs_review"
    ).scalar() or 0
    mean_completeness = db.query(func.avg(Product.completeness_score)).filter(
        Product.catalog_id == catalog_id,
        Product.completeness_score.isnot(None)
    ).scalar() or 0
    mean_confidence = db.query(func.avg(Product.confidence_score)).filter(
        Product.catalog_id == catalog_id,
        Product.confidence_score.isnot(None)
    ).scalar() or 0

    return {
        "status": "success",
        "data": {
            "catalog_id": catalog.id,
            "name": catalog.name,
            "vertical": catalog.vertical,
            "total_products": total_products,
            "approved_products": approved_products,
            "needs_review": needs_review,
            "mean_completeness": round(float(mean_completeness), 1),
            "mean_confidence": round(float(mean_confidence), 1),
        }
    }
