from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import Principal, get_current_principal, require_admin
from app.core.config import settings
from app.core.security import create_access_token, generate_api_key, hash_password, verify_password
from app.db.database import get_db
from app.db.models import ApiKey, User
from app.schemas.auth_schema import (
    ApiKeyCreate,
    ChangePasswordRequest,
    CreateUserRequest,
    LoginRequest,
    RegisterRequest,
    UpdateUserRequest,
)
from app.services.audit_service import record_audit
from app.utils.time_utils import utc_now

router = APIRouter(prefix="/auth", tags=["Auth"])

# Verified against when the email is unknown so response timing does not reveal
# which accounts exist.
_DUMMY_HASH = hash_password("timing-equaliser-not-a-real-password")


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "last_login_at": user.last_login_at,
        "created_at": user.created_at,
    }


def serialize_api_key(api_key: ApiKey) -> dict:
    return {
        "id": api_key.id,
        "name": api_key.name,
        "prefix": api_key.prefix,
        "last_used_at": api_key.last_used_at,
        "revoked_at": api_key.revoked_at,
        "created_at": api_key.created_at,
    }


def _user_count(db: Session) -> int:
    return db.query(func.count(User.id)).scalar() or 0


def _token_response(user: User) -> dict:
    return {
        "status": "success",
        "access_token": create_access_token(user.id, {"role": user.role}),
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": serialize_user(user),
    }


@router.get("/config")
def auth_config(db: Session = Depends(get_db)):
    has_users = _user_count(db) > 0
    return {
        "auth_enabled": settings.AUTH_ENABLED,
        "registration_open": settings.ALLOW_REGISTRATION or not has_users,
        "needs_setup": not has_users,
    }


@router.post("/register", status_code=201)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    is_first_user = _user_count(db) == 0
    if not is_first_user and not settings.ALLOW_REGISTRATION:
        raise HTTPException(status_code=403, detail="Registration is closed. Ask an admin to invite you.")

    if db.query(User.id).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role="admin" if is_first_user else "member",
        last_login_at=utc_now(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    record_audit(db, "auth.register", actor=user, entity_type="user", entity_id=user.id,
                 summary=f"{user.email} registered as {user.role}", request=request)
    return _token_response(user)


@router.post("/login")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    password_ok = verify_password(payload.password, user.password_hash if user else _DUMMY_HASH)

    if not user or not password_ok or not user.is_active:
        record_audit(db, "auth.login_failed", entity_type="user", entity_id=user.id if user else None,
                     summary=f"Failed sign-in for {payload.email}", request=request)
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    user.last_login_at = utc_now()
    db.commit()
    record_audit(db, "auth.login", actor=user, entity_type="user", entity_id=user.id,
                 summary=f"{user.email} signed in", request=request)
    return _token_response(user)


@router.get("/me")
def me(principal: Principal = Depends(get_current_principal), db: Session = Depends(get_db)):
    if principal.id is None:
        return {"status": "success", "user": {"id": None, "email": principal.email, "role": principal.role,
                                               "full_name": "Local developer", "is_active": True}}
    return {"status": "success", "user": serialize_user(db.get(User, principal.id))}


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
):
    user = db.get(User, principal.id) if principal.id else None
    if not user or not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    record_audit(db, "auth.password_changed", actor=principal, entity_type="user", entity_id=user.id, request=request)
    return {"status": "success", "message": "Password updated."}


# --- User management (admin) ---------------------------------------------

@router.get("/users")
def list_users(_: Principal = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.asc()).all()
    return {"status": "success", "data": [serialize_user(user) for user in users]}


@router.post("/users", status_code=201)
def create_user(
    payload: CreateUserRequest,
    request: Request,
    principal: Principal = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if db.query(User.id).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = User(email=payload.email, full_name=payload.full_name,
                password_hash=hash_password(payload.password), role=payload.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    record_audit(db, "user.created", actor=principal, entity_type="user", entity_id=user.id,
                 summary=f"Created {user.email} ({user.role})", request=request)
    return {"status": "success", "user": serialize_user(user)}


@router.patch("/users/{user_id}")
def update_user(
    user_id: int,
    payload: UpdateUserRequest,
    request: Request,
    principal: Principal = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.id == principal.id and (payload.is_active is False or payload.role == "member"):
        raise HTTPException(status_code=400, detail="You cannot demote or disable your own account.")

    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    record_audit(db, "user.updated", actor=principal, entity_type="user", entity_id=user.id,
                 summary=f"Updated {user.email}", details=changes, request=request)
    return {"status": "success", "user": serialize_user(user)}


# --- API keys --------------------------------------------------------------

@router.get("/api-keys")
def list_api_keys(principal: Principal = Depends(get_current_principal), db: Session = Depends(get_db)):
    keys = db.query(ApiKey).filter(ApiKey.user_id == principal.id).order_by(ApiKey.created_at.desc()).all()
    return {"status": "success", "data": [serialize_api_key(key) for key in keys]}


@router.post("/api-keys", status_code=201)
def create_api_key(
    payload: ApiKeyCreate,
    request: Request,
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
):
    if principal.id is None:
        raise HTTPException(status_code=400, detail="Sign in with a real account to create API keys.")
    raw_key, prefix, key_hash = generate_api_key()
    api_key = ApiKey(user_id=principal.id, name=payload.name, prefix=prefix, key_hash=key_hash)
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    record_audit(db, "api_key.created", actor=principal, entity_type="api_key", entity_id=api_key.id,
                 summary=f"Created API key '{api_key.name}'", request=request)
    return {"status": "success", "api_key": raw_key, "data": serialize_api_key(api_key)}


@router.delete("/api-keys/{key_id}")
def revoke_api_key(
    key_id: int,
    request: Request,
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
):
    api_key = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.user_id == principal.id).first()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found.")
    if not api_key.revoked_at:
        api_key.revoked_at = utc_now()
        db.commit()
        record_audit(db, "api_key.revoked", actor=principal, entity_type="api_key", entity_id=api_key.id,
                     summary=f"Revoked API key '{api_key.name}'", request=request)
    return {"status": "success", "data": serialize_api_key(api_key)}
