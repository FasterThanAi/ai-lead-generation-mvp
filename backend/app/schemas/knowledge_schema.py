from datetime import datetime

from pydantic import BaseModel, Field


KNOWLEDGE_CATEGORIES = {
    "Company Profile",
    "Product Details",
    "Pricing",
    "FAQ",
    "Case Study",
    "Demo Script",
    "Objection Handling",
    "Email Template",
    "Other",
}


class CompanyKnowledgeCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., min_length=1, max_length=100)
    content: str = Field(..., min_length=1, max_length=10000)
    tags: str | None = Field(None, max_length=500)
    is_active: bool = True


class CompanyKnowledgeUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    category: str | None = Field(None, min_length=1, max_length=100)
    content: str | None = Field(None, min_length=1, max_length=10000)
    tags: str | None = Field(None, max_length=500)
    is_active: bool | None = None


class CompanyKnowledgeResponse(BaseModel):
    id: int
    title: str
    category: str
    content: str
    tags: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
