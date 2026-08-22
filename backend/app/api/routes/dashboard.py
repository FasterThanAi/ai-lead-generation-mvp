from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Catalog, Product, ProductAttribute, AttributeConflict

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)


def count_rows(db: Session, model, *filters):
    query = db.query(func.count(model.id))

    if filters:
        query = query.filter(*filters)

    return query.scalar() or 0


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_catalogs = count_rows(db, Catalog)
    total_products = count_rows(db, Product)
    total_attributes = count_rows(db, ProductAttribute)
    approved_attributes = count_rows(db, ProductAttribute, ProductAttribute.status == "approved")
    conflicts_open = count_rows(db, AttributeConflict, AttributeConflict.resolution == "unresolved")
    review_backlog = count_rows(
        db,
        ProductAttribute,
        ProductAttribute.status.in_(["proposed", "conflicted"])
    )

    mean_completeness = (
        db.query(func.avg(Product.completeness_score))
        .filter(Product.completeness_score.isnot(None))
        .scalar()
    )
    mean_confidence = (
        db.query(func.avg(Product.confidence_score))
        .filter(Product.confidence_score.isnot(None))
        .scalar()
    )

    recent_products = (
        db.query(Product)
        .order_by(Product.created_at.desc(), Product.id.desc())
        .limit(5)
        .all()
    )

    return {
        "status": "success",
        "data": {
            "total_catalogs": total_catalogs,
            "total_products": total_products,
            "total_attributes": total_attributes,
            "approved_attributes": approved_attributes,
            "conflicts_open": conflicts_open,
            "review_backlog": review_backlog,
            "mean_completeness": round(float(mean_completeness), 1) if mean_completeness is not None else 0.0,
            "mean_confidence": round(float(mean_confidence), 1) if mean_confidence is not None else 0.0,
            "products_by_grade": {
                "A": count_rows(db, Product, Product.quality_grade == "A"),
                "B": count_rows(db, Product, Product.quality_grade == "B"),
                "C": count_rows(db, Product, Product.quality_grade == "C"),
                "D": count_rows(db, Product, Product.quality_grade == "D"),
            },
            "products_by_status": {
                "pending": count_rows(db, Product, Product.status == "pending"),
                "enriching": count_rows(db, Product, Product.status == "enriching"),
                "needs_review": count_rows(db, Product, Product.status == "needs_review"),
                "approved": count_rows(db, Product, Product.status == "approved"),
                "failed": count_rows(db, Product, Product.status == "failed"),
            },
            "recent_products": recent_products,
        }
    }
