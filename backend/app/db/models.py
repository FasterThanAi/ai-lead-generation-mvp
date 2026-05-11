from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.database import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    campaign_name = Column(String(255), nullable=False)
    industry = Column(String(255), nullable=False)
    location = Column(String(255), nullable=False)
    target_role = Column(String(255), nullable=False)
    offer = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    leads = relationship("Lead", back_populates="campaign", cascade="all, delete-orphan")
    email_drafts = relationship("EmailDraft", back_populates="campaign", cascade="all, delete-orphan")
    follow_up_drafts = relationship("FollowUpDraft", back_populates="campaign", cascade="all, delete-orphan")


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    company_name = Column(String(255), nullable=False)
    website = Column(String(255), nullable=True)
    industry = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    contact_name = Column(String(255), nullable=True)
    contact_role = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    source = Column(String(100), default="CSV")
    status = Column(String(100), default="new")
    created_at = Column(DateTime, default=datetime.utcnow)

    campaign = relationship("Campaign", back_populates="leads")
    email_drafts = relationship("EmailDraft", back_populates="lead", cascade="all, delete-orphan")
    follow_up_drafts = relationship("FollowUpDraft", back_populates="lead", cascade="all, delete-orphan")


class EmailDraft(Base):
    __tablename__ = "email_drafts"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    status = Column(String(100), default="generated", nullable=False)
    ai_model = Column(String(255), nullable=True)
    sent_at = Column(DateTime, nullable=True)
    send_error = Column(Text, nullable=True)
    gmail_message_id = Column(String(255), nullable=True)
    reply_checked_at = Column(DateTime, nullable=True)
    reply_message_id = Column(String(255), nullable=True)
    reply_snippet = Column(Text, nullable=True)
    replied_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign = relationship("Campaign", back_populates="email_drafts")
    lead = relationship("Lead", back_populates="email_drafts")
    follow_up_drafts = relationship("FollowUpDraft", back_populates="original_email_draft", cascade="all, delete-orphan")


class FollowUpDraft(Base):
    __tablename__ = "follow_up_drafts"

    id = Column(Integer, primary_key=True, index=True)
    original_email_draft_id = Column(Integer, ForeignKey("email_drafts.id"), nullable=False, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    follow_up_number = Column(Integer, default=1, nullable=False)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    status = Column(String(100), default="generated", nullable=False)
    model_used = Column(String(255), nullable=True)
    generated_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    gmail_message_id = Column(String(255), nullable=True)
    gmail_thread_id = Column(String(255), nullable=True)
    send_error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    original_email_draft = relationship("EmailDraft", back_populates="follow_up_drafts")
    campaign = relationship("Campaign", back_populates="follow_up_drafts")
    lead = relationship("Lead", back_populates="follow_up_drafts")


class GmailToken(Base):
    __tablename__ = "gmail_tokens"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=True)
    token_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GmailOAuthState(Base):
    __tablename__ = "gmail_oauth_states"

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String(255), unique=True, nullable=False, index=True)
    code_verifier = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
