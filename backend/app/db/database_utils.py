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
