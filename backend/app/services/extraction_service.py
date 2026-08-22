import json
import logging
import os
from typing import Any

from google import genai
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import AttributeSchema, Product, ProductAttribute, SourceDocument
from app.services.ai_service import clean_value, extract_json_from_text
from app.services.document_service import extract_text_from_file
from app.services.knowledge_service import search_relevant_knowledge
from app.utils.time_utils import utc_now

logger = logging.getLogger(__name__)

DEFAULT_FALLBACK_SCHEMA = [
    {"key": "body_material", "label": "Body Material", "data_type": "string", "unit_family": "none", "allowed_values": ["bronze", "brass", "stainless_304", "stainless_316", "carbon_steel", "cast_iron", "pvc", "cpvc", "ptfe", "ductile_iron"], "required": True},
    {"key": "size_nominal", "label": "Nominal Size", "data_type": "number", "unit_family": "length", "allowed_values": [], "required": True},
    {"key": "pressure_rating", "label": "Pressure Rating", "data_type": "number", "unit_family": "pressure", "allowed_values": [], "required": True},
    {"key": "temp_range_min", "label": "Min Temperature", "data_type": "number", "unit_family": "temperature", "allowed_values": [], "required": False},
    {"key": "temp_range_max", "label": "Max Temperature", "data_type": "number", "unit_family": "temperature", "allowed_values": [], "required": False},
    {"key": "end_connection", "label": "End Connection", "data_type": "enum", "unit_family": "none", "allowed_values": ["npt_female", "npt_male", "flanged", "socket_weld", "butt_weld", "bsp", "threaded"], "required": True},
    {"key": "port_type", "label": "Port Type", "data_type": "enum", "unit_family": "none", "allowed_values": ["full_port", "standard_port", "reduced_port"], "required": False},
    {"key": "handle_material", "label": "Handle Material", "data_type": "string", "unit_family": "none", "allowed_values": [], "required": False},
    {"key": "seat_material", "label": "Seat Material", "data_type": "string", "unit_family": "none", "allowed_values": [], "required": False},
    {"key": "ball_material", "label": "Ball Material", "data_type": "string", "unit_family": "none", "allowed_values": [], "required": False},
    {"key": "stem_material", "label": "Stem Material", "data_type": "string", "unit_family": "none", "allowed_values": [], "required": False},
    {"key": "valve_operation", "label": "Operation", "data_type": "enum", "unit_family": "none", "allowed_values": ["lever", "gear", "actuated", "handwheel"], "required": False},
    {"key": "flow_coefficient_cv", "label": "Flow Coefficient (Cv)", "data_type": "number", "unit_family": "none", "allowed_values": [], "required": False},
    {"key": "weight", "label": "Weight", "data_type": "number", "unit_family": "mass", "allowed_values": [], "required": False},
    {"key": "agency_approvals", "label": "Approvals / Standards", "data_type": "string", "unit_family": "none", "allowed_values": [], "required": False},
    {"key": "country_of_origin", "label": "Country of Origin", "data_type": "string", "unit_family": "none", "allowed_values": [], "required": False},
    {"key": "warranty_years", "label": "Warranty (Years)", "data_type": "number", "unit_family": "none", "allowed_values": [], "required": False},
    {"key": "overall_length", "label": "Overall Length", "data_type": "number", "unit_family": "length", "allowed_values": [], "required": False},
    {"key": "height", "label": "Height", "data_type": "number", "unit_family": "length", "allowed_values": [], "required": False},
    {"key": "thread_standard", "label": "Thread Standard", "data_type": "string", "unit_family": "none", "allowed_values": [], "required": False},
]


def load_schema(db: Session, catalog_id: int | None, category: str | None) -> list[dict[str, Any]]:
    if catalog_id is not None:
        query = db.query(AttributeSchema).filter(AttributeSchema.catalog_id == catalog_id)
        if category:
            schema_match = query.filter(AttributeSchema.category_name.ilike(f"%{category.strip()}%")).first()
            if schema_match:
                try:
                    return json.loads(schema_match.attributes) if isinstance(schema_match.attributes, str) else schema_match.attributes
                except Exception:
                    pass

        first_schema = query.first()
        if first_schema:
            try:
                return json.loads(first_schema.attributes) if isinstance(first_schema.attributes, str) else first_schema.attributes
            except Exception:
                pass

    return DEFAULT_FALLBACK_SCHEMA


