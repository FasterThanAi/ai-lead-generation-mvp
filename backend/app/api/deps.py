"""Authentication dependencies shared by every protected router."""
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_access_token, hash_api_key
from app.db.database import get_db
from app.db.models import ApiKey, User
from app.utils.time_utils import utc_now

# Endpoints that external systems call directly. Each one authenticates itself
# (OAuth state, webhook secret, signed token) instead of a user session.
PUBLIC_PATHS = {
    "/api/gmail/oauth/callback",
    "/api/calls/vapi/webhook",
    "/api/calls/vapi/tool",
}


@dataclass
class Principal:
    id: int | None
    email: str
    role: str
    via: str  # "jwt" | "api_key" | "disabled"

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


ANONYMOUS_ADMIN = Principal(id=None, email="local-dev", role="admin", via="disabled")


def _unauthorized(detail="Authentication required."):
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def resolve_principal(request: Request, db: Session) -> Principal | None:
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        payload = decode_access_token(authorization[7:].strip())
        if not payload:
            raise _unauthorized("Your session has expired. Please sign in again.")
        user = db.get(User, int(payload["sub"])) if str(payload.get("sub", "")).isdigit() else None
        if not user or not user.is_active:
            raise _unauthorized("Account is disabled or no longer exists.")
        return Principal(id=user.id, email=user.email, role=user.role, via="jwt")

    raw_key = request.headers.get("x-api-key")
    if raw_key:
        api_key = (
            db.query(ApiKey)
            .filter(ApiKey.key_hash == hash_api_key(raw_key.strip()), ApiKey.revoked_at.is_(None))
            .first()
        )
        if not api_key or not api_key.user or not api_key.user.is_active:
            raise _unauthorized("Invalid API key.")
        api_key.last_used_at = utc_now()
        db.commit()
        return Principal(id=api_key.user.id, email=api_key.user.email, role=api_key.user.role, via="api_key")

    return None


def require_auth(request: Request, db: Session = Depends(get_db)) -> Principal:
    if request.url.path in PUBLIC_PATHS:
        return ANONYMOUS_ADMIN if not settings.AUTH_ENABLED else Principal(None, "public", "public", "public")

    if not settings.AUTH_ENABLED:
        principal = resolve_principal(request, db)
        return principal or ANONYMOUS_ADMIN

    principal = resolve_principal(request, db)
    if not principal:
        raise _unauthorized()
    request.state.principal = principal
    return principal


def get_current_principal(request: Request, db: Session = Depends(get_db)) -> Principal:
    if not settings.AUTH_ENABLED:
        return resolve_principal(request, db) or ANONYMOUS_ADMIN
    principal = resolve_principal(request, db)
    if not principal:
        raise _unauthorized()
    return principal


def require_admin(principal: Principal = Depends(get_current_principal)) -> Principal:
    if not principal.is_admin:
        raise HTTPException(status_code=403, detail="Admin access is required for this action.")
    return principal
