import json
import logging
import re
from typing import Any
from google import genai
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import AttributeConflict, AttributeSchema, Product, ProductAttribute, SourceDocument
from app.services.ai_service import clean_value, extract_json_from_text
from app.utils.time_utils import utc_now

logger = logging.getLogger(__name__)

# Allowed units per family
EXPECTED_FAMILY_UNITS = {
    "length": {"mm", "cm", "in", "inch", "ft", "meter", "m"},
    "pressure": {"psi", "psig", "bar", "mpa", "kpa", "atm"},
    "temperature": {"c", "f", "k"},
    "mass": {"kg", "g", "lb", "lbs", "oz"},
}

DEFAULT_PHYSICAL_BOUNDS = {
    "pressure_rating": {"min": 0.0, "max": 20000.0},
    "temp_range_min": {"min": -273.15, "max": 1000.0},
    "temp_range_max": {"min": -200.0, "max": 2500.0},
    "size_nominal": {"min": 0.1, "max": 5000.0},
    "weight": {"min": 0.001, "max": 50000.0},
}


# ============================================================================
# TASK A — Rule-Based Validation (NO AI CALLS)
# ============================================================================

def validate_attribute(attribute: ProductAttribute, schema_entry: dict[str, Any]) -> list[str]:
    """
    Pure rule-based validation against schema constraints.
    Returns list of flag strings.
    """
    flags = []
    val_norm = attribute.value_norm
    unit = (attribute.unit or "").lower()
    dtype = (schema_entry.get("data_type") or "string").lower()
    family = (schema_entry.get("unit_family") or "none").lower()
    is_required = schema_entry.get("required") is True
    allowed_values = schema_entry.get("allowed_values") or []
    min_val = schema_entry.get("min")
    max_val = schema_entry.get("max")

    # Inherit existing normalization flags
    if attribute.validation_flags:
        try:
            existing_flags = json.loads(attribute.validation_flags) if isinstance(attribute.validation_flags, str) else attribute.validation_flags
            for f in existing_flags:
                if f.startswith("normalization_failed") and f not in flags:
                    flags.append(f)
        except Exception:
            pass

    # 1. missing_required
    if is_required and (val_norm is None or str(val_norm).strip() == ""):
        flags.append("missing_required")

    if val_norm is not None and str(val_norm).strip() != "":
        val_str = str(val_norm).strip()

        # 2. type_mismatch
        numeric_val = None
        if dtype == "number" or family in {"length", "pressure", "temperature", "mass"}:
            # If range like "-20 to 200", extract the first number for basic check
            first_num_match = re.match(r"^([+\-]?\d*\.?\d+)", val_str)
            if first_num_match:
                try:
                    numeric_val = float(first_num_match.group(1))
                except ValueError:
                    flags.append("type_mismatch")
            else:
                flags.append("type_mismatch")

        # 3. enum_violation
        if dtype == "enum" and allowed_values:
            allowed_tokens = [str(a).strip().lower().replace(" ", "_") for a in allowed_values]
            if val_str.lower().replace(" ", "_") not in allowed_tokens:
                flags.append("enum_violation")

        # 4. out_of_range:min / out_of_range:max
        effective_min = min_val if min_val is not None else DEFAULT_PHYSICAL_BOUNDS.get(attribute.key, {}).get("min")
        effective_max = max_val if max_val is not None else DEFAULT_PHYSICAL_BOUNDS.get(attribute.key, {}).get("max")

        if numeric_val is not None:
            if effective_min is not None and numeric_val < effective_min:
                flags.append("out_of_range:min")
            if effective_max is not None and numeric_val > effective_max:
                flags.append("out_of_range:max")

        # 5. unit_family_mismatch
        if family != "none" and family in EXPECTED_FAMILY_UNITS:
            valid_units = EXPECTED_FAMILY_UNITS[family]
            if unit and unit not in valid_units:
                flags.append("unit_family_mismatch")

    # 6. low_confidence
    if attribute.confidence is not None and attribute.confidence < 60:
        flags.append("low_confidence")

    # Deduplicate flags
    unique_flags = list(dict.fromkeys(flags))

    # Apply confidence penalties
    current_conf = attribute.confidence if attribute.confidence is not None else 80
    penalty = len([f for f in unique_flags if not f.startswith("normalization_failed")]) * settings.VALIDATION_FLAG_PENALTY
    new_conf = max(5, current_conf - penalty)
    attribute.confidence = new_conf

    return unique_flags


