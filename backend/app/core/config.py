import os
from dotenv import load_dotenv

load_dotenv()


def get_frontend_origins():
    configured_origins = os.getenv("FRONTEND_URLS", "")
    fallback_origin = os.getenv("FRONTEND_URL", "http://localhost:5173")

    origins = [
        fallback_origin,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    if configured_origins:
        origins.extend(configured_origins.split(","))

    return list(dict.fromkeys(origin.strip().rstrip("/") for origin in origins if origin.strip()))


def get_int_env(name, default):
    try:
        return int(os.getenv(name, str(default)) or default)
    except ValueError:
        return default


def get_float_env(name, default):
    try:
        return float(os.getenv(name, str(default)) or default)
    except ValueError:
        return default


def get_bool_env(name, default):
    value = os.getenv(name)

    if value is None:
        return default

    return value.strip().lower() in {"1", "true", "yes", "on"}


def get_embedding_model_env():
    configured_model = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001").strip() or "gemini-embedding-001"

    if configured_model in {"text-embedding-004", "models/text-embedding-004"}:
        return "gemini-embedding-001"

    return configured_model


def get_embedding_dimension_env(model):
    configured_dimension = get_int_env("EMBEDDING_DIMENSION", 3072)

    if model in {
        "gemini-embedding-001",
        "models/gemini-embedding-001",
        "gemini-embedding-2",
        "models/gemini-embedding-2",
        "gemini-embedding-2-preview",
        "models/gemini-embedding-2-preview",
    }:
        return 3072

    return configured_dimension


class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "").strip() or "SpecForge"
    APP_ENV: str = os.getenv("APP_ENV", "").strip() or "development"
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "").strip() or "http://localhost:5173"
    FRONTEND_URLS: list[str] = get_frontend_origins()
    DATABASE_URL: str = os.getenv("DATABASE_URL", "").strip() or "sqlite:///./specforge.db"
    DB_POOL_SIZE: int = get_int_env("DB_POOL_SIZE", 5)
    DB_MAX_OVERFLOW: int = get_int_env("DB_MAX_OVERFLOW", 2)
    DB_POOL_TIMEOUT: int = get_int_env("DB_POOL_TIMEOUT", 30)
    DB_POOL_RECYCLE: int = get_int_env("DB_POOL_RECYCLE", 1800)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    EMBEDDING_MODEL: str = get_embedding_model_env()
    EMBEDDING_DIMENSION: int = get_embedding_dimension_env(EMBEDDING_MODEL)
    ENABLE_SEMANTIC_RAG: bool = get_bool_env("ENABLE_SEMANTIC_RAG", True)
    SEMANTIC_RAG_TOP_K: int = get_int_env("SEMANTIC_RAG_TOP_K", 5)
    SEMANTIC_RAG_MIN_SCORE: float = get_float_env("SEMANTIC_RAG_MIN_SCORE", 0.50)
    # extraction
    EXTRACTION_MAX_CHARS: int = get_int_env("EXTRACTION_MAX_CHARS", 12000)
    EXTRACTION_MAX_SOURCES: int = get_int_env("EXTRACTION_MAX_SOURCES", 5)
    VISION_ENABLED: bool = get_bool_env("VISION_ENABLED", True)
    VISION_MAX_PAGES: int = get_int_env("VISION_MAX_PAGES", 10)
    VISION_DPI: int = get_int_env("VISION_DPI", 200)

    # validation & confidence
    REVIEW_CONFIDENCE_THRESHOLD: int = get_int_env("REVIEW_CONFIDENCE_THRESHOLD", 75)
    AUTO_APPROVE_THRESHOLD: int = get_int_env("AUTO_APPROVE_THRESHOLD", 85)
    CONFLICT_AUTO_RESOLVE_DELTA: int = get_int_env("CONFLICT_AUTO_RESOLVE_DELTA", 25)
    NUMERIC_CONFLICT_TOLERANCE: float = get_float_env("NUMERIC_CONFLICT_TOLERANCE", 0.01)
    VALIDATION_FLAG_PENALTY: int = get_int_env("VALIDATION_FLAG_PENALTY", 15)
    AI_PLAUSIBILITY_ENABLED: bool = get_bool_env("AI_PLAUSIBILITY_ENABLED", True)

    # ingestion & storage
    STORAGE_DIR: str = os.getenv("STORAGE_DIR", "./storage/sources")
    MAX_UPLOAD_MB: int = get_int_env("MAX_UPLOAD_MB", 25)
    ALLOWED_UPLOAD_EXTENSIONS: list[str] = [
        e.strip().lower()
        for e in os.getenv(
            "ALLOWED_UPLOAD_EXTENSIONS",
            ".csv,.xlsx,.pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp",
        ).split(",")
        if e.strip()
    ]

    # source fetching
    SOURCE_REQUEST_TIMEOUT: float = get_float_env("SOURCE_REQUEST_TIMEOUT", 8.0)
    SOURCE_MAX_RESPONSE_BYTES: int = get_int_env("SOURCE_MAX_RESPONSE_BYTES", 1048576)
    SOURCE_USER_AGENT: str = os.getenv(
        "SOURCE_USER_AGENT", "SpecForge Product Intelligence Bot/1.0"
    )
    RESPECT_ROBOTS_TXT: bool = get_bool_env("RESPECT_ROBOTS_TXT", True)

    # jobs
    ENRICHMENT_BATCH_LIMIT: int = get_int_env("ENRICHMENT_BATCH_LIMIT", 50)
    ENRICHMENT_MAX_CONCURRENCY: int = get_int_env("ENRICHMENT_MAX_CONCURRENCY", 4)
    JOB_STALE_MINUTES: int = get_int_env("JOB_STALE_MINUTES", 30)

    # security
    API_KEY: str = os.getenv("API_KEY", "")

    BACKEND_HOST: str = os.getenv("BACKEND_HOST", "127.0.0.1")
    BACKEND_PORT: int = get_int_env("BACKEND_PORT", 8000)

settings = Settings()
