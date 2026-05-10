from fastapi import APIRouter
from app.api.routes import ai, campaigns, dashboard, emails, gmail, health, leads

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(dashboard.router)
api_router.include_router(campaigns.router)
api_router.include_router(leads.router)
api_router.include_router(ai.router)
api_router.include_router(emails.router)
api_router.include_router(gmail.router)
