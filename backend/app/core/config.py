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


class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "AI Lead Generation MVP")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    FRONTEND_URLS: list[str] = get_frontend_origins()
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./leadgen.db")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    BACKEND_HOST: str = os.getenv("BACKEND_HOST", "127.0.0.1")
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))

settings = Settings()
