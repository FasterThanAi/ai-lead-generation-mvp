import json
import logging
import re
from typing import Any
from sqlalchemy.orm import Session

from app.db.models import AttributeSchema, Product, ProductAttribute

logger = logging.getLogger(__name__)

# ============================================================================
# CONVERSION CONSTANTS (Pure deterministic Python, verified physical standards)
# ============================================================================
INCH_TO_MM = 25.4               # 1 inch = 25.4 mm (exact international inch standard)
FEET_TO_MM = 304.8              # 1 foot = 12 * 25.4 = 304.8 mm
CM_TO_MM = 10.0                 # 1 centimeter = 10 mm
METER_TO_MM = 1000.0            # 1 meter = 1000 mm

BAR_TO_PSI = 14.503773773       # 1 bar = 100,000 Pa / 6894.757 = 14.503773773 psi (10 bar = 145.0377 psi)
KPA_TO_PSI = 0.14503773773      # 1 kPa = 0.1450377 psi
MPA_TO_PSI = 145.03773773       # 1 MPa = 1000 kPa = 145.0377 psi
ATM_TO_PSI = 14.695948775       # 1 standard atmosphere = 14.6959 psi

LB_TO_KG = 0.45359237           # 1 avoirdupois pound = 0.45359237 kg (exact standard)
OZ_TO_KG = 0.028349523125       # 1 ounce = 1/16 lb = 0.028349523125 kg
GRAM_TO_KG = 0.001              # 1 gram = 0.001 kg


def format_number(val: float) -> str:
    """Format float to max 4 decimal places, trimming trailing zeros."""
    rounded = round(val, 4)
    if rounded == int(rounded):
        return str(int(rounded))
    formatted = f"{rounded:.4f}".rstrip("0").rstrip(".")
    return formatted


def parse_fraction_or_number(s: str) -> float | None:
    """
    Parse numbers, fractions (1/2, 3/4), and mixed numbers (1-1/2, 1 1/2, .5).
    """
    cleaned = s.strip().replace(",", ".")
    # Mixed number: e.g. "1-1/2" or "1 1/2"
    mixed_match = re.match(r"^(\d+)[\s\-]+(\d+)\s*\/\s*(\d+)$", cleaned)
    if mixed_match:
        whole = float(mixed_match.group(1))
        num = float(mixed_match.group(2))
        denom = float(mixed_match.group(3))
        if denom != 0:
            return whole + (num / denom)

    # Simple fraction: e.g. "1/2", "3/4", "5/16"
    frac_match = re.match(r"^(\d+)\s*\/\s*(\d+)$", cleaned)
    if frac_match:
        num = float(frac_match.group(1))
        denom = float(frac_match.group(2))
        if denom != 0:
            return num / denom

    # Decimal or integer: e.g. "0.5", ".5", "12.7", "600"
    num_match = re.match(r"^([+\-]?\d*\.?\d+)$", cleaned)
    if num_match and num_match.group(1) not in {"", ".", "+", "-"}:
        try:
            return float(num_match.group(1))
        except ValueError:
            return None

    return None


