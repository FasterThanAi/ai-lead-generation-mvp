from sqlalchemy import inspect, text


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
        "title": "VARCHAR(255)",
        "category": "VARCHAR(100)",
        "content": "TEXT",
        "tags": "VARCHAR(500)",
        "is_active": boolean_type,
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
            default_clause = " DEFAULT TRUE" if column_name == "is_active" else ""
            connection.execute(
                text(f"ALTER TABLE company_knowledge ADD COLUMN {column_name} {column_type}{default_clause}")
            )