def build_extraction_prompt(
    product: Product,
    schema: list[dict[str, Any]],
    source_text: str,
    source_label: str = "",
    db: Session | None = None
) -> str:
    # Truncate source text to configured max
    max_chars = settings.EXTRACTION_MAX_CHARS
    truncated_source = (source_text or "")[:max_chars].strip()

    # RAG knowledge retrieval
    knowledge_snippets = []
    if db is not None:
        try:
            rag_query = f"{product.part_number} {product.category or ''} {product.manufacturer or ''}"
            chunks = search_relevant_knowledge(db, rag_query, limit=3)
            for chunk in chunks:
                if chunk.get("content"):
                    knowledge_snippets.append(f"- {chunk.get('title', 'Knowledge')}: {chunk.get('content')[:300]}")
        except Exception as exc:
            logger.debug("Knowledge retrieval skipped: %s", exc)

    knowledge_section = (
        "\n### Domain Taxonomy & Guidance:\n" + "\n".join(knowledge_snippets)
        if knowledge_snippets
        else ""
    )

    # Format schema definitions
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

    prompt = f"""You are SpecForge's Industrial Attribute Extraction Agent.
Your job is to extract technical specifications for an industrial product from source literature with 100% precision.

### Target Product Identity:
- Part Number / SKU: {product.part_number}
- Manufacturer / Brand: {product.manufacturer or 'N/A'}
- Category: {product.category or 'Industrial Equipment'}
- Canonical / Full Name: {product.canonical_name or product.short_description or 'N/A'}
{knowledge_section}

### Schema Attributes to Extract:
{schema_section}

### Source Document Content ({source_label or 'Technical Sheet'}):
\"\"\"
{truncated_source}
\"\"\"

### CRITICAL RULES:
1. Extract ONLY attributes that are explicitly present in the source text for this exact product or series.
2. NEVER infer, NEVER guess, and NEVER fill in values from general knowledge about the manufacturer.
3. Omit an attribute entirely rather than inventing or estimating it.
4. Copy `value_raw` VERBATIM from the source text, preserving numbers, symbols, fractions, and original unit labels (e.g., "600 CWP", "1/2 in", "-20°F to 400°F", "NPT Female").
5. Confidence must be an integer between 0 and 100 reflecting how directly and unambiguously the source states this fact.
6. Provide `evidence` as the exact quote/snippet from the source that proves the attribute value.

### Output Format:
Return ONLY a valid JSON array of objects. No explanation, no markdown text outside JSON.
Example:
[
  {{
    "key": "pressure_rating",
    "value_raw": "600 psig CWP",
    "confidence": 95,
    "evidence": "600 CWP, 150 SWP"
  }}
]
"""
    return prompt


