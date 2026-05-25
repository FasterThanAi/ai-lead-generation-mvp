import logging

from sqlalchemy import inspect, text

from app.core.config import settings


logger = logging.getLogger(__name__)


def ensure_email_draft_columns(engine):
    inspector = inspect(engine)

    if "email_drafts" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("email_drafts")
    }

    dialect_name = engine.dialect.name
    datetime_type = "TIMESTAMP" if dialect_name == "postgresql" else "DATETIME"

    required_columns = {
        "sent_at": datetime_type,
        "send_error": "TEXT",
        "gmail_message_id": "VARCHAR(255)",
        "reply_checked_at": datetime_type,
        "reply_message_id": "VARCHAR(255)",
        "reply_snippet": "TEXT",
        "replied_at": datetime_type,
        "reply_intent": "VARCHAR(100)",
        "reply_sentiment": "VARCHAR(50)",
        "reply_priority": "VARCHAR(50)",
        "reply_next_action": "TEXT",
        "reply_summary": "TEXT",
        "reply_suggested_response_direction": "TEXT",
        "reply_classified_at": datetime_type,
        "reply_classification_model": "VARCHAR(255)",
        "reply_classification_error": "TEXT",
    }

    missing_columns = [
        (column_name, column_type)
        for column_name, column_type in required_columns.items()
        if column_name not in existing_columns
    ]

    if not missing_columns:
        return

    with engine.begin() as connection:
        for column_name, column_type in missing_columns:
            connection.execute(
                text(f"ALTER TABLE email_drafts ADD COLUMN {column_name} {column_type}")
            )


def ensure_lead_ai_scoring_columns(engine):
    inspector = inspect(engine)

    if "leads" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("leads")
    }

    dialect_name = engine.dialect.name
    datetime_type = "TIMESTAMP" if dialect_name == "postgresql" else "DATETIME"

    required_columns = {
        "ai_score": "INTEGER",
        "ai_fit_score": "INTEGER",
        "ai_contact_confidence_score": "INTEGER",
        "ai_priority": "VARCHAR(50)",
        "ai_qualification": "VARCHAR(50)",
        "ai_score_reason": "TEXT",
        "ai_contact_confidence_reason": "TEXT",
        "ai_outreach_angle": "TEXT",
        "ai_pain_point": "TEXT",
        "ai_recommended_cta": "TEXT",
        "ai_final_priority_reason": "TEXT",
        "ai_scored_at": datetime_type,
        "ai_model_used": "VARCHAR(255)",
        "ai_score_error": "TEXT",
    }

    missing_columns = [
        (column_name, column_type)
        for column_name, column_type in required_columns.items()
        if column_name not in existing_columns
    ]

    if not missing_columns:
        return

    with engine.begin() as connection:
        for column_name, column_type in missing_columns:
            connection.execute(
                text(f"ALTER TABLE leads ADD COLUMN {column_name} {column_type}")
            )


def ensure_reply_response_draft_columns(engine):
    inspector = inspect(engine)

    if "reply_response_drafts" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("reply_response_drafts")
    }

    dialect_name = engine.dialect.name
    datetime_type = "TIMESTAMP" if dialect_name == "postgresql" else "DATETIME"

    required_columns = {
        "original_email_draft_id": "INTEGER",
        "campaign_id": "INTEGER",
        "lead_id": "INTEGER",
        "subject": "VARCHAR(255)",
        "body": "TEXT",
        "status": "VARCHAR(100)",
        "intent_used": "VARCHAR(100)",
        "next_action_used": "TEXT",
        "knowledge_used": "TEXT",
        "model_used": "VARCHAR(255)",
        "generated_at": datetime_type,
        "approved_at": datetime_type,
        "rejected_at": datetime_type,
        "sent_at": datetime_type,
        "gmail_message_id": "VARCHAR(255)",
        "gmail_thread_id": "VARCHAR(255)",
        "send_error": "TEXT",
        "created_at": datetime_type,
        "updated_at": datetime_type,
    }

    missing_columns = [
        (column_name, column_type)
        for column_name, column_type in required_columns.items()
        if column_name not in existing_columns
    ]

    if not missing_columns:
        return

    with engine.begin() as connection:
        for column_name, column_type in missing_columns:
            connection.execute(
                text(f"ALTER TABLE reply_response_drafts ADD COLUMN {column_name} {column_type}")
            )


