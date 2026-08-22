from fastapi import APIRouter
from app.api.routes import (
    analytics,
    catalogs,
    dashboard,
    health,
    knowledge,
    products,
    quality,
    sources,
)

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(dashboard.router)
api_router.include_router(catalogs.router)
api_router.include_router(products.router)
api_router.include_router(sources.router)
api_router.include_router(quality.router)
api_router.include_router(knowledge.router)
api_router.include_router(analytics.router)
