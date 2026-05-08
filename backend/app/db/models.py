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


class EmailDraft(Base):
    __tablename__ = "email_drafts"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    status = Column(String(100), default="generated", nullable=False)
    ai_model = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign = relationship("Campaign", back_populates="email_drafts")
    lead = relationship("Lead", back_populates="email_drafts")
