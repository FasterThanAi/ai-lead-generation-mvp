import logging
from fastapi import APIRouter, Depends
from sqlalchemy import func, distinct
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import AttributeConflict, Catalog, Product, ProductAttribute, SourceDocument

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)

logger = logging.getLogger(__name__)


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
    attributes_approved = count_rows(db, ProductAttribute, ProductAttribute.status == "approved")
    conflicts_open = count_rows(db, AttributeConflict, AttributeConflict.resolution == "unresolved")

    # Status distribution
    products_by_status = {
        "pending": count_rows(db, Product, Product.status == "pending"),
        "enriching": count_rows(db, Product, Product.status == "enriching"),
        "needs_review": count_rows(db, Product, Product.status == "needs_review"),
        "approved": count_rows(db, Product, Product.status == "approved"),
        "failed": count_rows(db, Product, Product.status == "failed"),
    }

    # Grade distribution
    products_by_grade = {
        "A": count_rows(db, Product, Product.quality_grade == "A"),
        "B": count_rows(db, Product, Product.quality_grade == "B"),
        "C": count_rows(db, Product, Product.quality_grade == "C"),
        "D": count_rows(db, Product, Product.quality_grade == "D"),
    }

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

    review_backlog = products_by_status["needs_review"]

    recent_products = (
        db.query(Product)
        .order_by(Product.created_at.desc(), Product.id.desc())
        .limit(5)
        .all()
    )

    # 5-stage Enrichment Funnel:
    # 1. Ingested: total products
    # 2. Sourced: products with at least one SourceDocument
    # 3. Extracted: products with at least one ProductAttribute (with raw value)
    # 4. Validated: products with at least one normalized ProductAttribute
    # 5. Approved: products with status == 'approved' or approved attributes
    sourced_count = db.query(func.count(distinct(SourceDocument.product_id))).scalar() or 0
    extracted_count = db.query(func.count(distinct(ProductAttribute.product_id))).filter(
        ProductAttribute.value_raw.isnot(None)
    ).scalar() or 0
    validated_count = db.query(func.count(distinct(ProductAttribute.product_id))).filter(
        ProductAttribute.value_norm.isnot(None)
    ).scalar() or 0
    approved_count = db.query(func.count(distinct(Product.id))).filter(
        (Product.status == "approved") | (Product.id.in_(
            db.query(distinct(ProductAttribute.product_id)).filter(ProductAttribute.status == "approved")
        ))
    ).scalar() or 0

    enrichment_funnel = {
        "ingested": total_products,
        "sourced": sourced_count,
        "extracted": extracted_count,
        "validated": validated_count,
        "approved": approved_count,
    }

    return {
        "status": "success",
        "data": {
            "catalogs": total_catalogs,
            "products": total_products,
            "products_by_status": products_by_status,
            "products_by_grade": products_by_grade,
            "mean_completeness": round(float(mean_completeness), 1) if mean_completeness is not None else 0.0,
            "mean_confidence": round(float(mean_confidence), 1) if mean_confidence is not None else 0.0,
            "attributes_total": total_attributes,
            "attributes_approved": attributes_approved,
            "conflicts_open": conflicts_open,
            "review_backlog": review_backlog,
            "recent_products": recent_products,
            "enrichment_funnel": enrichment_funnel,
        }
    }
