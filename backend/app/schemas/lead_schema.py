from datetime import datetime

from pydantic import BaseModel


class LeadBase(BaseModel):
    company_name: str
    website: str | None = None
    industry: str | None = None
    location: str | None = None
    contact_name: str | None = None
    contact_role: str | None = None
    email: str | None = None
    source: str | None = None


class LeadCreate(LeadBase):
    campaign_id: int


class LeadCSVRow(LeadBase):
    source: str | None = "CSV"


class LeadResponse(LeadBase):
    id: int
    campaign_id: int
    source: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
