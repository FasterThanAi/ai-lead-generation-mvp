from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.utils.time_utils import utc_now

router = APIRouter()

@router.get("/health")
def health_check():
    return {
        "status": "success",
        "message": "Backend is connected successfully",
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "server_time": utc_now().isoformat(),
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
