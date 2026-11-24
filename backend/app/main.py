import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.api_router import api_router
from app.core.config import settings
from app.core.logging import configure_logging, request_id_var
from app.core.metrics import render_metrics
from app.core.middleware import RequestContextMiddleware
from app.db.database import SessionLocal
from app.db.migrations import run_migrations
from app.services.startup_service import bootstrap_admin, recover_stale_work

configure_logging()
logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI):
    problems = settings.validate()
    if problems:
        for problem in problems:
            logger.error("Configuration error: %s", problem)
        raise RuntimeError("Refusing to start with insecure production configuration: " + " ".join(problems))

    if settings.RUN_MIGRATIONS_ON_STARTUP:
        run_migrations()

    with SessionLocal() as db:
        bootstrap_admin(db)
        recover_stale_work(db)

    logger.info("%s %s started (env=%s, auth=%s)", settings.APP_NAME, settings.APP_VERSION,
                settings.APP_ENV, settings.AUTH_ENABLED)
    yield
    logger.info("Shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

# Middleware runs outermost-last: RequestContext sees every request first.
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.FRONTEND_URLS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "X-Request-ID"],
    expose_headers=["X-Request-ID", "Retry-After", "Content-Disposition"],
)
if settings.TRUSTED_HOSTS:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.TRUSTED_HOSTS)
app.add_middleware(RequestContextMiddleware)


def _error_body(detail, status_code: int):
    return {"status": "error", "detail": detail, "request_id": request_id_var.get(), "code": status_code}


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    return JSONResponse(_error_body(exc.detail, exc.status_code), status_code=exc.status_code,
                        headers=getattr(exc, "headers", None))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    errors = [
        {"field": ".".join(str(part) for part in error.get("loc", []) if part != "body"), "message": error.get("msg")}
        for error in exc.errors()
    ]
    message = errors[0]["message"] if errors else "Invalid request."
    body = _error_body(message, 422)
    body["errors"] = errors
    return JSONResponse(body, status_code=422)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(_error_body("Something went wrong on our side. Please try again.", 500), status_code=500)


app.include_router(api_router, prefix="/api")


@app.get("/metrics", include_in_schema=False)
def metrics(request: Request):
    if not settings.METRICS_ENABLED:
        return JSONResponse(_error_body("Not found", 404), status_code=404)
    if settings.METRICS_TOKEN and request.headers.get("authorization") != f"Bearer {settings.METRICS_TOKEN}":
        return JSONResponse(_error_body("Unauthorized", 401), status_code=401)
    payload, content_type = render_metrics()
    return Response(payload, media_type=content_type)


@app.get("/")
def root():
    return {
        "message": "AI Lead Generation MVP Backend is running",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/api/health",
    }
