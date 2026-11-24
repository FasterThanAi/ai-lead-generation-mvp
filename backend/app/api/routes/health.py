import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.utils.time_utils import utc_now

router = APIRouter(tags=["Health"])
STARTED_AT = time.time()


@router.get("/health")
def health_check():
    return {
        "status": "success",
        "message": "Backend is connected successfully",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "server_time": utc_now().isoformat(),
        "uptime_seconds": int(time.time() - STARTED_AT),
    }


@router.get("/health/live")
def liveness():
    """Process is up. Used by orchestrators to decide on restarts; never touches dependencies."""
    return {"status": "ok"}


def _check_redis() -> str:
    if not settings.REDIS_URL:
        return "not_configured"
    try:
        import redis

        redis.Redis.from_url(settings.REDIS_URL, socket_timeout=1, socket_connect_timeout=1).ping()
        return "ok"
    except Exception:  # noqa: BLE001
        return "error"


@router.get("/health/ready")
def readiness(db: Session = Depends(get_db)):
    """Instance can serve traffic. Load balancers should route only to ready instances."""
    checks = {}
    started = time.perf_counter()
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except SQLAlchemyError:
        checks["database"] = "error"
    checks["database_latency_ms"] = round((time.perf_counter() - started) * 1000, 1)
    checks["redis"] = _check_redis()

    ready = checks["database"] == "ok" and checks["redis"] != "error"
    if not ready:
        raise HTTPException(status_code=503, detail={"status": "not_ready", "checks": checks})
    return {"status": "ready", "checks": checks}


@router.get("/health/db")
def database_health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail="Database connection failed") from exc

    return {"status": "success", "message": "Database connected successfully"}
