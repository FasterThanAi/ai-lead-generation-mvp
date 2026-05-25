import re
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.db.models import CompanyKnowledge
from app.services.embedding_service import (
    embed_query,
    embedding_storage_available,
    semantic_rag_available,
)

MAX_KNOWLEDGE_CONTEXT_CHARS = 2400
MAX_KNOWLEDGE_ENTRY_CHARS = 520
OLDEST_DATETIME = datetime.min.replace(tzinfo=timezone.utc)


def _clean(value):
    if value is None:
        return ""

    return str(value).strip()


def _normalize(value):
    return _clean(value).lower()


def _tokens(value):
    return {
        token
        for token in re.findall(r"[a-z0-9]+", _normalize(value))
        if len(token) >= 2
    }


def _entry_score(entry: CompanyKnowledge, query: str, query_tokens: set[str]):
    if not query_tokens:
        return 0

    normalized_query = _normalize(query)
    title = _normalize(entry.title)
    category = _normalize(entry.category)
    tags = _normalize(entry.tags)
    content = _normalize(entry.content)
    score = 0

    if normalized_query and normalized_query in title:
        score += 14
    if normalized_query and normalized_query in tags:
        score += 9
    if normalized_query and normalized_query in category:
        score += 8
    if normalized_query and normalized_query in content:
        score += 4

    for token in query_tokens:
        if token in title:
            score += 6
        if token in tags:
            score += 4
        if token in category:
            score += 4
        if token in content:
            score += 1

    return score


def _entry_timestamp(entry: CompanyKnowledge):
    value = entry.updated_at or entry.created_at or OLDEST_DATETIME

    if value.tzinfo:
        return value.astimezone(timezone.utc).timestamp()

    return value.replace(tzinfo=timezone.utc).timestamp()


def _attach_retrieval_metadata(
    entry: CompanyKnowledge,
    retrieval_method: str,
    similarity_score: float | None = None,
    keyword_score: int | None = None,
):
    entry.retrieval_method = retrieval_method
    entry.similarity_score = similarity_score
    entry.keyword_score = keyword_score

    return entry


def _vector_literal(values: list[float]):
    return "[" + ",".join(f"{float(value):.8f}" for value in values) + "]"


def search_keyword_knowledge(db: Session, query, limit: int = 5):
    query_text = _clean(query)
    query_tokens = _tokens(query_text)
    effective_limit = max(1, min(int(limit or 5), 10))

    entries = (
        db.query(CompanyKnowledge)
        .options(joinedload(CompanyKnowledge.document))
        .filter(CompanyKnowledge.is_active.is_(True))
        .order_by(CompanyKnowledge.updated_at.desc(), CompanyKnowledge.created_at.desc())
        .all()
    )

    scored_entries = []

    for entry in entries:
        score = _entry_score(entry, query_text, query_tokens)

        if score > 0:
            scored_entries.append((score, entry))

    results = []

    for score, entry in sorted(
            scored_entries,
            key=lambda item: (item[0], _entry_timestamp(item[1])),
            reverse=True,
    )[:effective_limit]:
        results.append(_attach_retrieval_metadata(entry, "keyword", keyword_score=score))

    return results


def search_semantic_knowledge(db: Session, query, limit: int = 5, min_score: float | None = None):
    query_text = _clean(query)
    effective_limit = max(1, min(int(limit or settings.SEMANTIC_RAG_TOP_K or 5), 10))
    effective_min_score = settings.SEMANTIC_RAG_MIN_SCORE if min_score is None else float(min_score)

    if not query_text or not semantic_rag_available(db):
        return []

    query_embedding = embed_query(query_text)
    vector_value = _vector_literal(query_embedding)
    rows = db.execute(
        text(
            "SELECT id, 1 - (embedding <=> CAST(:query_embedding AS vector)) AS similarity_score "
            "FROM company_knowledge "
            "WHERE is_active = TRUE AND embedding IS NOT NULL "
            "ORDER BY embedding <=> CAST(:query_embedding AS vector) "
            "LIMIT :limit"
        ),
        {
            "query_embedding": vector_value,
            "limit": effective_limit,
        },
    ).all()

    if not rows:
        return []

    row_by_id = {
        int(row.id): float(row.similarity_score or 0)
        for row in rows
        if float(row.similarity_score or 0) >= effective_min_score
    }

    if not row_by_id:
        return []

    entries = (
        db.query(CompanyKnowledge)
        .options(joinedload(CompanyKnowledge.document))
        .filter(CompanyKnowledge.id.in_(row_by_id.keys()))
        .all()
    )
    entry_by_id = {entry.id: entry for entry in entries}
    results = []

    for entry_id in row_by_id:
        entry = entry_by_id.get(entry_id)

        if entry:
            results.append(
                _attach_retrieval_metadata(
                    entry,
                    "semantic",
                    similarity_score=round(row_by_id[entry_id], 4),
                )
            )

    return results


