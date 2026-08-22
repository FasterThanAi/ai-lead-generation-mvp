from datetime import datetime
from pydantic import BaseModel


class ProductBase(BaseModel):
    part_number: str
    manufacturer: str | None = None
    short_description: str | None = None
    category: str | None = None
    canonical_name: str | None = None
    long_description: str | None = None


class ProductCreate(ProductBase):
    catalog_id: int


class ProductResponse(ProductBase):
    id: int
    catalog_id: int
    status: str
    completeness_score: int | None = None
    confidence_score: int | None = None
    quality_grade: str | None = None
    enriched_at: datetime | None = None
    model_used: str | None = None
    error: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True
