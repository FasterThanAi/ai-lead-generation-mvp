from fastapi import APIRouter, Depends

from app.api.deps import require_auth
from app.api.routes import (
    ai,
    analytics,
    apollo,
    audit,
    auth,
    calls,
    campaigns,
    dashboard,
    discovery,
    emails,
    followups,
    gmail,
    health,
    hunter,
    knowledge,
    lead_agent,
    lead_scoring,
    leads,
    opportunities,
    replies,
    reply_classification,
    reply_responses,
    suppression,
    system,
)

api_router = APIRouter()

# Public: health probes, sign-in, and recipient-facing unsubscribe pages.
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(suppression.public_router)

# Everything else requires a signed-in user or an API key. Webhook/OAuth callback
# paths listed in app.api.deps.PUBLIC_PATHS authenticate themselves instead.
protected = [Depends(require_auth)]
for module in (
    dashboard,
    campaigns,
    calls,
    leads,
    lead_agent,
    lead_scoring,
    opportunities,
    discovery,
    knowledge,
    ai,
    emails,
    followups,
    gmail,
    hunter,
    apollo,
    replies,
    reply_classification,
    reply_responses,
    analytics,
    suppression,
    audit,
    system,
):
    api_router.include_router(module.router, dependencies=protected)