def normalize_length(raw: str) -> tuple[str | None, str | None, str | None]:
    """
    Canonical length unit: mm.
    Handles: 1/2", 1/2 in, 0.5 inch, .5", 12.7mm, 12,7 mm, 1-1/2", 1 1/2 in, 25 cm, 2 ft
    """
    if not raw:
        return None, None, "Empty input"

    text = str(raw).strip().replace("“", '"').replace("”", '"').replace("″", '"').replace("′", "'")

    # Check for mm
    mm_match = re.search(r"([\d\.,]+)\s*(?:mm|millimeter|millimetre)s?", text, re.IGNORECASE)
    if mm_match:
        val = parse_fraction_or_number(mm_match.group(1))
        if val is not None:
            return format_number(val), "mm", None

    # Check for cm
    cm_match = re.search(r"([\d\.,]+)\s*(?:cm|centimeter|centimetre)s?", text, re.IGNORECASE)
    if cm_match:
        val = parse_fraction_or_number(cm_match.group(1))
        if val is not None:
            return format_number(val * CM_TO_MM), "mm", None

    # Check for feet / ft
    ft_match = re.search(r"([\d\.,\s\-\/]+)\s*(?:ft|feet|foot|')", text, re.IGNORECASE)
    if ft_match:
        val = parse_fraction_or_number(ft_match.group(1))
        if val is not None:
            return format_number(val * FEET_TO_MM), "mm", None

    # Check for inches: e.g. 1/2", 1 1/2 in, 1-1/2", 0.5 inch, 3/4 NPT
    # Strip trailing thread names like NPT if present in size
    cleaned_inch = re.sub(r"\b(npt|fnpt|mnpt|bsp|bspt|threaded|nominal|dn\s*\d+)\b", "", text, flags=re.IGNORECASE).strip()
    inch_match = re.search(r"([\d\.,\s\-\/]+)\s*(?:\"|in|inch|inches)?", cleaned_inch, re.IGNORECASE)
    if inch_match:
        num_str = inch_match.group(1).strip()
        val = parse_fraction_or_number(num_str)
        if val is not None:
            return format_number(val * INCH_TO_MM), "mm", None

    return None, None, f"Could not normalize length: {raw}"


def normalize_pressure(raw: str) -> tuple[str | None, str | None, str | None]:
    """
    Canonical pressure unit: psi.
    Handles: 600 WOG, 600WOG, 150 PSI, 150#, 600 CWP, 600 psig, 10 bar, 1000 kPa, 2.5 MPa
    """
    if not raw:
        return None, None, "Empty input"

    text = str(raw).strip()

    # Bar
    bar_match = re.search(r"([\d\.,]+)\s*(?:bar|barg)\b", text, re.IGNORECASE)
    if bar_match:
        val = parse_fraction_or_number(bar_match.group(1))
        if val is not None:
            return format_number(val * BAR_TO_PSI), "psi", None

    # MPa
    mpa_match = re.search(r"([\d\.,]+)\s*(?:mpa|megapascal)s?\b", text, re.IGNORECASE)
    if mpa_match:
        val = parse_fraction_or_number(mpa_match.group(1))
        if val is not None:
            return format_number(val * MPA_TO_PSI), "psi", None

    # kPa
    kpa_match = re.search(r"([\d\.,]+)\s*(?:kpa|kilopascal)s?\b", text, re.IGNORECASE)
    if kpa_match:
        val = parse_fraction_or_number(kpa_match.group(1))
        if val is not None:
            return format_number(val * KPA_TO_PSI), "psi", None

    # PSI, WOG, CWP, SWP, # (class/pound rating), class, bar, mpa, kpa
    psi_match = re.search(r"([\d\.,]+)\s*(?:psi|psig|psia|wog|cwp|swp|class|lbs?|#)(?:[\s\b]|$)", text, re.IGNORECASE)
    if psi_match:
        val = parse_fraction_or_number(psi_match.group(1))
        if val is not None:
            return format_number(val), "psi", None

    # Bare number fallback if in pressure context
    bare_match = re.search(r"^([\d\.,]+)$", text)
    if bare_match:
        val = parse_fraction_or_number(bare_match.group(1))
        if val is not None:
            return format_number(val), "psi", None

    return None, None, f"Could not normalize pressure: {raw}"


def f_to_c(fahrenheit: float) -> float:
    return (fahrenheit - 32.0) * (5.0 / 9.0)


