import csv
import io
import json
import logging
from typing import Any
from sqlalchemy.orm import Session

from app.db.models import Catalog, Product, ProductAttribute, SourceDocument, AttributeSchema
from app.utils.time_utils import utc_now

logger = logging.getLogger(__name__)


def export_catalog_csv(db: Session, catalog_id: int, approved_only: bool = True) -> bytes:
    """
    Exports a catalog in wide CSV format:
    One row per product, one column per attribute key, plus companion provenance columns:
    "<key>__source" holding "filename p.N".
    """
    catalog = db.query(Catalog).filter(Catalog.id == catalog_id).first()
    if not catalog:
        raise ValueError(f"Catalog {catalog_id} not found")

    products = db.query(Product).filter(Product.catalog_id == catalog_id).order_by(Product.id.asc()).all()

    # Collect all distinct attribute keys from schemas or product attributes
    all_keys = set()
    schemas = db.query(AttributeSchema).filter(AttributeSchema.catalog_id == catalog_id).all()
    for s in schemas:
        try:
            attrs = json.loads(s.attributes) if isinstance(s.attributes, str) else s.attributes
            for a in attrs:
                if a.get("key"):
                    all_keys.add(a["key"])
        except Exception:
            pass

    for p in products:
        for attr in p.attributes:
            if attr.key:
                all_keys.add(attr.key)

    sorted_keys = sorted(list(all_keys))

    # Build CSV headers
    base_headers = [
        "part_number",
        "manufacturer",
        "category",
        "canonical_name",
        "completeness_score",
        "confidence_score",
        "quality_grade",
        "status",
    ]

    fieldnames = list(base_headers)
    for k in sorted_keys:
        fieldnames.append(k)
        fieldnames.append(f"{k}__source")

    output = io.StringIO()
    # Write UTF-8 BOM for Excel compatibility
    output.write("\ufeff")

    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()

    for p in products:
        row: dict[str, Any] = {
            "part_number": p.part_number,
            "manufacturer": p.manufacturer or "",
            "category": p.category or "",
            "canonical_name": p.canonical_name or "",
            "completeness_score": p.completeness_score if p.completeness_score is not None else "",
            "confidence_score": p.confidence_score if p.confidence_score is not None else "",
            "quality_grade": p.quality_grade or "D",
            "status": p.status or "pending",
        }

        # Index product attributes by key
        attr_map: dict[str, ProductAttribute] = {}
        for a in p.attributes:
            if approved_only and a.status != "approved":
                continue
            if a.key not in attr_map or (a.confidence or 0) > (attr_map[a.key].confidence or 0):
                attr_map[a.key] = a

        for k in sorted_keys:
            if k in attr_map:
                attr_obj = attr_map[k]
                val = attr_obj.value_norm if attr_obj.value_norm is not None else attr_obj.value_raw
                unit_str = f" {attr_obj.unit}" if attr_obj.unit else ""
                row[k] = f"{val}{unit_str}" if val is not None else ""

                # Source provenance receipt
                source_doc = attr_obj.source
                if source_doc:
                    fn = source_doc.filename or f"Doc #{source_doc.id}"
                    page = attr_obj.page_number or source_doc.page_number
                    row[f"{k}__source"] = f"{fn} p.{page}" if page else fn
                else:
                    row[f"{k}__source"] = "Product Metadata"
            else:
                row[k] = ""
                row[f"{k}__source"] = ""

        writer.writerow(row)

    return output.getvalue().encode("utf-8")


def export_catalog_json(db: Session, catalog_id: int, approved_only: bool = True) -> bytes:
    """
    Exports a catalog in nested JSON format with full attribute specs and source receipts.
    """
    catalog = db.query(Catalog).filter(Catalog.id == catalog_id).first()
    if not catalog:
        raise ValueError(f"Catalog {catalog_id} not found")

    products = db.query(Product).filter(Product.catalog_id == catalog_id).order_by(Product.id.asc()).all()

    export_products = []
    for p in products:
        attrs_list = []
        for a in p.attributes:
            if approved_only and a.status != "approved":
                continue

            source_info = None
            if a.source:
                source_info = {
                    "id": a.source.id,
                    "filename": a.source.filename,
                    "doc_type": a.source.doc_type,
                    "page_number": a.page_number or a.source.page_number,
                    "url": a.source.url,
                    "content_hash": a.source.content_hash,
                }

            attrs_list.append({
                "id": a.id,
                "key": a.key,
                "value_raw": a.value_raw,
                "value_norm": a.value_norm,
                "unit": a.unit,
                "confidence": a.confidence,
                "status": a.status,
                "extraction_method": a.extraction_method,
                "page_number": a.page_number,
                "source": source_info,
            })

        export_products.append({
            "id": p.id,
            "part_number": p.part_number,
            "manufacturer": p.manufacturer,
            "category": p.category,
            "canonical_name": p.canonical_name,
            "short_description": p.short_description,
            "long_description": p.long_description,
            "completeness_score": p.completeness_score,
            "confidence_score": p.confidence_score,
            "quality_grade": p.quality_grade,
            "status": p.status,
            "enriched_at": p.enriched_at.isoformat() if p.enriched_at else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "attributes": attrs_list,
        })

    payload = {
        "catalog_id": catalog.id,
        "catalog_name": catalog.name,
        "vertical": catalog.vertical,
        "exported_at": utc_now().isoformat(),
        "total_products": len(export_products),
        "products": export_products,
    }

    return json.dumps(payload, indent=2).encode("utf-8")
