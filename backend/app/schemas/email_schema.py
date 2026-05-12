from datetime import datetime

from pydantic import BaseModel


class EmailDraftResponse(BaseModel):
    id: int
    campaign_id: int
    lead_id: int
    subject: str
    body: str
    status: str
    ai_model: str | None = None
    sent_at: datetime | None = None
    send_error: str | None = None
    gmail_message_id: str | None = None
    reply_checked_at: datetime | None = None
    reply_message_id: str | None = None
    reply_snippet: str | None = None
    replied_at: datetime | None = None
    created_at: datetime
    lead_company_name: str | None = None
    lead_contact_name: str | None = None
    lead_contact_role: str | None = None
    lead_email: str | None = None
    lead_ai_score: int | None = None
    lead_ai_priority: str | None = None
    lead_ai_qualification: str | None = None

    class Config:
        from_attributes = True


class GenerateEmailResponse(BaseModel):
    status: str
    message: str
    email_draft: EmailDraftResponse


class EmailDraftUpdate(BaseModel):
    status: str
