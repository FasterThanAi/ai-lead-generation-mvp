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


class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "AI Lead Generation MVP")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    FRONTEND_URLS: list[str] = get_frontend_origins()
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./leadgen.db")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-004")
    EMBEDDING_DIMENSION: int = get_int_env("EMBEDDING_DIMENSION", 768)
    ENABLE_SEMANTIC_RAG: bool = get_bool_env("ENABLE_SEMANTIC_RAG", True)
    SEMANTIC_RAG_TOP_K: int = get_int_env("SEMANTIC_RAG_TOP_K", 5)
    SEMANTIC_RAG_MIN_SCORE: float = get_float_env("SEMANTIC_RAG_MIN_SCORE", 0.60)
    GMAIL_CLIENT_ID: str = os.getenv("GMAIL_CLIENT_ID", "")
    GMAIL_CLIENT_SECRET: str = os.getenv("GMAIL_CLIENT_SECRET", "")
    GMAIL_REDIRECT_URI: str = os.getenv("GMAIL_REDIRECT_URI", "")
    GMAIL_SENDER_EMAIL: str = os.getenv("GMAIL_SENDER_EMAIL", "")
    GMAIL_DAILY_LIMIT: int = get_int_env("GMAIL_DAILY_LIMIT", 20)
    BACKEND_HOST: str = os.getenv("BACKEND_HOST", "127.0.0.1")
    BACKEND_PORT: int = get_int_env("BACKEND_PORT", 8000)

settings = Settings()