def normalize_single_temperature(s: str) -> tuple[str | None, str | None]:
    text = s.strip().replace("°", "").replace("deg", "").strip()

    # Celsius
    c_match = re.search(r"([+\-]?\s*[\d\.,]+)\s*c\b", text, re.IGNORECASE)
    if c_match:
        clean_num = c_match.group(1).replace(" ", "")
        val = parse_fraction_or_number(clean_num)
        if val is not None:
            return format_number(val), "C"

    # Fahrenheit
    f_match = re.search(r"([+\-]?\s*[\d\.,]+)\s*f\b", text, re.IGNORECASE)
    if f_match:
        clean_num = f_match.group(1).replace(" ", "")
        val = parse_fraction_or_number(clean_num)
        if val is not None:
            return format_number(f_to_c(val)), "C"

    # Bare number
    num_val = parse_fraction_or_number(text)
    if num_val is not None:
        return format_number(f_to_c(num_val)), "C"

    return None, None


def normalize_temperature(raw: str) -> tuple[str | None, str | None, str | None]:
    """
    Canonical temperature unit: Celsius (C).
    Handles: -20F, -20 °F, 400 degF, 200C, -28.9 °C, ranges like "-20F to 400F"
    """
    if not raw:
        return None, None, "Empty input"

    text = str(raw).strip()

    # Check for range: e.g. "-20F to 400F", "-20°F .. 400°F"
    range_split = re.split(r"\s*(?:to|\.\.|\bthru\b)\s*", text, flags=re.IGNORECASE)
    if len(range_split) == 2:
        val1, u1 = normalize_single_temperature(range_split[0])
        val2, u2 = normalize_single_temperature(range_split[1])
        if val1 is not None and val2 is not None:
            return f"{val1} to {val2}", "C", None
        elif val1 is not None:
            return val1, "C", None
        elif val2 is not None:
            return val2, "C", None

    # Single temperature
    val, unit = normalize_single_temperature(text)
    if val is not None:
        return val, "C", None

    return None, None, f"Could not normalize temperature: {raw}"


def normalize_mass(raw: str) -> tuple[str | None, str | None, str | None]:
    """
    Canonical mass unit: kg.
    Handles: lb, lbs, kg, g, oz
    """
    if not raw:
        return None, None, "Empty input"

    text = str(raw).strip()

    # kg
    kg_match = re.search(r"([\d\.,]+)\s*(?:kg|kilogram)s?\b", text, re.IGNORECASE)
    if kg_match:
        val = parse_fraction_or_number(kg_match.group(1))
        if val is not None:
            return format_number(val), "kg", None

    # g
    g_match = re.search(r"([\d\.,]+)\s*(?:g|gram)s?\b", text, re.IGNORECASE)
    if g_match:
        val = parse_fraction_or_number(g_match.group(1))
        if val is not None:
            return format_number(val * GRAM_TO_KG), "kg", None

    # oz
    oz_match = re.search(r"([\d\.,]+)\s*(?:oz|ounce)s?\b", text, re.IGNORECASE)
    if oz_match:
        val = parse_fraction_or_number(oz_match.group(1))
        if val is not None:
            return format_number(val * OZ_TO_KG), "kg", None

    # lbs / lb
    lb_match = re.search(r"([\d\.,]+)\s*(?:lbs?|pound)s?\b", text, re.IGNORECASE)
    if lb_match:
        val = parse_fraction_or_number(lb_match.group(1))
        if val is not None:
            return format_number(val * LB_TO_KG), "kg", None

    # Bare number
    bare_val = parse_fraction_or_number(text)
    if bare_val is not None:
        return format_number(bare_val * LB_TO_KG), "kg", None

    return None, None, f"Could not normalize mass: {raw}"


