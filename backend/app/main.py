from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.api_router import api_router
from app.db.database import Base, engine
from app.db.database_utils import ensure_email_draft_columns, ensure_lead_ai_scoring_columns
from app.db.models import Campaign, EmailDraft, FollowUpDraft, GmailOAuthState, GmailToken, Lead  # noqa: F401

# Import models above so Base.metadata includes all MVP tables before create_all.
Base.metadata.create_all(bind=engine)
ensure_email_draft_columns(engine)
ensure_lead_ai_scoring_columns(engine)

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.FRONTEND_URLS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

@app.get("/")
def root():
    return {
        "message": "AI Lead Generation MVP Backend is running"
    }
