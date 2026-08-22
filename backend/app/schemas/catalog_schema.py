from datetime import datetime
from pydantic import BaseModel


class CatalogBase(BaseModel):
    name: str
    vertical: str | None = None
    description: str | None = None


class CatalogCreate(CatalogBase):
    pass


class CatalogResponse(CatalogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
