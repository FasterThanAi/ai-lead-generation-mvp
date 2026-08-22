from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Catalog, Product, ProductAttribute, AttributeConflict

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"]
)


def count_rows(db: Session, model, *filters):
    query = db.query(func.count(model.id))

    if filters:
        query = query.filter(*filters)

    return query.scalar() or 0


@router.get("/catalog/{catalog_id}")
def get_catalog_analytics(catalog_id: int, db: Session = Depends(get_db)):
    catalog = db.query(Catalog).filter(Catalog.id == catalog_id).first()

    if not catalog:
        raise HTTPException(
            status_code=404,
            detail=f"Catalog with id {catalog_id} was not found"
        )

    product_count = count_rows(db, Product, Product.catalog_id == catalog_id)
    approved_products = count_rows(db, Product, Product.catalog_id == catalog_id, Product.status == "approved")
    needs_review = count_rows(db, Product, Product.catalog_id == catalog_id, Product.status == "needs_review")

    mean_completeness = (
        db.query(func.avg(Product.completeness_score))
        .filter(
            Product.catalog_id == catalog_id,
            Product.completeness_score.isnot(None),
        )
        .scalar()
    )
    mean_confidence = (
        db.query(func.avg(Product.confidence_score))
        .filter(
            Product.catalog_id == catalog_id,
            Product.confidence_score.isnot(None),
        )
        .scalar()
    )

    return {
        "status": "success",
        "data": {
            "catalog_id": catalog.id,
            "catalog_name": catalog.name,
            "product_count": product_count,
            "approved_products": approved_products,
            "needs_review": needs_review,
            "mean_completeness": round(float(mean_completeness), 1) if mean_completeness is not None else 0.0,
            "mean_confidence": round(float(mean_confidence), 1) if mean_confidence is not None else 0.0,
            "products_by_grade": {
                "A": count_rows(db, Product, Product.catalog_id == catalog_id, Product.quality_grade == "A"),
                "B": count_rows(db, Product, Product.catalog_id == catalog_id, Product.quality_grade == "B"),
                "C": count_rows(db, Product, Product.catalog_id == catalog_id, Product.quality_grade == "C"),
                "D": count_rows(db, Product, Product.catalog_id == catalog_id, Product.quality_grade == "D"),
            },
        }
    }