def search_hybrid_knowledge(db: Session, query, limit: int = 5):
    effective_limit = max(1, min(int(limit or 5), 10))
    semantic_results = []
    semantic_available = bool(settings.ENABLE_SEMANTIC_RAG and embedding_storage_available(db))
    semantic_error = None

    if semantic_available:
        try:
            semantic_results = search_semantic_knowledge(
                db,
                query,
                limit=max(effective_limit, settings.SEMANTIC_RAG_TOP_K),
            )
        except Exception as exc:
            semantic_results = []
            semantic_available = False
            semantic_error = str(exc)

    keyword_results = search_keyword_knowledge(db, query, limit=effective_limit)
    keyword_by_id = {entry.id: entry for entry in keyword_results}
    merged_results = []
    seen_ids = set()

    for entry in semantic_results:
        keyword_entry = keyword_by_id.get(entry.id)

        if keyword_entry:
            entry.keyword_score = getattr(keyword_entry, "keyword_score", None)
            entry.retrieval_method = "hybrid"

        merged_results.append(entry)
        seen_ids.add(entry.id)

    for entry in keyword_results:
        if entry.id in seen_ids:
            continue

        merged_results.append(entry)
        seen_ids.add(entry.id)

        if len(merged_results) >= effective_limit:
            break

    results = merged_results[:effective_limit]
    retrieval_method = "hybrid" if semantic_results and keyword_results else "semantic" if semantic_results else "keyword"

    return {
        "results": results,
        "semantic_available": semantic_available and bool(settings.GEMINI_API_KEY),
        "semantic_error": semantic_error,
        "retrieval_method": retrieval_method,
        "message": None if semantic_available and bool(settings.GEMINI_API_KEY) else "Semantic search unavailable, keyword fallback used.",
    }


def search_knowledge(db: Session, query, limit: int = 5, mode: str = "hybrid"):
    normalized_mode = _normalize(mode) or "hybrid"
    effective_limit = max(1, min(int(limit or 5), 10))

    if normalized_mode == "keyword":
        return {
            "results": search_keyword_knowledge(db, query, limit=effective_limit),
            "semantic_available": semantic_rag_available(db),
            "retrieval_method": "keyword",
            "message": None,
        }

    if normalized_mode == "semantic":
        try:
            semantic_results = search_semantic_knowledge(db, query, limit=effective_limit)
        except Exception:
            semantic_results = []

        if semantic_results:
            return {
                "results": semantic_results,
                "semantic_available": semantic_rag_available(db),
                "retrieval_method": "semantic",
                "message": None,
            }

        return {
            "results": search_keyword_knowledge(db, query, limit=effective_limit),
            "semantic_available": False,
            "retrieval_method": "keyword",
            "message": "Semantic search unavailable, keyword fallback used.",
        }

    return search_hybrid_knowledge(db, query, limit=effective_limit)


def search_relevant_knowledge(db: Session, query, limit: int = 5):
    if settings.ENABLE_SEMANTIC_RAG:
        return search_hybrid_knowledge(db, query, limit=limit)["results"]

    return search_keyword_knowledge(db, query, limit=limit)


def _document_source_label(entry: CompanyKnowledge):
    document = getattr(entry, "document", None)
    document_name = _clean(getattr(document, "original_filename", ""))
    chunk_index = entry.chunk_index

    if document_name and chunk_index:
        return f"Document: {document_name} | Chunk {chunk_index}"

    if document_name:
        return f"Document: {document_name}"

    if chunk_index:
        return f"Document | Chunk {chunk_index}"

    return "Document"


def _source_label(entry: CompanyKnowledge):
    if _normalize(entry.source_type) == "document":
        return _document_source_label(entry)

    return "Manual"


def build_knowledge_context(entries):
    context_parts = []
    total_chars = 0

    for entry in entries:
        title = _clean(entry.title)
        category = _clean(entry.category) or "Other"
        content = " ".join(_clean(entry.content).split())

        if not title or not content:
            continue

        if len(content) > MAX_KNOWLEDGE_ENTRY_CHARS:
            content = f"{content[:MAX_KNOWLEDGE_ENTRY_CHARS].rstrip()}..."

        block = f"[{category} | {_source_label(entry)}] {title}:\n{content}"
        remaining_chars = MAX_KNOWLEDGE_CONTEXT_CHARS - total_chars

        if remaining_chars <= 0:
            break

        if len(block) > remaining_chars:
            block = f"{block[:remaining_chars].rstrip()}..."

        context_parts.append(block)
        total_chars += len(block)

    return "\n\n".join(context_parts)