def ensure_company_knowledge_columns(engine):
    inspector = inspect(engine)

    if "company_knowledge" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("company_knowledge")
    }

    dialect_name = engine.dialect.name
    datetime_type = "TIMESTAMP" if dialect_name == "postgresql" else "DATETIME"
    boolean_type = "BOOLEAN"

    required_columns = {
        "document_id": "INTEGER",
        "title": "VARCHAR(255)",
        "category": "VARCHAR(100)",
        "content": "TEXT",
        "tags": "VARCHAR(500)",
        "chunk_index": "INTEGER",
        "source_type": "VARCHAR(50)",
        "embedding_model": "VARCHAR(255)",
        "embedding_updated_at": datetime_type,
        "embedding_error": "TEXT",
        "is_active": boolean_type,
        "created_at": datetime_type,
        "updated_at": datetime_type,
    }

    missing_columns = [
        (column_name, column_type)
        for column_name, column_type in required_columns.items()
        if column_name not in existing_columns
    ]

    with engine.begin() as connection:
        for column_name, column_type in missing_columns:
            default_clause = " DEFAULT TRUE" if column_name == "is_active" else ""
            if column_name == "source_type":
                default_clause = " DEFAULT 'manual'"
            connection.execute(
                text(f"ALTER TABLE company_knowledge ADD COLUMN {column_name} {column_type}{default_clause}")
            )

        if "source_type" in existing_columns or any(column_name == "source_type" for column_name, _ in missing_columns):
            connection.execute(
                text("UPDATE company_knowledge SET source_type = 'manual' WHERE source_type IS NULL")
            )


def ensure_company_knowledge_embedding_columns(engine):
    inspector = inspect(engine)

    if "company_knowledge" not in inspector.get_table_names():
        return

    dialect_name = engine.dialect.name

    if dialect_name != "postgresql":
        logger.warning("Semantic RAG pgvector setup skipped because database dialect is %s.", dialect_name)
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("company_knowledge")
    }

    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    except Exception as exc:
        logger.warning("Could not enable pgvector extension. Keyword fallback will remain available. %s", exc)
        return

    desired_vector_type = f"vector({settings.EMBEDDING_DIMENSION})"

    if "embedding" not in existing_columns:
        try:
            with engine.begin() as connection:
                connection.execute(
                    text(f"ALTER TABLE company_knowledge ADD COLUMN embedding vector({settings.EMBEDDING_DIMENSION})")
                )
        except Exception as exc:
            logger.warning("Could not add company_knowledge.embedding vector column. Keyword fallback will remain available. %s", exc)
            return
    else:
        try:
            with engine.begin() as connection:
                current_vector_type = connection.execute(
                    text(
                        "SELECT format_type(a.atttypid, a.atttypmod) "
                        "FROM pg_attribute a "
                        "JOIN pg_class c ON a.attrelid = c.oid "
                        "WHERE c.relname = 'company_knowledge' "
                        "AND a.attname = 'embedding' "
                        "AND a.attnum > 0 "
                        "AND NOT a.attisdropped"
                    )
                ).scalar()

                if current_vector_type and current_vector_type != desired_vector_type:
                    logger.warning(
                        "company_knowledge.embedding is %s but configured dimension is %s. "
                        "Clearing stored embeddings and updating column dimension.",
                        current_vector_type,
                        desired_vector_type,
                    )
                    connection.execute(
                        text(
                            f"ALTER TABLE company_knowledge "
                            f"ALTER COLUMN embedding TYPE vector({settings.EMBEDDING_DIMENSION}) "
                            "USING NULL"
                        )
                    )
                    connection.execute(
                        text(
                            "UPDATE company_knowledge "
                            "SET embedding_model = NULL, embedding_updated_at = NULL "
                            "WHERE embedding IS NULL"
                        )
                    )
        except Exception as exc:
            logger.warning("Could not verify or update embedding column dimension. Keyword fallback will remain available. %s", exc)
            return

    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS company_knowledge_embedding_idx "
                    "ON company_knowledge "
                    "USING ivfflat (embedding vector_cosine_ops) "
                    "WITH (lists = 100)"
                )
            )
    except Exception as exc:
        logger.warning("Could not create company_knowledge embedding index. Semantic search can still run without it. %s", exc)


def ensure_knowledge_document_columns(engine):
    inspector = inspect(engine)

    if "knowledge_documents" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("knowledge_documents")
    }

    dialect_name = engine.dialect.name
    datetime_type = "TIMESTAMP" if dialect_name == "postgresql" else "DATETIME"

    required_columns = {
        "filename": "VARCHAR(255)",
        "original_filename": "VARCHAR(255)",
        "file_type": "VARCHAR(50)",
        "category": "VARCHAR(100)",
        "tags": "VARCHAR(500)",
        "status": "VARCHAR(50)",
        "error_message": "TEXT",
        "total_chunks": "INTEGER",
        "uploaded_at": datetime_type,
        "updated_at": datetime_type,
    }

    missing_columns = [
        (column_name, column_type)
        for column_name, column_type in required_columns.items()
        if column_name not in existing_columns
    ]

    if not missing_columns:
        return

    with engine.begin() as connection:
        for column_name, column_type in missing_columns:
            default_clause = ""
            if column_name == "status":
                default_clause = " DEFAULT 'processed'"
            if column_name == "total_chunks":
                default_clause = " DEFAULT 0"
            connection.execute(
                text(f"ALTER TABLE knowledge_documents ADD COLUMN {column_name} {column_type}{default_clause}")
            )
