"""Schema bootstrap and additive migrations.

Run once per deploy via ``python -m app.cli migrate`` (Render pre-deploy command,
Docker entrypoint) or automatically at startup when RUN_MIGRATIONS_ON_STARTUP is
true. On PostgreSQL a transaction-scoped advisory lock serialises concurrent
runs so several replicas booting together cannot race on DDL.
"""
import logging
from contextlib import contextmanager

from sqlalchemy import text

from app.db import models  # noqa: F401 - registers every table on Base.metadata
from app.db.database import Base, engine
from app.db.database_utils import (
    ensure_call_columns,
    ensure_company_knowledge_columns,
    ensure_company_knowledge_embedding_columns,
    ensure_discovery_columns,
    ensure_email_draft_columns,
    ensure_email_extraction_job_columns,
    ensure_knowledge_document_columns,
    ensure_lead_ai_scoring_columns,
    ensure_lead_call_columns,
    ensure_lead_discovery_source_columns,
    ensure_lead_research_columns,
    ensure_lead_research_job_columns,
    ensure_lead_scoring_job_columns,
    ensure_opportunity_columns,
    ensure_reply_response_draft_columns,
)

logger = logging.getLogger(__name__)
MIGRATION_LOCK_ID = 7_413_902_221

COLUMN_MIGRATIONS = (
    ensure_email_draft_columns,
    ensure_email_extraction_job_columns,
    ensure_lead_research_job_columns,
    ensure_lead_scoring_job_columns,
    ensure_lead_ai_scoring_columns,
    ensure_lead_research_columns,
    ensure_lead_discovery_source_columns,
    ensure_lead_call_columns,
    ensure_opportunity_columns,
    ensure_discovery_columns,
    ensure_call_columns,
    ensure_reply_response_draft_columns,
    ensure_company_knowledge_columns,
    ensure_knowledge_document_columns,
    ensure_company_knowledge_embedding_columns,
)

# Indexes for the hottest filters (campaign lists, status tabs, dedupe lookups).
INDEXES = (
    ("ix_leads_campaign_status", "leads", "campaign_id, status"),
    ("ix_leads_email", "leads", "email"),
    ("ix_leads_website", "leads", "website"),
    ("ix_leads_created_at", "leads", "created_at"),
    ("ix_email_drafts_status", "email_drafts", "status"),
    ("ix_email_drafts_campaign_status", "email_drafts", "campaign_id, status"),
    ("ix_email_drafts_sent_at", "email_drafts", "sent_at"),
    ("ix_follow_up_drafts_status", "follow_up_drafts", "status"),
    ("ix_reply_response_drafts_status", "reply_response_drafts", "status"),
)


@contextmanager
def _migration_lock():
    if engine.dialect.name != "postgresql":
        yield
        return
    with engine.connect() as connection:
        connection.execute(text("SELECT pg_advisory_lock(:id)"), {"id": MIGRATION_LOCK_ID})
        try:
            yield
        finally:
            connection.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": MIGRATION_LOCK_ID})
            connection.commit()


def run_migrations() -> None:
    with _migration_lock():
        Base.metadata.create_all(bind=engine)
        for migration in COLUMN_MIGRATIONS:
            migration(engine)
        with engine.begin() as connection:
            for name, table, columns in INDEXES:
                connection.execute(text(f"CREATE INDEX IF NOT EXISTS {name} ON {table} ({columns})"))
    logger.info("Database schema is up to date.")
