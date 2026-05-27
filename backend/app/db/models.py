from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.database import Base
from app.utils.time_utils import utc_now


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    campaign_name = Column(String(255), nullable=False)
    industry = Column(String(255), nullable=False)
    location = Column(String(255), nullable=False)
    target_role = Column(String(255), nullable=False)
    offer = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utc_now)

    leads = relationship("Lead", back_populates="campaign", cascade="all, delete-orphan")
    email_drafts = relationship("EmailDraft", back_populates="campaign", cascade="all, delete-orphan")
    follow_up_drafts = relationship("FollowUpDraft", back_populates="campaign", cascade="all, delete-orphan")
    reply_response_drafts = relationship("ReplyResponseDraft", back_populates="campaign", cascade="all, delete-orphan")


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
    ai_score = Column(Integer, nullable=True)
    ai_fit_score = Column(Integer, nullable=True)
    ai_contact_confidence_score = Column(Integer, nullable=True)
    ai_priority = Column(String(50), nullable=True)
    ai_qualification = Column(String(50), nullable=True)
    ai_score_reason = Column(Text, nullable=True)
    ai_contact_confidence_reason = Column(Text, nullable=True)
    ai_outreach_angle = Column(Text, nullable=True)
    ai_pain_point = Column(Text, nullable=True)
    ai_recommended_cta = Column(Text, nullable=True)
    ai_final_priority_reason = Column(Text, nullable=True)
    ai_scored_at = Column(DateTime, nullable=True)
    ai_model_used = Column(String(255), nullable=True)
    ai_score_error = Column(Text, nullable=True)
    research_status = Column(String(50), default="not_researched", nullable=False)
    research_summary = Column(Text, nullable=True)
    research_business_type = Column(String(255), nullable=True)
    research_target_customers = Column(Text, nullable=True)
    research_products_services = Column(Text, nullable=True)
    research_pain_points = Column(Text, nullable=True)
    research_use_case_fit = Column(Text, nullable=True)
    research_outreach_angle = Column(Text, nullable=True)
    research_risk_flags = Column(Text, nullable=True)
    research_confidence = Column(Integer, nullable=True)
    research_sources = Column(Text, nullable=True)
    research_error = Column(Text, nullable=True)
    research_used_fallback = Column(Boolean, default=False, nullable=False)
    researched_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    campaign = relationship("Campaign", back_populates="leads")
    email_drafts = relationship("EmailDraft", back_populates="lead", cascade="all, delete-orphan")
    follow_up_drafts = relationship("FollowUpDraft", back_populates="lead", cascade="all, delete-orphan")
    reply_response_drafts = relationship("ReplyResponseDraft", back_populates="lead", cascade="all, delete-orphan")


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
    reply_intent = Column(String(100), nullable=True)
    reply_sentiment = Column(String(50), nullable=True)
    reply_priority = Column(String(50), nullable=True)
    reply_next_action = Column(Text, nullable=True)
    reply_summary = Column(Text, nullable=True)
    reply_suggested_response_direction = Column(Text, nullable=True)
    reply_classified_at = Column(DateTime, nullable=True)
    reply_classification_model = Column(String(255), nullable=True)
    reply_classification_error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    campaign = relationship("Campaign", back_populates="email_drafts")
    lead = relationship("Lead", back_populates="email_drafts")
    follow_up_drafts = relationship("FollowUpDraft", back_populates="original_email_draft", cascade="all, delete-orphan")
    reply_response_drafts = relationship("ReplyResponseDraft", back_populates="original_email_draft", cascade="all, delete-orphan")


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
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    original_email_draft = relationship("EmailDraft", back_populates="follow_up_drafts")
    campaign = relationship("Campaign", back_populates="follow_up_drafts")
    lead = relationship("Lead", back_populates="follow_up_drafts")


class ReplyResponseDraft(Base):
    __tablename__ = "reply_response_drafts"

    id = Column(Integer, primary_key=True, index=True)
    original_email_draft_id = Column(Integer, ForeignKey("email_drafts.id"), nullable=False, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    status = Column(String(100), default="generated", nullable=False)
    intent_used = Column(String(100), nullable=True)
    next_action_used = Column(Text, nullable=True)
    knowledge_used = Column(Text, nullable=True)
    model_used = Column(String(255), nullable=True)
    generated_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    gmail_message_id = Column(String(255), nullable=True)
    gmail_thread_id = Column(String(255), nullable=True)
    send_error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    original_email_draft = relationship("EmailDraft", back_populates="reply_response_drafts")
    campaign = relationship("Campaign", back_populates="reply_response_drafts")
    lead = relationship("Lead", back_populates="reply_response_drafts")


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    category = Column(String(100), nullable=True)
    tags = Column(String(500), nullable=True)
    status = Column(String(50), default="processed", nullable=False)
    error_message = Column(Text, nullable=True)
    total_chunks = Column(Integer, default=0, nullable=False)
    uploaded_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, nullable=True, onupdate=utc_now)

    knowledge_entries = relationship("CompanyKnowledge", back_populates="document")


class CompanyKnowledge(Base):
    __tablename__ = "company_knowledge"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("knowledge_documents.id"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    tags = Column(String(500), nullable=True)
    chunk_index = Column(Integer, nullable=True)
    source_type = Column(String(50), default="manual", nullable=False)
    embedding_model = Column(String(255), nullable=True)
    embedding_updated_at = Column(DateTime, nullable=True)
    embedding_error = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, nullable=True, onupdate=utc_now)

    document = relationship("KnowledgeDocument", back_populates="knowledge_entries")


class GmailToken(Base):
    __tablename__ = "gmail_tokens"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=True)
    token_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


class GmailOAuthState(Base):
    __tablename__ = "gmail_oauth_states"

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String(255), unique=True, nullable=False, index=True)
    code_verifier = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
