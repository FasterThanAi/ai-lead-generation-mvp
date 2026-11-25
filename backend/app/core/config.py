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


DEV_SECRET_KEY = "dev-insecure-secret-key-change-me-in-production"


def normalize_database_url(value):
    url = (value or "").strip() or "sqlite:///./leadgen.db"
    # Heroku/Render style URLs use the legacy scheme SQLAlchemy 2 rejects.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url


def get_list_env(name):
    return [item.strip() for item in os.getenv(name, "").split(",") if item.strip()]


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
    APP_NAME: str = os.getenv("APP_NAME", "AI Lead Generation MVP")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    FRONTEND_URLS: list[str] = get_frontend_origins()
    DATABASE_URL: str = normalize_database_url(os.getenv("DATABASE_URL", ""))
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
    GMAIL_CLIENT_ID: str = os.getenv("GMAIL_CLIENT_ID", "")
    GMAIL_CLIENT_SECRET: str = os.getenv("GMAIL_CLIENT_SECRET", "")
    GMAIL_REDIRECT_URI: str = os.getenv("GMAIL_REDIRECT_URI", "")
    GMAIL_SENDER_EMAIL: str = os.getenv("GMAIL_SENDER_EMAIL", "")
    GMAIL_DAILY_LIMIT: int = get_int_env("GMAIL_DAILY_LIMIT", 20)
    HUNTER_API_KEY: str = os.getenv("HUNTER_API_KEY", "")
    HUNTER_REQUEST_TIMEOUT: float = get_float_env("HUNTER_REQUEST_TIMEOUT", 8.0)
    HUNTER_BULK_MAX_LEADS: int = get_int_env("HUNTER_BULK_MAX_LEADS", 10)
    HUNTER_BULK_MAX_SECONDS: float = get_float_env("HUNTER_BULK_MAX_SECONDS", 45.0)
    HUNTER_BULK_DELAY_SECONDS: float = get_float_env("HUNTER_BULK_DELAY_SECONDS", 0.25)
    APOLLO_API_KEY: str = os.getenv("APOLLO_API_KEY", "")
    VAPI_ENABLED: bool = get_bool_env("VAPI_ENABLED", False)
    VAPI_API_KEY: str = os.getenv("VAPI_API_KEY", "")
    VAPI_ASSISTANT_ID: str = os.getenv("VAPI_ASSISTANT_ID", "")
    VAPI_PHONE_NUMBER_ID: str = os.getenv("VAPI_PHONE_NUMBER_ID", "")
    VAPI_WEBHOOK_SECRET: str = os.getenv("VAPI_WEBHOOK_SECRET", "")
    VAPI_DEFAULT_TEST_PHONE: str = os.getenv("VAPI_DEFAULT_TEST_PHONE", "")
    VAPI_BASE_URL: str = os.getenv("VAPI_BASE_URL", "https://api.vapi.ai").rstrip("/")
    BACKEND_HOST: str = os.getenv("BACKEND_HOST", "127.0.0.1")
    BACKEND_PORT: int = get_int_env("BACKEND_PORT", 8000)
    APP_VERSION: str = os.getenv("APP_VERSION", "2.0.0")
    N8N_WEBHOOK_URL: str = os.getenv("N8N_WEBHOOK_URL", "").strip()

    # Security / auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "").strip() or DEV_SECRET_KEY
    TOKEN_ENCRYPTION_KEY: str = os.getenv("TOKEN_ENCRYPTION_KEY", "").strip()
    AUTH_ENABLED: bool = get_bool_env("AUTH_ENABLED", True)
    ALLOW_REGISTRATION: bool = get_bool_env("ALLOW_REGISTRATION", False)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = get_int_env("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 12)
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "").strip().lower()
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "")
    TRUSTED_HOSTS: list[str] = get_list_env("TRUSTED_HOSTS")

    # Platform
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO").upper()
    LOG_JSON: bool = get_bool_env("LOG_JSON", os.getenv("APP_ENV", "development") == "production")
    REDIS_URL: str = os.getenv("REDIS_URL", "").strip()
    RATE_LIMIT_ENABLED: bool = get_bool_env("RATE_LIMIT_ENABLED", True)
    RATE_LIMIT_DEFAULT_PER_MINUTE: int = get_int_env("RATE_LIMIT_DEFAULT_PER_MINUTE", 300)
    RATE_LIMIT_AUTH_PER_MINUTE: int = get_int_env("RATE_LIMIT_AUTH_PER_MINUTE", 10)
    RATE_LIMIT_AI_PER_MINUTE: int = get_int_env("RATE_LIMIT_AI_PER_MINUTE", 30)
    RUN_MIGRATIONS_ON_STARTUP: bool = get_bool_env("RUN_MIGRATIONS_ON_STARTUP", True)
    METRICS_ENABLED: bool = get_bool_env("METRICS_ENABLED", True)
    METRICS_TOKEN: str = os.getenv("METRICS_TOKEN", "").strip()
    STALE_JOB_MINUTES: int = get_int_env("STALE_JOB_MINUTES", 60)

    # Uploads / compliance
    MAX_UPLOAD_MB: int = get_int_env("MAX_UPLOAD_MB", 10)
    CSV_MAX_ROWS: int = get_int_env("CSV_MAX_ROWS", 5000)
    PUBLIC_API_URL: str = os.getenv("PUBLIC_API_URL", "").strip().rstrip("/")
    UNSUBSCRIBE_LINKS_ENABLED: bool = get_bool_env("UNSUBSCRIBE_LINKS_ENABLED", True)

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() in {"production", "prod"}

    def validate(self) -> list[str]:
        """Return configuration problems that must block a production boot."""
        problems = []

        if not self.is_production:
            return problems

        if self.SECRET_KEY == DEV_SECRET_KEY or len(self.SECRET_KEY) < 32:
            problems.append("SECRET_KEY must be set to a random value of at least 32 characters.")

        if not self.AUTH_ENABLED:
            problems.append("AUTH_ENABLED must not be false in production.")

        if self.DATABASE_URL.startswith("sqlite"):
            problems.append("DATABASE_URL must point at PostgreSQL in production; SQLite is single-node only.")

        if self.VAPI_ENABLED and not self.VAPI_WEBHOOK_SECRET:
            problems.append("VAPI_WEBHOOK_SECRET is required when VAPI_ENABLED is true in production.")

        return problems


settings = Settings()


def primary_frontend_url() -> str:
    """Where to send browsers back to (OAuth callbacks). Prefers an explicit
    FRONTEND_URL, then the first non-localhost entry in FRONTEND_URLS."""
    explicit = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    if explicit:
        return explicit
    for origin in settings.FRONTEND_URLS:
        if "localhost" not in origin and "127.0.0.1" not in origin:
            return origin
    return settings.FRONTEND_URLS[0] if settings.FRONTEND_URLS else "http://localhost:5173"