def extract_from_source(
    db: Session,
    product: Product,
    source_document: SourceDocument,
    schema: list[dict[str, Any]] | None = None
) -> list[dict[str, Any]]:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured.")

    active_schema = schema or load_schema(db, product.catalog_id, product.category)
    doc_type = (source_document.doc_type or "pdf").lower()

    ext = f".{doc_type}" if doc_type else ".pdf"
    file_path = os.path.join(
        settings.STORAGE_DIR,
        str(product.id),
        f"{source_document.content_hash}{ext}"
    )

    from app.services.vision_service import (
        pdf_has_text_layer,
        render_pdf_pages,
        extract_from_image,
    )

    # Path 1: Image files -> direct Vision path
    if doc_type in {"image", "png", "jpg", "jpeg", "webp"}:
        if os.path.exists(file_path):
            with open(file_path, "rb") as f:
                img_bytes = f.read()
            mime = "image/png" if doc_type == "png" else "image/jpeg"
            return extract_from_image(
                product=product,
                schema=active_schema,
                image_bytes=img_bytes,
                source_label=source_document.filename or "Product Image",
                mime_type=mime,
                content_hash=source_document.content_hash,
                page_number=1
            )
        return []

    # Path 2: PDF files -> Check text layer
    if doc_type == "pdf":
        has_text = False
        if os.path.exists(file_path):
            has_text = pdf_has_text_layer(file_path)
        elif source_document.text_snippet and len(source_document.text_snippet.strip()) >= 100:
            has_text = True

        # If scanned PDF (no text layer) and vision is enabled
        if not has_text and settings.VISION_ENABLED and os.path.exists(file_path):
            logger.info("PDF %s is a scan; running Vision extraction across pages.", source_document.id)
            pages = render_pdf_pages(file_path, max_pages=settings.VISION_MAX_PAGES, dpi=settings.VISION_DPI)
            all_vision_candidates = []
            for page_num, png_bytes in pages:
                page_candidates = extract_from_image(
                    product=product,
                    schema=active_schema,
                    image_bytes=png_bytes,
                    source_label=f"{source_document.filename} (Page {page_num})",
                    mime_type="image/png",
                    content_hash=source_document.content_hash,
                    page_number=page_num
                )
                all_vision_candidates.extend(page_candidates)
            return all_vision_candidates

    # Path 3: Digital text path (PDF with text layer, docx, txt, md, html)
    source_text = source_document.text_snippet or ""
    if not source_text and os.path.exists(file_path):
        try:
            source_text = extract_text_from_file(file_path, doc_type)
            if source_text:
                source_document.text_snippet = source_text[:2000]
                db.commit()
        except Exception as exc:
            logger.warning("Could not read source file for text extraction: %s", exc)

    candidates = []
    if source_text and len(source_text.strip()) >= 10:
        valid_keys = {attr.get("key") for attr in active_schema if attr.get("key")}

        prompt = build_extraction_prompt(
            product=product,
            schema=active_schema,
            source_text=source_text,
            source_label=source_document.filename or f"Document #{source_document.id}",
            db=db
        )

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )

        response_text = response.text or ""
        raw_candidates = extract_json_from_text(response_text)

        if isinstance(raw_candidates, dict):
            raw_candidates = [raw_candidates]
        elif not isinstance(raw_candidates, list):
            raw_candidates = []

        for item in raw_candidates:
            if not isinstance(item, dict):
                continue
            key = item.get("key")
            value_raw = clean_value(item.get("value_raw"))
            if not key or key not in valid_keys or not value_raw:
                continue

            raw_conf = item.get("confidence", 80)
            try:
                confidence = max(0, min(100, int(raw_conf)))
            except (ValueError, TypeError):
                confidence = 80

            candidates.append({
                "key": key,
                "value_raw": value_raw,
                "confidence": confidence,
                "evidence": clean_value(item.get("evidence")),
                "extraction_method": "pdf" if doc_type == "pdf" else doc_type,
                "page_number": None,
            })

    # Fallback to vision if digital text extracted fewer than 5 attributes
    if len(candidates) < 5 and doc_type == "pdf" and settings.VISION_ENABLED and os.path.exists(file_path):
        logger.info("Text extraction yielded few attributes (%d); supplementing with Vision on first 3 pages.", len(candidates))
        pages = render_pdf_pages(file_path, max_pages=3, dpi=settings.VISION_DPI)
        for page_num, png_bytes in pages:
            vision_cands = extract_from_image(
                product=product,
                schema=active_schema,
                image_bytes=png_bytes,
                source_label=f"{source_document.filename} (Page {page_num})",
                mime_type="image/png",
                content_hash=source_document.content_hash,
                page_number=page_num
            )
            existing_keys = {c["key"] for c in candidates}
            for vc in vision_cands:
                if vc["key"] not in existing_keys:
                    candidates.append(vc)

    return candidates


def persist_candidates(
    db: Session,
    product: Product,
    source_document: SourceDocument,
    candidates: list[dict[str, Any]]
) -> int:
    persisted_count = 0

    # Deduplicate candidates by key in this batch, favoring higher confidence
    deduped_candidates: dict[str, dict[str, Any]] = {}
    for candidate in candidates:
        key = candidate["key"]
        if key not in deduped_candidates or (candidate.get("confidence", 0) > deduped_candidates[key].get("confidence", 0)):
            deduped_candidates[key] = candidate

    for key, candidate in deduped_candidates.items():
        value_raw = candidate["value_raw"]
        confidence = candidate["confidence"]
        extraction_method = candidate.get("extraction_method") or source_document.doc_type or "pdf"
        page_number = candidate.get("page_number")

        existing_attr = db.query(ProductAttribute).filter(
            ProductAttribute.product_id == product.id,
            ProductAttribute.key == key,
            ProductAttribute.source_id == source_document.id,
        ).first()

        if existing_attr:
            existing_attr.value_raw = value_raw
            existing_attr.confidence = confidence
            existing_attr.status = "proposed"
            existing_attr.extraction_method = extraction_method
            existing_attr.page_number = page_number
            existing_attr.model_used = settings.GEMINI_MODEL
            existing_attr.updated_at = utc_now()
        else:
            new_attr = ProductAttribute(
                product_id=product.id,
                key=key,
                value_raw=value_raw,
                confidence=confidence,
                status="proposed",
                source_id=source_document.id,
                extraction_method=extraction_method,
                page_number=page_number,
                model_used=settings.GEMINI_MODEL,
            )
            db.add(new_attr)

        persisted_count += 1

    db.commit()
    return persisted_count


