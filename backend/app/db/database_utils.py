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
    sent_at_type = "TIMESTAMP" if dialect_name == "postgresql" else "DATETIME"

    required_columns = {
        "sent_at": sent_at_type,
        "send_error": "TEXT",
        "gmail_message_id": "VARCHAR(255)",
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