def normalize_thread(raw: str) -> tuple[str | None, str | None, str | None]:
    """
    Canonical thread/connection tokens:
    npt_female, npt_male, flanged, socket_weld, butt_weld, bsp, bspt, threaded, npt
    """
    if not raw:
        return None, None, "Empty input"

    text = str(raw).strip().lower()
    text_clean = re.sub(r"[\s\-_]+", " ", text)

    if any(k in text_clean for k in ("fnpt", "female npt", "npt female", "f npt", "fnpt x fnpt")):
        return "npt_female", None, None
    if any(k in text_clean for k in ("mnpt", "male npt", "npt male", "m npt")):
        return "npt_male", None, None
    if "flanged" in text_clean or "flange" in text_clean:
        return "flanged", None, None
    if "socket weld" in text_clean or "sw" == text_clean:
        return "socket_weld", None, None
    if "butt weld" in text_clean or "bw" == text_clean:
        return "butt_weld", None, None
    if "bspt" in text_clean:
        return "bspt", None, None
    if "bsp" in text_clean or "bspp" in text_clean:
        return "bsp", None, None
    if "npt" in text_clean:
        return "npt_female" if "female" in text_clean else "npt", None, None
    if "threaded" in text_clean:
        return "threaded", None, None

    return text_clean.replace(" ", "_"), None, None


def normalize_material(raw: str) -> tuple[str | None, str | None, str | None]:
    """
    Canonical material tokens:
    stainless_304, stainless_316, bronze, brass, carbon_steel, cast_iron, ductile_iron, pvc, cpvc, ptfe
    """
    if not raw:
        return None, None, "Empty input"

    text = str(raw).strip().lower()
    text_clean = re.sub(r"[\s\-_]+", " ", text)

    if any(k in text_clean for k in ("304", "t304", "ss304", "ss 304", "304 ss", "stainless 304", "stainless steel 304", "cf8")):
        return "stainless_304", None, None
    if any(k in text_clean for k in ("316", "t316", "ss316", "ss 316", "316 ss", "stainless 316", "stainless steel 316", "cf8m")):
        return "stainless_316", None, None
    if "bronze" in text_clean or "b584" in text_clean or "c84400" in text_clean:
        return "bronze", None, None
    if "brass" in text_clean or "b16" in text_clean:
        return "brass", None, None
    if "carbon steel" in text_clean or "wcb" in text_clean or "a216" in text_clean:
        return "carbon_steel", None, None
    if "ductile iron" in text_clean or "a536" in text_clean:
        return "ductile_iron", None, None
    if "cast iron" in text_clean or "a126" in text_clean:
        return "cast_iron", None, None
    if "cpvc" in text_clean:
        return "cpvc", None, None
    if "pvc" in text_clean:
        return "pvc", None, None
    if "ptfe" in text_clean or "rptfe" in text_clean or "teflon" in text_clean:
        return "ptfe", None, None

    # Fallback to sanitized token
    token = re.sub(r"[^\w\s]", "", text_clean).strip().replace(" ", "_")
    return token or None, None, None


def normalize_boolean(raw: str) -> tuple[str | None, str | None, str | None]:
    """
    Canonical booleans: "true" / "false".
    """
    if raw is None:
        return None, None, "Empty input"

    text = str(raw).strip().lower()
    if text in {"yes", "y", "true", "t", "1", "✓", "x", "standard", "included", "active"}:
        return "true", None, None
    if text in {"no", "n", "false", "f", "0", "-", "none", "n/a", "optional", "inactive"}:
        return "false", None, None

    return None, None, f"Could not normalize boolean: {raw}"


def normalize_enum(raw: str, allowed_values: list[str]) -> tuple[str | None, str | None, str | None]:
    if not raw:
        return None, None, "Empty input"

    text = str(raw).strip().lower()
    text_norm = re.sub(r"[\s\-_]+", "", text)

    for val in allowed_values:
        val_str = str(val).strip().lower()
        val_norm = re.sub(r"[\s\-_]+", "", val_str)
        if text_norm == val_norm or text == val_str:
            return val_str, None, None

    # Partial / substring match
    for val in allowed_values:
        val_str = str(val).strip().lower()
        val_norm = re.sub(r"[\s\-_]+", "", val_str)
        if val_norm in text_norm or text_norm in val_norm:
            return val_str, None, None

    return None, None, f"Value '{raw}' did not match allowed enum values: {allowed_values}"


