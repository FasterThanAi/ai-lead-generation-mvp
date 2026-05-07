from fastapi import APIRouter
from app.api.routes import campaigns, health, leads

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(campaigns.router)
api_router.include_router(leads.router)
