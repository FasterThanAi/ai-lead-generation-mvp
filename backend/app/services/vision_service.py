import json
import logging
import os
from typing import Any

from google import genai
from google.genai import types

from app.core.config import settings
from app.db.models import Product
from app.services.ai_service import clean_value, extract_json_from_text

logger = logging.getLogger(__name__)


def pdf_has_text_layer(file_path: str) -> bool:
    """
    Extract text with pypdf.
    If average text per page is less than 100 characters, treat as scanned document / raster image.
    """
    if not os.path.exists(file_path):
        return False

    try:
        from pypdf import PdfReader
        reader = PdfReader(file_path)
        if not reader.pages:
            return False

        total_chars = sum(len((page.extract_text() or "").strip()) for page in reader.pages)
        avg_chars = total_chars / len(reader.pages)
        return avg_chars >= 100
    except Exception as exc:
        logger.warning("Failed to inspect PDF text layer for %s: %s", file_path, exc)
        return False


def render_pdf_pages(file_path: str, max_pages: int = 10, dpi: int = 200) -> list[tuple[int, bytes]]:
    """
    Render PDF pages to PNG bytes using PyMuPDF (fitz) at configured DPI resolution.
    """
    if not os.path.exists(file_path):
        return []

    rendered_pages = []
    try:
        import pymupdf
        doc = pymupdf.open(file_path)
        zoom = dpi / 72.0
        mat = pymupdf.Matrix(zoom, zoom)
        pages_to_render = min(len(doc), max_pages)

        for page_idx in range(pages_to_render):
            page = doc[page_idx]
            pix = page.get_pixmap(matrix=mat)
            png_bytes = pix.tobytes("png")
            rendered_pages.append((page_idx + 1, png_bytes))

        doc.close()
    except Exception as exc:
        logger.warning("Could not render PDF pages for %s: %s", file_path, exc)

    return rendered_pages


def get_cached_vision_result(content_hash: str, page_number: int) -> list[dict[str, Any]] | None:
    if not content_hash:
        return None
    cache_dir = os.path.join(settings.STORAGE_DIR, ".vision_cache")
    cache_path = os.path.join(cache_dir, f"{content_hash}_p{page_number}.json")
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as exc:
            logger.debug("Failed reading vision cache file %s: %s", cache_path, exc)
    return None


def save_vision_cache(content_hash: str, page_number: int, data: list[dict[str, Any]]):
    if not content_hash:
        return
    cache_dir = os.path.join(settings.STORAGE_DIR, ".vision_cache")
    os.makedirs(cache_dir, exist_ok=True)
    cache_path = os.path.join(cache_dir, f"{content_hash}_p{page_number}.json")
    try:
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(data, f)
    except Exception as exc:
        logger.debug("Failed writing vision cache file %s: %s", cache_path, exc)


def build_vision_prompt(
    product: Product,
    schema: list[dict[str, Any]],
    source_label: str = "",
    page_number: int = 1
) -> str:
    schema_lines = []
    for attr in schema:
        key = attr.get("key")
        label = attr.get("label", key)
        data_type = attr.get("data_type", "string")
        unit_family = attr.get("unit_family", "none")
        allowed = attr.get("allowed_values", [])
        allowed_str = f" | Allowed: {', '.join(str(a) for a in allowed)}" if allowed else ""
        schema_lines.append(f"  * {key} ({label}): data_type={data_type}, unit_family={unit_family}{allowed_str}")

    schema_section = "\n".join(schema_lines)

    return f"""You are SpecForge's Industrial Vision Extraction Agent.
Analyze this high-resolution document image ({source_label}, Page {page_number}) to extract technical product specifications.

### Target Product Identity:
- Part Number / SKU: {product.part_number}
- Manufacturer / Brand: {product.manufacturer or 'N/A'}
- Category: {product.category or 'Industrial Equipment'}
- Canonical Name: {product.canonical_name or product.short_description or 'N/A'}

### Schema Attributes to Extract:
{schema_section}

### CRITICAL VISION RULES:
1. Examine specification tables, dimensional engineering drawings, callout annotations, and technical notes.
2. IMPORTANT FOR CATALOG TABLES: In multi-row / multi-size tables, locate and extract ONLY the row matching this exact part number ({product.part_number}) or its specific size. Do NOT mix attributes from different rows.
3. Extract ONLY explicitly visible values. NEVER guess or estimate from generic visual appearance.
4. Copy `value_raw` VERBATIM from the document including units and symbols.
5. Provide `visual_evidence` describing exactly where on the page the value was found (e.g., "Top right dimension chart, row 4", "Material callout list item 2").

### Output Format:
Return ONLY a valid JSON array:
[
  {{
    "key": "pressure_rating",
    "value_raw": "600 CWP",
    "confidence": 95,
    "evidence": "600 CWP rating in table header",
    "visual_evidence": "Top-right ratings table, row 1"
  }}
]
"""


def extract_from_image(
    product: Product,
    schema: list[dict[str, Any]],
    image_bytes: bytes,
    source_label: str = "",
    mime_type: str = "image/png",
    content_hash: str | None = None,
    page_number: int = 1
) -> list[dict[str, Any]]:
    # Check vision cache
    if content_hash:
        cached = get_cached_vision_result(content_hash, page_number)
        if cached is not None:
            logger.info("Vision cache hit for content_hash=%s page=%d", content_hash, page_number)
            return cached

    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured for vision extraction.")

    prompt = build_vision_prompt(product, schema, source_label, page_number)
    valid_keys = {attr.get("key") for attr in schema if attr.get("key")}

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=[image_part, prompt],
    )

    response_text = response.text or ""
    raw_candidates = extract_json_from_text(response_text)

    if not isinstance(raw_candidates, list):
        if isinstance(raw_candidates, dict):
            raw_candidates = [raw_candidates]
        else:
            return []

    candidates = []
    for item in raw_candidates:
        if not isinstance(item, dict):
            continue
        key = item.get("key")
        value_raw = clean_value(item.get("value_raw"))
        if not key or key not in valid_keys or not value_raw:
            continue

        raw_conf = item.get("confidence", 85)
        try:
            confidence = max(0, min(100, int(raw_conf)))
        except (ValueError, TypeError):
            confidence = 85

        candidates.append({
            "key": key,
            "value_raw": value_raw,
            "confidence": confidence,
            "evidence": clean_value(item.get("evidence")),
            "visual_evidence": clean_value(item.get("visual_evidence")),
            "extraction_method": "vision",
            "page_number": page_number,
        })

    if content_hash:
        save_vision_cache(content_hash, page_number, candidates)

    return candidates