def normalize_value(
    raw: str,
    unit_family: str | None = "none",
    data_type: str | None = "string",
    allowed_values: list[str] | None = None
) -> dict[str, Any]:
    if raw is None or str(raw).strip() == "":
        return {"value_norm": None, "unit": None, "note": "Empty value"}

    raw_str = str(raw).strip()
    fam = (unit_family or "none").lower()
    dtype = (data_type or "string").lower()

    if fam == "length":
        val, u, note = normalize_length(raw_str)
        return {"value_norm": val, "unit": u, "note": note}

    if fam == "pressure":
        val, u, note = normalize_pressure(raw_str)
        return {"value_norm": val, "unit": u, "note": note}

    if fam == "temperature":
        val, u, note = normalize_temperature(raw_str)
        return {"value_norm": val, "unit": u, "note": note}

    if fam == "mass":
        val, u, note = normalize_mass(raw_str)
        return {"value_norm": val, "unit": u, "note": note}

    # Data type fallbacks when unit_family is none
    if dtype == "boolean":
        val, u, note = normalize_boolean(raw_str)
        return {"value_norm": val, "unit": u, "note": note}

    if dtype == "enum" and allowed_values:
        val, u, note = normalize_enum(raw_str, allowed_values)
        return {"value_norm": val, "unit": u, "note": note}

    if dtype == "number":
        num = parse_fraction_or_number(raw_str)
        if num is not None:
            return {"value_norm": format_number(num), "unit": None, "note": None}

    # Common domain helpers
    if allowed_values:
        val, u, note = normalize_enum(raw_str, allowed_values)
        if val is not None:
            return {"value_norm": val, "unit": u, "note": note}

    return {"value_norm": raw_str, "unit": None, "note": None}


def normalize_product_attributes(db: Session, product_id: int) -> dict[str, int]:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return {"normalized": 0, "failed": 0, "skipped": 0}

    # Load schema for product
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

    # Fallback to default schema if empty
    if not schema_attrs:
        from app.services.extraction_service import DEFAULT_FALLBACK_SCHEMA
        schema_attrs = DEFAULT_FALLBACK_SCHEMA

    schema_map = {attr.get("key"): attr for attr in schema_attrs if attr.get("key")}

    attributes = db.query(ProductAttribute).filter(ProductAttribute.product_id == product_id).all()

    normalized_count = 0
    failed_count = 0
    skipped_count = 0

    for attr in attributes:
        if not attr.value_raw:
            skipped_count += 1
            continue

        schema_def = schema_map.get(attr.key, {})
        unit_family = schema_def.get("unit_family", "none")
        data_type = schema_def.get("data_type", "string")
        allowed_values = schema_def.get("allowed_values", [])

        # Domain specific heuristics if not explicitly in schema
        if unit_family == "none":
            if "material" in attr.key:
                val, _, _ = normalize_material(attr.value_raw)
                if val:
                    attr.value_norm = val
                    attr.unit = None
                    normalized_count += 1
                    continue
            elif "connection" in attr.key or "thread" in attr.key:
                val, _, _ = normalize_thread(attr.value_raw)
                if val:
                    attr.value_norm = val
                    attr.unit = None
                    normalized_count += 1
                    continue

        norm_result = normalize_value(
            raw=attr.value_raw,
            unit_family=unit_family,
            data_type=data_type,
            allowed_values=allowed_values
        )

        if norm_result.get("value_norm") is not None:
            attr.value_norm = norm_result["value_norm"]
            attr.unit = norm_result["unit"]
            normalized_count += 1
        else:
            attr.value_norm = None
            flags = []
            if attr.validation_flags:
                try:
                    flags = json.loads(attr.validation_flags) if isinstance(attr.validation_flags, str) else attr.validation_flags
                except Exception:
                    flags = []
            flags.append(f"normalization_failed:{norm_result.get('note', 'unrecognized')}")
            attr.validation_flags = json.dumps(flags)
            failed_count += 1

    db.commit()

    return {
        "normalized": normalized_count,
        "failed": failed_count,
        "skipped": skipped_count,
    }