def enrich_product(db: Session, product_id: int) -> dict[str, Any]:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return {"status": "error", "error": "Product not found"}

    product.status = "enriching"
    product.error = None
    db.commit()

    if not settings.GEMINI_API_KEY:
        error_msg = "Gemini API key is not configured. Enrichment cannot proceed."
        logger.warning(error_msg)
        product.status = "failed"
        product.error = error_msg
        product.enriched_at = utc_now()
        product.model_used = settings.GEMINI_MODEL
        db.commit()
        return {"status": "failed", "product_id": product_id, "error": error_msg}

    try:
        schema = load_schema(db, product.catalog_id, product.category)
        sources = (
            db.query(SourceDocument)
            .filter(SourceDocument.product_id == product.id)
            .limit(settings.EXTRACTION_MAX_SOURCES)
            .all()
        )

        # If no documents are attached, try to extract from product description/name if present
        if not sources and (product.short_description or product.long_description):
            synthetic_text = f"Part: {product.part_number}\nManufacturer: {product.manufacturer or ''}\nCategory: {product.category or ''}\n{product.short_description or ''}\n{product.long_description or ''}"
            synthetic_source = SourceDocument(
                product_id=product.id,
                filename="Product Metadata",
                doc_type="text",
                text_snippet=synthetic_text[:2000],
                fetched_at=utc_now(),
            )
            db.add(synthetic_source)
            db.commit()
            db.refresh(synthetic_source)
            sources = [synthetic_source]

        total_extracted = 0
        for source in sources:
            try:
                candidates = extract_from_source(db, product, source, schema=schema)
                if candidates:
                    count = persist_candidates(db, product, source, candidates)
                    total_extracted += count
            except Exception as exc:
                logger.warning("Extraction failed for source %s on product %s: %s", source.id, product.id, exc)

        # 1. Pure deterministic normalization immediately after extraction
        from app.services.normalization_service import normalize_product_attributes
        norm_result = normalize_product_attributes(db, product.id)
        logger.info("Normalized attributes for product %s: %s", product.id, norm_result)

        # 2. Rule-based validation pass (no AI)
        from app.services.validation_service import (
            validate_product,
            ai_plausibility_check,
            detect_conflicts,
        )
        val_result = validate_product(db, product.id)
        logger.info("Validated attributes for product %s: %s", product.id, val_result)

        # 3. AI plausibility check (soft non-blocking pass)
        plaus_result = ai_plausibility_check(db, product.id)
        logger.info("AI plausibility for product %s: %s", product.id, plaus_result)

        # 4. Multi-source conflict detection & auto-resolution
        conflicts = detect_conflicts(db, product.id)
        logger.info("Conflicts for product %s: %d detected", product.id, len(conflicts))

        # 5. Quality scoring (completeness %, confidence %, grade A-D)
        from app.services.quality_service import compute_product_scores
        quality_scores = compute_product_scores(db, product.id)
        logger.info("Quality scores for product %s: %s", product.id, quality_scores)

        product.enriched_at = utc_now()
        product.model_used = settings.GEMINI_MODEL
        product.error = None
        db.commit()

        return {
            "status": "success",
            "product_id": product_id,
            "attributes_extracted": total_extracted,
            "normalization": norm_result,
            "validation": val_result,
            "plausibility": plaus_result,
            "conflicts_count": len(conflicts),
            "quality": quality_scores,
        }

    except Exception as exc:
        logger.exception("Product enrichment failed for product %s", product_id)
        db.rollback()
        product = db.query(Product).filter(Product.id == product_id).first()
        if product:
            product.status = "failed"
            product.error = str(exc)
            product.enriched_at = utc_now()
            product.model_used = settings.GEMINI_MODEL
            db.commit()

        return {
            "status": "failed",
            "product_id": product_id,
            "error": str(exc),
        }
