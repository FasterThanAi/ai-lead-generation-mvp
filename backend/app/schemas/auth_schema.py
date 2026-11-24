from pydantic import BaseModel, Field, field_validator

from app.services.suppression_service import is_valid_email, normalize_email


def _email(value: str) -> str:
    normalized = normalize_email(value)
    if not is_valid_email(normalized):
        raise ValueError("Enter a valid email address.")
    return normalized


class LoginRequest(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=1, max_length=256)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        return normalize_email(value)


class RegisterRequest(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=10, max_length=256)
    full_name: str | None = Field(None, max_length=255)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        return _email(value)

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, value):
        return value.strip() or None if value else None


class CreateUserRequest(RegisterRequest):
    role: str = Field("member", pattern="^(admin|member)$")


class UpdateUserRequest(BaseModel):
    role: str | None = Field(None, pattern="^(admin|member)$")
    is_active: bool | None = None
    full_name: str | None = Field(None, max_length=255)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=256)
    new_password: str = Field(..., min_length=10, max_length=256)


class ApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)

    @field_validator("name")
    @classmethod
    def strip(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Name is required.")
        return value


class SuppressionCreate(BaseModel):
    email: str = Field(..., max_length=255)
    reason: str = Field("manual", max_length=100)
    note: str | None = Field(None, max_length=2000)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        return _email(value)
