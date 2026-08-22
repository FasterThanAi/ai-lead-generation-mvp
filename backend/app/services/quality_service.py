import json
import logging
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import AttributeConflict, AttributeSchema, Catalog, Product, ProductAttribute, SourceDocument

logger = logging.getLogger(__name__)


def compute_attribute_confidence(
    attribute: ProductAttribute,
    schema_entry: dict | None = None,
    source: SourceDocument | None = None,
    is_corroborated: bool = False
) -> int:
    """
    Computes an adjusted confidence score (0-100) based on extraction method,
    source credibility, corroboration, and validation flags.
    """
    conf = attribute.confidence if attribute.confidence is not None else 80

    doc_type = (source.doc_type if source else (attribute.extraction_method or "")).lower()
    method = (attribute.extraction_method or "").lower()

    # Spec sheets / PDFs are authoritative
    if doc_type == "pdf":
        conf += 10
    elif method == "html":
        conf += 5
    elif method == "inferred":
        conf -= 10

    # Multi-source corroboration bonus
    if is_corroborated:
        conf += 10

    # Validation flag penalty (-15 per rule failure)
    if attribute.validation_flags:
        try:
            flags = json.loads(attribute.validation_flags) if isinstance(attribute.validation_flags, str) else attribute.validation_flags
            penalizable_flags = [f for f in flags if not str(f).startswith("normalization_failed")]
            conf -= len(penalizable_flags) * settings.VALIDATION_FLAG_PENALTY
        except Exception:
            pass

    # Unresolved conflict penalty
    if attribute.status == "conflicted":
        conf -= 20

    return max(0, min(100, conf))


def compute_product_scores(db: Session, product_id: int) -> dict:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return {"error": "Product not found"}

    # Load active schema
    schema_attrs = []
    if product.catalog_id:
        query = db.query(AttributeSchema).filter(AttributeSchema.catalog_id == product.catalog_id)
        if product.category:
            s_match = query.filter(AttributeSchema.category_name.ilike(f"%{product.category.strip()}%")).first()
            if s_match:
                schema_attrs = json.loads(s_match.attributes) if isinstance(s_match.attributes, str) else s_match.attributes
        if not schema_attrs:
            first_s = query.first()
            if first_s:
                schema_attrs = json.loads(first_s.attributes) if isinstance(first_s.attributes, str) else first_s.attributes

    if not schema_attrs:
        from app.services.extraction_service import DEFAULT_FALLBACK_SCHEMA
        schema_attrs = DEFAULT_FALLBACK_SCHEMA

    schema_map = {attr.get("key"): attr for attr in schema_attrs if attr.get("key")}
    required_keys = {k for k, v in schema_map.items() if v.get("required") is True}
    if not required_keys:
        required_keys = set(schema_map.keys())

    attributes = db.query(ProductAttribute).filter(ProductAttribute.product_id == product_id).all()

    # Determine corroborated keys
    by_key: dict[str, list[ProductAttribute]] = {}
    for a in attributes:
        if a.value_norm and a.source_id:
            by_key.setdefault(a.key, []).append(a)

    corroborated_keys = set()
    for k, a_list in by_key.items():
        distinct_sources = {a.source_id for a in a_list}
        if len(distinct_sources) >= 2:
            # Check if all normalized values agree
            first_val = str(a_list[0].value_norm).strip().lower()
            if all(str(a.value_norm).strip().lower() == first_val for a in a_list[1:]):
                corroborated_keys.add(k)

    # Compute & adjust confidence per attribute
    non_rejected_attrs = []
    filled_required_keys = set()
    needs_review_count = 0

    for attr in attributes:
        schema_entry = schema_map.get(attr.key, {})
        is_corrob = attr.key in corroborated_keys
        adjusted_conf = compute_attribute_confidence(
            attribute=attr,
            schema_entry=schema_entry,
            source=attr.source,
            is_corroborated=is_corrob
        )
        attr.confidence = adjusted_conf

        if attr.status != "rejected" and attr.value_norm is not None and str(attr.value_norm).strip() != "":
            non_rejected_attrs.append(attr)
            if attr.key in required_keys:
                filled_required_keys.add(attr.key)

        has_flags = bool(attr.validation_flags and attr.validation_flags != "[]")
        if attr.status in {"proposed", "conflicted"} and (adjusted_conf < settings.REVIEW_CONFIDENCE_THRESHOLD or has_flags):
            needs_review_count += 1

    # 1. Completeness Score (0-100)
    required_total = max(1, len(required_keys))
    required_filled = len(filled_required_keys)
    completeness_score = round(100.0 * (required_filled / required_total))
    completeness_score = max(0, min(100, completeness_score))

    # 2. Confidence Score (0-100)
    if non_rejected_attrs:
        confidence_score = round(sum(a.confidence for a in non_rejected_attrs) / len(non_rejected_attrs))
        confidence_score = max(0, min(100, confidence_score))
    else:
        confidence_score = 0

    # 3. Quality Grade A-D
    if completeness_score >= 90 and confidence_score >= 85:
        quality_grade = "A"
    elif completeness_score >= 75 and confidence_score >= 70:
        quality_grade = "B"
    elif completeness_score >= 50 and confidence_score >= 50:
        quality_grade = "C"
    else:
        quality_grade = "D"

    # 4. Product Status Determination
    all_approved = len(attributes) > 0 and all(a.status == "approved" for a in attributes if a.value_raw)
    if all_approved and completeness_score >= settings.AUTO_APPROVE_THRESHOLD:
        product.status = "approved"
    elif completeness_score >= settings.AUTO_APPROVE_THRESHOLD and confidence_score >= settings.AUTO_APPROVE_THRESHOLD and needs_review_count == 0:
        product.status = "approved"
    else:
        product.status = "needs_review"

    product.completeness_score = completeness_score
    product.confidence_score = confidence_score
    product.quality_grade = quality_grade
    db.commit()
    db.refresh(product)

    return {
        "product_id": product.id,
        "completeness_score": completeness_score,
        "confidence_score": confidence_score,
        "quality_grade": quality_grade,
        "status": product.status,
        "needs_review_count": needs_review_count,
        "required_filled": required_filled,
        "required_total": required_total,
    }


