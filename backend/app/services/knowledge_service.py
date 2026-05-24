import re
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db.models import CompanyKnowledge

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


def search_relevant_knowledge(db: Session, query, limit: int = 5):
    query_text = _clean(query)
    query_tokens = _tokens(query_text)
    effective_limit = max(1, min(int(limit or 5), 10))

    entries = (
        db.query(CompanyKnowledge)
        .filter(CompanyKnowledge.is_active.is_(True))
        .order_by(CompanyKnowledge.updated_at.desc(), CompanyKnowledge.created_at.desc())
        .all()
    )

    scored_entries = [
        (_entry_score(entry, query_text, query_tokens), entry)
        for entry in entries
    ]

    return [
        entry
        for score, entry in sorted(
            scored_entries,
            key=lambda item: (item[0], item[1].updated_at or item[1].created_at or OLDEST_DATETIME),
            reverse=True,
        )
        if score > 0
    ][:effective_limit]


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

        block = f"[{category}] {title}:\n{content}"
        remaining_chars = MAX_KNOWLEDGE_CONTEXT_CHARS - total_chars

        if remaining_chars <= 0:
            break

        if len(block) > remaining_chars:
            block = f"{block[:remaining_chars].rstrip()}..."

        context_parts.append(block)
        total_chars += len(block)

    return "\n\n".join(context_parts)
