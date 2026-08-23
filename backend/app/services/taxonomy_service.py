import json
import logging
from typing import Any
from sqlalchemy.orm import Session
from google import genai

from app.core.config import settings
from app.db.models import AttributeSchema, Product
from app.services.ai_service import extract_json_from_text
from app.services.schema_service import generate_attribute_schema
from app.utils.time_utils import utc_now

logger = logging.getLogger(__name__)

# In-memory cache for taxonomy schemas: (catalog_id, classpath) -> list[dict]
_SCHEMA_CACHE: dict[tuple[int, str], list[dict[str, Any]]] = {}


def classify_product(db: Session, product: Product) -> dict[str, Any]:
    """
    Classifies a product into a 3-tier industrial-distribution taxonomy:
    Dept > Class > Fine.
    Returns: {"dept": str, "class": str, "fine": str, "product_name": str, "confidence": int}
    """
    part_num = product.part_number or ""
    desc = product.short_description or product.long_description or ""
    manuf = product.manufacturer or product.part_manuf or ""

    classification = {
        "dept": "Industrial Supplies",
        "class": "General Hardware",
        "fine": "General Industrial",
        "product_name": desc or part_num,
        "confidence": 60,
    }

    if settings.GEMINI_API_KEY:
        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            prompt = f"""You are SpecForge's Industrial Catalog Taxonomy Classifier.
Classify the following industrial/commercial product into a 3-level industrial B2B distribution hierarchy:
- Department (Dept): Top-level broad category (e.g. Abrasives, Fasteners, Valves & Actuators, Pumps, Electrical, Tools, Plumbing, Appliances, Safety)
- Class: Intermediate sub-category (e.g. Coated Abrasives, Ball Valves, Centrifugal Pumps, Large Appliances, Hand Tools)
- Fine: Specific item category (e.g. Sanding Belts, Bronze Ball Valves, Submersible Pumps, Dishwashers, Socket Wrenches)

Input Product Information:
- Part Number: {part_num}
- Description: {desc}
- Manufacturer: {manuf}

Respond STRICTLY with a valid JSON object:
{{
  "dept": "Department Name",
  "class": "Class Name",
  "fine": "Fine Name",
  "product_name": "Standard Normalized Product Title",
  "confidence": 95
}}
"""
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
            )
            parsed = extract_json_from_text(response.text or "")
            if isinstance(parsed, dict):
                classification["dept"] = str(parsed.get("dept") or classification["dept"]).strip()
                classification["class"] = str(parsed.get("class") or parsed.get("class_name") or classification["class"]).strip()
                classification["fine"] = str(parsed.get("fine") or classification["fine"]).strip()
                classification["product_name"] = str(parsed.get("product_name") or classification["product_name"]).strip()
                classification["confidence"] = int(parsed.get("confidence") or 85)
        except Exception as exc:
            logger.warning("Gemini taxonomy classification error for %s: %s", part_num, exc)
            if product.category:
                classification["fine"] = product.category
                classification["class"] = product.category

    dept = classification["dept"]
    class_name = classification["class"]
    fine = classification["fine"]
    classpath = f"{dept}>{class_name}>{fine}"

    product.dept = dept
    product.class_name = class_name
    product.fine = fine
    product.classpath = classpath
    if classification.get("product_name"):
        product.product_name = classification["product_name"]
    if not product.category:
        product.category = fine

    db.commit()
    return classification


def get_or_create_schema(
    db: Session,
    catalog_id: int,
    dept: str | None,
    class_name: str | None,
    fine: str | None
) -> list[dict[str, Any]]:
    """
    Retrieves or dynamically generates the AttributeSchema for this category.
    Caches results by (catalog_id, classpath) so bulk files generate each schema once.
    """
    dept_str = dept or "Industrial Supplies"
    class_str = class_name or "General Hardware"
    fine_str = fine or class_str
    classpath = f"{dept_str}>{class_str}>{fine_str}"
    cache_key = (catalog_id, classpath)

    if cache_key in _SCHEMA_CACHE:
        return _SCHEMA_CACHE[cache_key]

    # Check DB for existing schema matching fine, class, or classpath
    existing = (
        db.query(AttributeSchema)
        .filter(
            AttributeSchema.catalog_id == catalog_id,
            (AttributeSchema.category_name.ilike(f"%{fine_str}%")) |
            (AttributeSchema.category_name.ilike(f"%{class_str}%")) |
            (AttributeSchema.category_name.ilike(f"%{classpath}%"))
        )
        .first()
    )

    if existing:
        try:
            attrs = json.loads(existing.attributes) if isinstance(existing.attributes, str) else existing.attributes
            if isinstance(attrs, list) and len(attrs) > 0:
                _SCHEMA_CACHE[cache_key] = attrs
                return attrs
        except Exception:
            pass

    # Gather 3-5 sample descriptions in this category for grounded schema generation
    sample_products = (
        db.query(Product)
        .filter(
            Product.catalog_id == catalog_id,
            (Product.fine == fine_str) | (Product.class_name == class_str) | (Product.category == fine_str)
        )
        .limit(5)
        .all()
    )
    samples = [
        f"{p.part_number} | {p.short_description or ''} | {p.manufacturer or ''}"
        for p in sample_products
        if p.short_description
    ]
    sample_text = "\n".join(samples) if samples else f"Sample products for category: {fine_str}"

    schema_result = generate_attribute_schema(
        db=db,
        catalog_id=catalog_id,
        category_name=fine_str,
        sample_text=sample_text
    )

    attrs = schema_result.get("attributes", [])
    _SCHEMA_CACHE[cache_key] = attrs
    return attrs