def score_catalog(db: Session, catalog_id: int) -> dict:
    catalog = db.query(Catalog).filter(Catalog.id == catalog_id).first()
    if not catalog:
        return {"error": f"Catalog {catalog_id} not found"}

    products = db.query(Product).filter(Product.catalog_id == catalog_id).all()
    total_products = len(products)

    grade_counts = {"A": 0, "B": 0, "C": 0, "D": 0}
    status_counts = {"pending": 0, "enriching": 0, "needs_review": 0, "approved": 0, "failed": 0}
    completeness_sum = 0
    confidence_sum = 0
    scored_products_count = 0

    for p in products:
        grade = p.quality_grade or "D"
        grade_counts[grade] = grade_counts.get(grade, 0) + 1
        st = p.status or "pending"
        status_counts[st] = status_counts.get(st, 0) + 1

        if p.completeness_score is not None and p.confidence_score is not None:
            completeness_sum += p.completeness_score
            confidence_sum += p.confidence_score
            scored_products_count += 1

    mean_completeness = round(completeness_sum / max(1, scored_products_count), 1) if scored_products_count else 0.0
    mean_confidence = round(confidence_sum / max(1, scored_products_count), 1) if scored_products_count else 0.0

    prod_ids = [p.id for p in products]
    total_attributes = db.query(func.count(ProductAttribute.id)).filter(ProductAttribute.product_id.in_(prod_ids)).scalar() or 0 if prod_ids else 0
    total_conflicts = db.query(func.count(AttributeConflict.id)).filter(AttributeConflict.product_id.in_(prod_ids)).scalar() or 0 if prod_ids else 0
    open_conflicts = db.query(func.count(AttributeConflict.id)).filter(
        AttributeConflict.product_id.in_(prod_ids),
        AttributeConflict.resolution == "unresolved"
    ).scalar() or 0 if prod_ids else 0

    return {
        "catalog_id": catalog.id,
        "name": catalog.name,
        "vertical": catalog.vertical,
        "total_products": total_products,
        "products_by_grade": grade_counts,
        "products_by_status": status_counts,
        "mean_completeness": mean_completeness,
        "mean_confidence": mean_confidence,
        "total_attributes": total_attributes,
        "total_conflicts": total_conflicts,
        "open_conflicts": open_conflicts,
        "review_backlog": status_counts.get("needs_review", 0),
    }
