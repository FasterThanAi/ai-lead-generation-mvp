import json
import logging
from typing import Any
from sqlalchemy.orm import Session
from google import genai

from app.core.config import settings
from app.db.models import AttributeSchema, Catalog, SourceDocument
from app.services.ai_service import extract_json_from_text
from app.utils.time_utils import utc_now

logger = logging.getLogger(__name__)


DEFAULT_CATEGORY_TEMPLATES = {
    "ball valve": [
        {"key": "body_material", "label": "Body Material", "data_type": "string", "unit_family": "none", "allowed_values": ["bronze", "brass", "stainless_304", "stainless_316", "carbon_steel", "cast_iron", "pvc"], "required": True, "min": None, "max": None},
        {"key": "size_nominal", "label": "Nominal Pipe Size", "data_type": "number", "unit_family": "length", "allowed_values": [], "required": True, "min": 1.0, "max": 1000.0},
        {"key": "pressure_rating", "label": "Pressure Rating", "data_type": "number", "unit_family": "pressure", "allowed_values": [], "required": True, "min": 0.0, "max": 15000.0},
        {"key": "end_connection", "label": "End Connection Type", "data_type": "string", "unit_family": "none", "allowed_values": ["npt_female", "npt_male", "flanged_150", "flanged_300", "socket_weld", "butt_weld", "tri_clamp"], "required": True, "min": None, "max": None},
        {"key": "port_type", "label": "Port Construction", "data_type": "enum", "unit_family": "none", "allowed_values": ["standard_port", "full_port", "reduced_port", "v_port"], "required": False, "min": None, "max": None},
        {"key": "temp_range_min", "label": "Min Operating Temp", "data_type": "number", "unit_family": "temperature", "allowed_values": [], "required": False, "min": -273.15, "max": 1000.0},
        {"key": "temp_range_max", "label": "Max Operating Temp", "data_type": "number", "unit_family": "temperature", "allowed_values": [], "required": False, "min": -273.15, "max": 1000.0},
        {"key": "actuation_type", "label": "Actuation Type", "data_type": "string", "unit_family": "none", "allowed_values": ["lever_handle", "gear_operated", "pneumatic_actuator", "electric_actuator", "bare_stem"], "required": False, "min": None, "max": None},
    ]
}


def generate_attribute_schema(
    db: Session,
    catalog_id: int,
    category_name: str,
    sample_text: str | None = None,
    source_document_id: int | None = None,
) -> dict[str, Any]:
    """
    Uses Gemini to propose the structured attribute schema an industrial distributor
    would need for this equipment category: key, label, data_type, unit_family, allowed_values, required, bounds.
    """
    catalog = db.query(Catalog).filter(Catalog.id == catalog_id).first()
    if not catalog:
        raise ValueError(f"Catalog {catalog_id} not found")

    context_snippet = sample_text or ""
    if source_document_id:
        src = db.query(SourceDocument).filter(SourceDocument.id == source_document_id).first()
        if src and src.text_snippet:
            context_snippet = src.text_snippet[:4000]

    attributes = []

    if settings.GEMINI_API_KEY:
        try:
            prompt = f"""You are SpecForge's Industrial Taxonomy Architect.
Propose a comprehensive, standard engineering attribute schema for the industrial product category: "{category_name}".

Context Spec Sheet Evidence (if any):
{context_snippet or 'None provided'}

### Schema Design Requirements:
1. Propose between 6 and 14 critical specification attributes needed by industrial buyers and distributors (e.g. dimensions, ratings, materials, connections, certifications).
2. For each attribute, provide:
   - `key`: lowercase snake_case (e.g. "pressure_rating", "body_material", "temp_range_max")
   - `label`: title case human label (e.g. "Pressure Rating", "Body Material")
   - `data_type`: one of "string", "number", "boolean", "enum"
   - `unit_family`: one of "length", "pressure", "temperature", "mass", "none"
   - `allowed_values`: list of allowed standard string values (or empty list if numeric/open)
   - `required`: boolean (true for primary specs like size, rating, material)
   - `min`: numeric minimum bound or null
   - `max`: numeric maximum bound or null

### Return strictly a JSON array of objects:
[
  {{
    "key": "pressure_rating",
    "label": "Pressure Rating",
    "data_type": "number",
    "unit_family": "pressure",
    "allowed_values": [],
    "required": true,
    "min": 0,
    "max": 15000
  }}
]
"""
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
            )
            parsed = extract_json_from_text(response.text or "")
            if isinstance(parsed, list) and len(parsed) > 0:
                attributes = parsed
        except Exception as exc:
            logger.warning("Gemini schema generation failed: %s; falling back to templates", exc)

    if not attributes:
        # Fallback template match or generated default
        cat_key = category_name.lower().strip()
        attributes = DEFAULT_CATEGORY_TEMPLATES.get(cat_key, [
            {"key": "body_material", "label": "Body Material", "data_type": "string", "unit_family": "none", "allowed_values": ["bronze", "stainless_316", "carbon_steel", "cast_iron"], "required": True, "min": None, "max": None},
            {"key": "size_nominal", "label": "Nominal Size", "data_type": "number", "unit_family": "length", "allowed_values": [], "required": True, "min": 1.0, "max": 1000.0},
            {"key": "pressure_rating", "label": "Pressure Rating", "data_type": "number", "unit_family": "pressure", "allowed_values": [], "required": True, "min": 0.0, "max": 15000.0},
            {"key": "end_connection", "label": "End Connection", "data_type": "string", "unit_family": "none", "allowed_values": ["npt_female", "flanged_150"], "required": True, "min": None, "max": None},
        ])

    attributes_json = json.dumps(attributes)

    # Persist as draft AttributeSchema
    existing = db.query(AttributeSchema).filter(
        AttributeSchema.catalog_id == catalog_id,
        AttributeSchema.category_name.ilike(category_name.strip())
    ).first()

    if existing:
        existing.attributes = attributes_json
        existing.updated_at = utc_now()
        db.commit()
        db.refresh(existing)
        target_schema = existing
    else:
        new_schema = AttributeSchema(
            catalog_id=catalog_id,
            category_name=category_name.strip(),
            attributes=attributes_json,
        )
        db.add(new_schema)
        db.commit()
        db.refresh(new_schema)
        target_schema = new_schema

    return {
        "status": "success",
        "schema_id": target_schema.id,
        "catalog_id": catalog_id,
        "category_name": category_name.strip(),
        "attributes": attributes,
    }