def validate_product(db: Session, product_id: int) -> dict[str, int]:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return {"valid": 0, "flagged": 0, "missing_required": 0}

    # Load schema
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

    existing_attributes = db.query(ProductAttribute).filter(ProductAttribute.product_id == product_id).all()
    present_keys = set()

    valid_count = 0
    flagged_count = 0

    for attr in existing_attributes:
        present_keys.add(attr.key)
        schema_def = schema_map.get(attr.key, {"key": attr.key, "data_type": "string", "unit_family": "none"})
        flags = validate_attribute(attr, schema_def)
        attr.validation_flags = json.dumps(flags)
        if flags:
            flagged_count += 1
        else:
            valid_count += 1

    # Detect missing required schema attributes
    missing_required_count = 0
    for key, schema_def in schema_map.items():
        if schema_def.get("required") is True and key not in present_keys:
            placeholder = ProductAttribute(
                product_id=product_id,
                key=key,
                value_raw=None,
                value_norm=None,
                confidence=0,
                status="proposed",
                validation_flags=json.dumps(["missing_required"]),
            )
            db.add(placeholder)
            missing_required_count += 1
            flagged_count += 1

    db.commit()

    return {
        "valid": valid_count,
        "flagged": flagged_count,
        "missing_required": missing_required_count,
    }


# ============================================================================
# TASK B — AI Plausibility Pass (Isolated Gemini LLM Call)
# ============================================================================

def ai_plausibility_check(db: Session, product_id: int) -> dict[str, Any]:
    if not settings.AI_PLAUSIBILITY_ENABLED or not settings.GEMINI_API_KEY:
        return {"skipped": True, "reason": "AI plausibility disabled or GEMINI_API_KEY missing"}

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return {"skipped": True, "reason": "Product not found"}

    attributes = db.query(ProductAttribute).filter(
        ProductAttribute.product_id == product_id,
        ProductAttribute.value_norm.isnot(None)
    ).all()

    if not attributes:
        return {"skipped": True, "reason": "No normalized attributes to check"}

    # Build compact attribute summary
    attr_lines = []
    for a in attributes:
        unit_str = f" {a.unit}" if a.unit else ""
        attr_lines.append(f"- {a.key}: {a.value_norm}{unit_str} (raw: '{a.value_raw}')")

    summary_text = "\n".join(attr_lines)

    prompt = f"""You are SpecForge's Industrial Domain Plausibility Auditor.
Given the product category and its extracted specification values below, verify whether each specification is physically, mechanically, and commercially plausible for this equipment class.

Product Category: {product.category or 'Industrial Equipment'}
Manufacturer: {product.manufacturer or 'N/A'}
Part Number: {product.part_number}

Specifications:
{summary_text}

Task:
Identify any values that are obviously contradictory, physically impossible (e.g. negative absolute pressures, plastic materials with 2000 psi ratings, temperatures exceeding material melting points), or standard extraction errors.

Return ONLY a JSON array with any implausible items. If everything is plausible, return an empty array [].
Output format:
[
  {{"key": "pressure_rating", "implausible": true, "reason": "99999 psi is physically impossible for a standard bronze valve"}}
]
"""

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )
        response_text = response.text or ""
        parsed = extract_json_from_text(response_text)

        if not isinstance(parsed, list):
            return {"skipped": False, "flagged": 0}

        flagged_count = 0
        attr_by_key = {a.key: a for a in attributes}

        for item in parsed:
            if not isinstance(item, dict):
                continue
            key = item.get("key")
            implausible = item.get("implausible")
            reason = clean_value(item.get("reason", "Implausible value for product category"))

            if key in attr_by_key and implausible is True:
                attr = attr_by_key[key]
                flags = []
                if attr.validation_flags:
                    try:
                        flags = json.loads(attr.validation_flags) if isinstance(attr.validation_flags, str) else attr.validation_flags
                    except Exception:
                        flags = []

                flag_str = f"ai_implausible:{reason}"
                if flag_str not in flags:
                    flags.append(flag_str)
                    attr.validation_flags = json.dumps(flags)
                    attr.confidence = max(5, (attr.confidence or 80) - 20)
                    flagged_count += 1

        db.commit()
        return {"skipped": False, "flagged": flagged_count}

    except Exception as exc:
        logger.warning("AI plausibility check failed for product %s: %s", product_id, exc)
        return {"skipped": True, "error": str(exc)}


