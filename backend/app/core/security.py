"""Password hashing, JWT access tokens, API keys, secret encryption and signed links.

Only the standard library, PyJWT and ``cryptography`` are used so the module has
no native build requirements beyond what the app already ships with.
"""
import base64
import hashlib
import hmac
import os
import secrets
from datetime import timedelta

import jwt
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings
from app.utils.time_utils import utc_now

PASSWORD_ALGORITHM = "pbkdf2_sha256"
PASSWORD_ITERATIONS = int(os.getenv("PASSWORD_HASH_ITERATIONS", "390000"))
JWT_ALGORITHM = "HS256"
API_KEY_PREFIX = "lg_"
ENCRYPTED_PREFIX = "enc:v1:"


# --- Passwords -------------------------------------------------------------

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), PASSWORD_ITERATIONS)
    return f"{PASSWORD_ALGORITHM}${PASSWORD_ITERATIONS}${salt}${base64.b64encode(digest).decode('ascii')}"


def verify_password(password: str, stored_hash: str | None) -> bool:
    if not password or not stored_hash:
        return False

    try:
        algorithm, iterations, salt, encoded_digest = stored_hash.split("$", 3)
    except ValueError:
        return False

    if algorithm != PASSWORD_ALGORITHM:
        return False

    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), int(iterations))
    return hmac.compare_digest(base64.b64encode(digest).decode("ascii"), encoded_digest)


# --- JWT -------------------------------------------------------------------

def create_access_token(subject: str | int, extra_claims: dict | None = None, expires_minutes: int | None = None) -> str:
    now = utc_now()
    expires = now + timedelta(minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
        "type": "access",
        **(extra_claims or {}),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None

    if payload.get("type") != "access":
        return None

    return payload


# --- API keys --------------------------------------------------------------

def generate_api_key() -> tuple[str, str, str]:
    """Return (plaintext key, display prefix, sha256 hash). Only the hash is stored."""
    raw_key = f"{API_KEY_PREFIX}{secrets.token_urlsafe(32)}"
    return raw_key, raw_key[:10], hash_api_key(raw_key)


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


# --- Encryption at rest ----------------------------------------------------

def _fernet() -> Fernet:
    source = settings.TOKEN_ENCRYPTION_KEY or settings.SECRET_KEY
    key = base64.urlsafe_b64encode(hashlib.sha256(source.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_secret(value: str | None) -> str | None:
    if value is None or value.startswith(ENCRYPTED_PREFIX):
        return value

    return ENCRYPTED_PREFIX + _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_secret(value: str | None) -> str | None:
    """Decrypt values written by encrypt_secret; plaintext legacy values pass through."""
    if value is None or not value.startswith(ENCRYPTED_PREFIX):
        return value

    try:
        return _fernet().decrypt(value[len(ENCRYPTED_PREFIX):].encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Stored secret could not be decrypted. Was SECRET_KEY/TOKEN_ENCRYPTION_KEY rotated?") from exc


# --- Signed links ----------------------------------------------------------

def sign_value(value: str, purpose: str) -> str:
    message = f"{purpose}:{value}".encode()
    digest = hmac.new(settings.SECRET_KEY.encode("utf-8"), message, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def verify_signed_value(value: str, signature: str, purpose: str) -> bool:
    if not value or not signature:
        return False

    return hmac.compare_digest(sign_value(value, purpose), signature)
