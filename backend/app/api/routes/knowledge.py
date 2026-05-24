from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import CompanyKnowledge
from app.schemas.knowledge_schema import (
    KNOWLEDGE_CATEGORIES,
    CompanyKnowledgeCreate,
    CompanyKnowledgeUpdate,
)
from app.services.knowledge_service import search_relevant_knowledge
from app.utils.time_utils import utc_now

router = APIRouter(
    prefix="/knowledge",
    tags=["Knowledge"]
)

MAX_KNOWLEDGE_SEARCH_LIMIT = 10


def clean_text(value):
    if value is None:
        return ""

    return str(value).strip()


def validate_category(category: str):
    category = clean_text(category)

    if category not in KNOWLEDGE_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid knowledge category. Allowed categories: {', '.join(sorted(KNOWLEDGE_CATEGORIES))}"
        )

    return category


def serialize_knowledge(entry: CompanyKnowledge):
    return {
        "id": entry.id,
        "title": entry.title,
        "category": entry.category,
        "content": entry.content,
        "tags": entry.tags,
        "is_active": entry.is_active,
        "created_at": entry.created_at,
        "updated_at": entry.updated_at,
    }


def get_knowledge_or_404(knowledge_id: int, db: Session):
    entry = db.query(CompanyKnowledge).filter(CompanyKnowledge.id == knowledge_id).first()

    if not entry:
        raise HTTPException(
            status_code=404,
            detail=f"Knowledge entry with id {knowledge_id} was not found"
        )

    return entry


def commit_knowledge_change(db: Session, entry: CompanyKnowledge, error_message: str):
    try:
        db.commit()
        db.refresh(entry)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=error_message) from exc


@router.get("/")
def get_knowledge_entries(
    category: str | None = None,
    active_only: bool = Query(True),
    search: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(CompanyKnowledge)

    if active_only:
        query = query.filter(CompanyKnowledge.is_active.is_(True))

    if category:
        query = query.filter(CompanyKnowledge.category == validate_category(category))

    search_text = clean_text(search)

    if search_text:
        like_value = f"%{search_text}%"
        query = query.filter(
            or_(
                CompanyKnowledge.title.ilike(like_value),
                CompanyKnowledge.category.ilike(like_value),
                CompanyKnowledge.tags.ilike(like_value),
                CompanyKnowledge.content.ilike(like_value),
            )
        )

    entries = (
        query
        .order_by(CompanyKnowledge.is_active.desc(), CompanyKnowledge.updated_at.desc(), CompanyKnowledge.created_at.desc())
        .all()
    )

    return {
        "status": "success",
        "data": [serialize_knowledge(entry) for entry in entries],
        "categories": sorted(KNOWLEDGE_CATEGORIES),
    }


@router.post("/")
def create_knowledge_entry(
    knowledge: CompanyKnowledgeCreate,
    db: Session = Depends(get_db),
):
    title = clean_text(knowledge.title)
    content = clean_text(knowledge.content)
    category = validate_category(knowledge.category)
    tags = clean_text(knowledge.tags) or None

    if not title or not content:
        raise HTTPException(status_code=400, detail="Title and content are required.")

    entry = CompanyKnowledge(
        title=title,
        category=category,
        content=content,
        tags=tags,
        is_active=knowledge.is_active,
    )
    db.add(entry)
    commit_knowledge_change(db, entry, "Knowledge entry could not be saved.")

    return {
        "status": "success",
        "message": "Knowledge entry created successfully",
        "data": serialize_knowledge(entry),
    }


@router.get("/search/relevant")
def get_relevant_knowledge(
    q: str = Query(..., min_length=1),
    limit: int = Query(5, ge=1),
    db: Session = Depends(get_db),
):
    entries = search_relevant_knowledge(
        db,
        q,
        limit=min(limit, MAX_KNOWLEDGE_SEARCH_LIMIT),
    )

    return {
        "status": "success",
        "query": q,
        "data": [serialize_knowledge(entry) for entry in entries],
    }


@router.get("/{knowledge_id}")
def get_knowledge_entry(knowledge_id: int, db: Session = Depends(get_db)):
    entry = get_knowledge_or_404(knowledge_id, db)

    return {
        "status": "success",
        "data": serialize_knowledge(entry),
    }


@router.patch("/{knowledge_id}")
def update_knowledge_entry(
    knowledge_id: int,
    knowledge_update: CompanyKnowledgeUpdate,
    db: Session = Depends(get_db),
):
    entry = get_knowledge_or_404(knowledge_id, db)
    update_data = knowledge_update.model_dump(exclude_unset=True)

    if "title" in update_data:
        title = clean_text(update_data["title"])
        if not title:
            raise HTTPException(status_code=400, detail="Title is required.")
        entry.title = title

    if "category" in update_data:
        entry.category = validate_category(update_data["category"])

    if "content" in update_data:
        content = clean_text(update_data["content"])
        if not content:
            raise HTTPException(status_code=400, detail="Content is required.")
        entry.content = content

    if "tags" in update_data:
        entry.tags = clean_text(update_data["tags"]) or None

    if "is_active" in update_data:
        entry.is_active = bool(update_data["is_active"])

    entry.updated_at = utc_now()
    commit_knowledge_change(db, entry, "Knowledge entry could not be updated.")

    return {
        "status": "success",
        "message": "Knowledge entry updated successfully",
        "data": serialize_knowledge(entry),
    }


@router.delete("/{knowledge_id}")
def delete_knowledge_entry(knowledge_id: int, db: Session = Depends(get_db)):
    entry = get_knowledge_or_404(knowledge_id, db)
    entry.is_active = False
    entry.updated_at = utc_now()
    commit_knowledge_change(db, entry, "Knowledge entry could not be deactivated.")

    return {
        "status": "success",
        "message": "Knowledge entry deactivated successfully",
        "data": serialize_knowledge(entry),
    }
