from fastapi import APIRouter
from app.api.routes import (
    ai,
    analytics,
    campaigns,
    dashboard,
    discovery,
    health,
    knowledge,
    lead_scoring,
    leads,
    opportunities,
)

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(dashboard.router)
api_router.include_router(campaigns.router)
api_router.include_router(leads.router)
api_router.include_router(lead_scoring.router)
api_router.include_router(opportunities.router)
api_router.include_router(discovery.router)
api_router.include_router(knowledge.router)
api_router.include_router(ai.router)
api_router.include_router(analytics.router)

