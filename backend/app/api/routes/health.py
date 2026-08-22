import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db, engine

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/health")
def health_check():
    return {
        "status": "success",
        "message": "SpecForge backend is running smoothly."
    }


@router.get("/health/db")
def database_health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=500,
            detail="Database connection failed"
        ) from exc

    return {
        "status": "success",
        "message": "Database connected successfully"
    }


@router.get("/health/deep")
def deep_health_check(db: Session = Depends(get_db)):
    checks = {}
    is_healthy = True

    # 1. Database Check
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = {
            "status": "ok",
            "dialect": engine.dialect.name,
        }
    except Exception as exc:
        is_healthy = False
        checks["database"] = {
            "status": "error",
            "error": str(exc),
        }

    # 2. Vector Store / Dialect Check
    if engine.dialect.name == "postgresql":
        try:
            res = db.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'vector'")).scalar()
            checks["pgvector"] = {
                "status": "ok" if res else "missing",
                "extension": "vector",
            }
        except Exception as exc:
            checks["pgvector"] = {"status": "error", "error": str(exc)}
    else:
        checks["pgvector"] = {
            "status": "skipped",
            "reason": f"Running on {engine.dialect.name} (semantic search uses in-memory cosine fallback)",
        }

    # 3. Gemini Reachability Check
    if settings.GEMINI_API_KEY:
        try:
            from google import genai
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            # Lightweight verification
            checks["gemini"] = {
                "status": "ok",
                "model": settings.GEMINI_MODEL,
            }
        except Exception as exc:
            checks["gemini"] = {
                "status": "error",
                "error": str(exc),
            }
    else:
        checks["gemini"] = {
            "status": "not_configured",
            "model": settings.GEMINI_MODEL,
            "note": "Deterministic normalisation and rule validation remain active without API key",
        }

    return {
        "status": "healthy" if is_healthy else "degraded",
        "checks": checks,
    }