# ============================================================================
# TASK C — Conflict Detection & Auto-Resolution
# ============================================================================

def values_disagree(val1: str | None, val2: str | None) -> bool:
    if val1 is None or val2 is None:
        return val1 != val2

    s1 = str(val1).strip().lower()
    s2 = str(val2).strip().lower()

    if s1 == s2:
        return False

    # Try numeric tolerance
    try:
        f1 = float(s1)
        f2 = float(s2)
        diff = abs(f1 - f2)
        denom = max(abs(f1), abs(f2), 1e-6)
        if (diff / denom) <= settings.NUMERIC_CONFLICT_TOLERANCE:
            return False
        return True
    except (ValueError, TypeError):
        pass

    return s1 != s2


def detect_conflicts(db: Session, product_id: int) -> list[AttributeConflict]:
    attributes = (
        db.query(ProductAttribute)
        .filter(
            ProductAttribute.product_id == product_id,
            ProductAttribute.value_norm.isnot(None),
            ProductAttribute.source_id.isnot(None)
        )
        .all()
    )

    # Group by key
    by_key: dict[str, list[ProductAttribute]] = {}
    for attr in attributes:
        by_key.setdefault(attr.key, []).append(attr)

    conflicts_detected = []

    for key, attrs in by_key.items():
        # Check distinct sources
        distinct_sources = {a.source_id for a in attrs}
        if len(distinct_sources) < 2:
            continue

        # Check if values disagree
        first_val = attrs[0].value_norm
        has_disagreement = any(values_disagree(first_val, a.value_norm) for a in attrs[1:])
        if not has_disagreement:
            continue

        # Build candidate payloads
        candidates = []
        for a in attrs:
            doc = a.source
            doc_type = doc.doc_type if doc else "unknown"
            filename = doc.filename if doc else ""
            candidates.append({
                "attr_id": a.id,
                "value": a.value_norm,
                "value_raw": a.value_raw,
                "unit": a.unit,
                "confidence": a.confidence or 0,
                "source_id": a.source_id,
                "doc_type": doc_type,
                "filename": filename,
            })

        # Sort by confidence desc
        candidates.sort(key=lambda c: c["confidence"], reverse=True)
        best = candidates[0]
        second_best = candidates[1] if len(candidates) > 1 else None

        delta = (best["confidence"] - second_best["confidence"]) if second_best else best["confidence"]

        # Auto-resolve heuristic: delta >= CONFLICT_AUTO_RESOLVE_DELTA and doc_type is pdf / spec sheet
        can_autoresolve = (delta >= settings.CONFLICT_AUTO_RESOLVE_DELTA) and (best["doc_type"] == "pdf")

        if can_autoresolve:
            resolution = "auto"
            resolved_value = best["value"]
            resolved_by = "auto_resolver"
            resolved_at = utc_now()

            # Mark winning attr proposed/approved and losing attrs rejected
            for a in attrs:
                if a.id == best["attr_id"]:
                    a.status = "approved"
                else:
                    a.status = "rejected"
        else:
            resolution = "unresolved"
            resolved_value = None
            resolved_by = None
            resolved_at = None

            # Mark all as conflicted
            for a in attrs:
                a.status = "conflicted"

        # Create or update AttributeConflict record
        existing_conflict = db.query(AttributeConflict).filter(
            AttributeConflict.product_id == product_id,
            AttributeConflict.key == key
        ).first()

        if existing_conflict:
            existing_conflict.candidates = json.dumps(candidates)
            existing_conflict.resolution = resolution
            existing_conflict.resolved_value = resolved_value
            existing_conflict.resolved_by = resolved_by
            existing_conflict.resolved_at = resolved_at
            conflicts_detected.append(existing_conflict)
        else:
            new_conflict = AttributeConflict(
                product_id=product_id,
                key=key,
                candidates=json.dumps(candidates),
                resolution=resolution,
                resolved_value=resolved_value,
                resolved_by=resolved_by,
                resolved_at=resolved_at,
            )
            db.add(new_conflict)
            conflicts_detected.append(new_conflict)

    db.commit()
    return conflicts_detected
