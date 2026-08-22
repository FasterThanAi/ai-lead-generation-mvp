import logging

from sqlalchemy import inspect, text

from app.core.config import settings


logger = logging.getLogger(__name__)


def ensure_catalog_columns(engine):
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    dialect_name = engine.dialect.name
    datetime_type = "TIMESTAMP" if dialect_name == "postgresql" else "DATETIME"
    id_type = "SERIAL PRIMARY KEY" if dialect_name == "postgresql" else "INTEGER PRIMARY KEY AUTOINCREMENT"
    current_timestamp = "NOW()" if dialect_name == "postgresql" else "CURRENT_TIMESTAMP"

    if "catalogs" not in table_names:
        with engine.begin() as connection:
            connection.execute(
                text(f"""
                    CREATE TABLE IF NOT EXISTS catalogs (
                        id {id_type},
                        name VARCHAR(255) NOT NULL,
                        vertical VARCHAR(255),
                        description TEXT,
                        created_at {datetime_type} DEFAULT {current_timestamp}
                    )
                """)
            )
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("catalogs")
    }

    required_columns = {
        "name": "VARCHAR(255)",
        "vertical": "VARCHAR(255)",
        "description": "TEXT",
        "created_at": datetime_type,
    }

    missing_columns = [
        (column_name, column_type)
        for column_name, column_type in required_columns.items()
        if column_name not in existing_columns and column_name != "id"
    ]

    if not missing_columns:
        return

    with engine.begin() as connection:
        for column_name, column_type in missing_columns:
            connection.execute(
                text(f"ALTER TABLE catalogs ADD COLUMN {column_name} {column_type}")
            )


def ensure_attribute_schema_columns(engine):
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    dialect_name = engine.dialect.name
    datetime_type = "TIMESTAMP" if dialect_name == "postgresql" else "DATETIME"
    id_type = "SERIAL PRIMARY KEY" if dialect_name == "postgresql" else "INTEGER PRIMARY KEY AUTOINCREMENT"
    current_timestamp = "NOW()" if dialect_name == "postgresql" else "CURRENT_TIMESTAMP"

    if "attribute_schemas" not in table_names:
        with engine.begin() as connection:
            connection.execute(
                text(f"""
                    CREATE TABLE IF NOT EXISTS attribute_schemas (
                        id {id_type},
                        catalog_id INTEGER,
                        category_name VARCHAR(255) NOT NULL,
                        attributes TEXT NOT NULL,
                        created_at {datetime_type} DEFAULT {current_timestamp},
                        updated_at {datetime_type}
                    )
                """)
            )
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_attribute_schemas_catalog_id ON attribute_schemas (catalog_id)")
            )
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("attribute_schemas")
    }

    required_columns = {
        "catalog_id": "INTEGER",
        "category_name": "VARCHAR(255)",
        "attributes": "TEXT",
        "created_at": datetime_type,
        "updated_at": datetime_type,
    }

    missing_columns = [
        (column_name, column_type)
        for column_name, column_type in required_columns.items()
        if column_name not in existing_columns and column_name != "id"
    ]

    if not missing_columns:
        return

    with engine.begin() as connection:
        for column_name, column_type in missing_columns:
            connection.execute(
                text(f"ALTER TABLE attribute_schemas ADD COLUMN {column_name} {column_type}")
            )


def ensure_product_columns(engine):
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    dialect_name = engine.dialect.name
    datetime_type = "TIMESTAMP" if dialect_name == "postgresql" else "DATETIME"
    id_type = "SERIAL PRIMARY KEY" if dialect_name == "postgresql" else "INTEGER PRIMARY KEY AUTOINCREMENT"
    current_timestamp = "NOW()" if dialect_name == "postgresql" else "CURRENT_TIMESTAMP"

    if "products" not in table_names:
        with engine.begin() as connection:
            connection.execute(
                text(f"""
                    CREATE TABLE IF NOT EXISTS products (
                        id {id_type},
                        catalog_id INTEGER NOT NULL,
                        part_number VARCHAR(255) NOT NULL,
                        manufacturer VARCHAR(255),
                        short_description TEXT,
                        category VARCHAR(255),
                        canonical_name VARCHAR(500),
                        long_description TEXT,
                        status VARCHAR(50) DEFAULT 'pending' NOT NULL,
                        completeness_score INTEGER,
                        confidence_score INTEGER,
                        quality_grade VARCHAR(2),
                        enriched_at {datetime_type},
                        model_used VARCHAR(255),
                        error TEXT,
                        created_at {datetime_type} DEFAULT {current_timestamp}
                    )
                """)
            )
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_products_catalog_id ON products (catalog_id)")
            )
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_products_part_number ON products (part_number)")
            )
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("products")
    }

    required_columns = {
        "catalog_id": "INTEGER",
        "part_number": "VARCHAR(255)",
        "manufacturer": "VARCHAR(255)",
        "short_description": "TEXT",
        "category": "VARCHAR(255)",
        "canonical_name": "VARCHAR(500)",
        "long_description": "TEXT",
        "status": "VARCHAR(50)",
        "completeness_score": "INTEGER",
        "confidence_score": "INTEGER",
        "quality_grade": "VARCHAR(2)",
        "enriched_at": datetime_type,
        "model_used": "VARCHAR(255)",
        "error": "TEXT",
        "created_at": datetime_type,
    }

    missing_columns = [
        (column_name, column_type)
        for column_name, column_type in required_columns.items()
        if column_name not in existing_columns and column_name != "id"
    ]

    if not missing_columns:
        return

    with engine.begin() as connection:
        for column_name, column_type in missing_columns:
            default_clause = " DEFAULT 'pending'" if column_name == "status" else ""
            connection.execute(
                text(f"ALTER TABLE products ADD COLUMN {column_name} {column_type}{default_clause}")
            )


def ensure_source_document_columns(engine):
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    dialect_name = engine.dialect.name
    datetime_type = "TIMESTAMP" if dialect_name == "postgresql" else "DATETIME"
    id_type = "SERIAL PRIMARY KEY" if dialect_name == "postgresql" else "INTEGER PRIMARY KEY AUTOINCREMENT"
    current_timestamp = "NOW()" if dialect_name == "postgresql" else "CURRENT_TIMESTAMP"

    if "source_documents" not in table_names:
        with engine.begin() as connection:
            connection.execute(
                text(f"""
                    CREATE TABLE IF NOT EXISTS source_documents (
                        id {id_type},
                        product_id INTEGER NOT NULL,
                        url VARCHAR(1000),
                        filename VARCHAR(500),
                        doc_type VARCHAR(20),
                        fetched_at {datetime_type},
                        content_hash VARCHAR(64),
                        text_snippet TEXT,
                        page_number INTEGER,
                        created_at {datetime_type} DEFAULT {current_timestamp},
                        updated_at {datetime_type}
                    )
                """)
            )
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_source_documents_product_id ON source_documents (product_id)")
            )
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_source_documents_content_hash ON source_documents (content_hash)")
            )
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("source_documents")
    }

    required_columns = {
        "product_id": "INTEGER",
        "url": "VARCHAR(1000)",
        "filename": "VARCHAR(500)",
        "doc_type": "VARCHAR(20)",
        "fetched_at": datetime_type,
        "content_hash": "VARCHAR(64)",
        "text_snippet": "TEXT",
        "page_number": "INTEGER",
        "created_at": datetime_type,
        "updated_at": datetime_type,
    }

    missing_columns = [
        (column_name, column_type)
        for column_name, column_type in required_columns.items()
        if column_name not in existing_columns and column_name != "id"
    ]

    if not missing_columns:
        return

    with engine.begin() as connection:
        for column_name, column_type in missing_columns:
            connection.execute(
                text(f"ALTER TABLE source_documents ADD COLUMN {column_name} {column_type}")
            )


def ensure_product_attribute_columns(engine):
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    dialect_name = engine.dialect.name
    datetime_type = "TIMESTAMP" if dialect_name == "postgresql" else "DATETIME"
    id_type = "SERIAL PRIMARY KEY" if dialect_name == "postgresql" else "INTEGER PRIMARY KEY AUTOINCREMENT"
    current_timestamp = "NOW()" if dialect_name == "postgresql" else "CURRENT_TIMESTAMP"

    if "product_attributes" not in table_names:
        with engine.begin() as connection:
            connection.execute(
                text(f"""
                    CREATE TABLE IF NOT EXISTS product_attributes (
                        id {id_type},
                        product_id INTEGER NOT NULL,
                        key VARCHAR(255) NOT NULL,
                        value_raw TEXT,
                        value_norm TEXT,
                        unit VARCHAR(50),
                        confidence INTEGER,
                        status VARCHAR(20) DEFAULT 'proposed' NOT NULL,
                        source_id INTEGER,
                        extraction_method VARCHAR(20),
                        validation_flags TEXT,
                        model_used VARCHAR(255),
                        reviewed_by VARCHAR(255),
                        reviewed_at {datetime_type},
                        created_at {datetime_type} DEFAULT {current_timestamp},
                        updated_at {datetime_type},
                        CONSTRAINT uq_product_attr_source UNIQUE (product_id, key, source_id)
                    )
                """)
            )
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_product_attributes_product_id ON product_attributes (product_id)")
            )
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_product_attributes_key ON product_attributes (key)")
            )
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_product_attributes_source_id ON product_attributes (source_id)")
            )
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("product_attributes")
    }

    required_columns = {
        "product_id": "INTEGER",
        "key": "VARCHAR(255)",
        "value_raw": "TEXT",
        "value_norm": "TEXT",
        "unit": "VARCHAR(50)",
        "confidence": "INTEGER",
        "status": "VARCHAR(20)",
        "source_id": "INTEGER",
        "extraction_method": "VARCHAR(20)",
        "validation_flags": "TEXT",
        "model_used": "VARCHAR(255)",
        "reviewed_by": "VARCHAR(255)",
        "reviewed_at": datetime_type,
        "created_at": datetime_type,
        "updated_at": datetime_type,
    }

    missing_columns = [
        (column_name, column_type)
        for column_name, column_type in required_columns.items()
        if column_name not in existing_columns and column_name != "id"
    ]

    if not missing_columns:
        return

    with engine.begin() as connection:
        for column_name, column_type in missing_columns:
            default_clause = " DEFAULT 'proposed'" if column_name == "status" else ""
            connection.execute(
                text(f"ALTER TABLE product_attributes ADD COLUMN {column_name} {column_type}{default_clause}")
            )


def ensure_attribute_conflict_columns(engine):
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    dialect_name = engine.dialect.name
    datetime_type = "TIMESTAMP" if dialect_name == "postgresql" else "DATETIME"
    id_type = "SERIAL PRIMARY KEY" if dialect_name == "postgresql" else "INTEGER PRIMARY KEY AUTOINCREMENT"
    current_timestamp = "NOW()" if dialect_name == "postgresql" else "CURRENT_TIMESTAMP"

    if "attribute_conflicts" not in table_names:
        with engine.begin() as connection:
            connection.execute(
                text(f"""
                    CREATE TABLE IF NOT EXISTS attribute_conflicts (
                        id {id_type},
                        product_id INTEGER NOT NULL,
                        key VARCHAR(255) NOT NULL,
                        candidates TEXT NOT NULL,
                        resolution VARCHAR(20) DEFAULT 'unresolved' NOT NULL,
                        resolved_value TEXT,
                        resolved_by VARCHAR(255),
                        resolved_at {datetime_type},
                        created_at {datetime_type} DEFAULT {current_timestamp}
                    )
                """)
            )
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_attribute_conflicts_product_id ON attribute_conflicts (product_id)")
            )
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_attribute_conflicts_key ON attribute_conflicts (key)")
            )
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("attribute_conflicts")
    }

    required_columns = {
        "product_id": "INTEGER",
        "key": "VARCHAR(255)",
        "candidates": "TEXT",
        "resolution": "VARCHAR(20)",
        "resolved_value": "TEXT",
        "resolved_by": "VARCHAR(255)",
        "resolved_at": datetime_type,
        "created_at": datetime_type,
    }

    missing_columns = [
        (column_name, column_type)
        for column_name, column_type in required_columns.items()
        if column_name not in existing_columns and column_name != "id"
    ]

    if not missing_columns:
        return

    with engine.begin() as connection:
        for column_name, column_type in missing_columns:
            default_clause = " DEFAULT 'unresolved'" if column_name == "resolution" else ""
            connection.execute(
                text(f"ALTER TABLE attribute_conflicts ADD COLUMN {column_name} {column_type}{default_clause}")
            )


def ensure_enrichment_job_columns(engine):
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    dialect_name = engine.dialect.name
    datetime_type = "TIMESTAMP" if dialect_name == "postgresql" else "DATETIME"
    id_type = "SERIAL PRIMARY KEY" if dialect_name == "postgresql" else "INTEGER PRIMARY KEY AUTOINCREMENT"
    current_timestamp = "NOW()" if dialect_name == "postgresql" else "CURRENT_TIMESTAMP"

    required_columns = {
        "id": "INTEGER",
        "catalog_id": "INTEGER",
        "status": "VARCHAR(50)",
        "total": "INTEGER",
        "processed": "INTEGER",
        "succeeded": "INTEGER",
        "skipped": "INTEGER",
        "failed": "INTEGER",
        "started_at": datetime_type,
        "finished_at": datetime_type,
        "error": "TEXT",
    }

    if "enrichment_jobs" not in table_names:
        with engine.begin() as connection:
            connection.execute(
                text(f"""
                    CREATE TABLE IF NOT EXISTS enrichment_jobs (
                        id {id_type},
                        catalog_id INTEGER NOT NULL,
                        status VARCHAR(50) DEFAULT 'pending' NOT NULL,
                        total INTEGER DEFAULT 0 NOT NULL,
                        processed INTEGER DEFAULT 0 NOT NULL,
                        succeeded INTEGER DEFAULT 0 NOT NULL,
                        skipped INTEGER DEFAULT 0 NOT NULL,
                        failed INTEGER DEFAULT 0 NOT NULL,
                        started_at {datetime_type} DEFAULT {current_timestamp},
                        finished_at {datetime_type},
                        error TEXT
                    )
                """)
            )
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_enrichment_jobs_catalog_id ON enrichment_jobs (catalog_id)")
            )
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("enrichment_jobs")
    }
    missing_columns = [
        (column_name, column_type)
        for column_name, column_type in required_columns.items()
        if column_name not in existing_columns and column_name != "id"
    ]

    if not missing_columns:
        return

    with engine.begin() as connection:
        for column_name, column_type in missing_columns:
            default_clause = ""
            if column_name == "status":
                default_clause = " DEFAULT 'pending'"
            if column_name in {"total", "processed", "succeeded", "skipped", "failed"}:
                default_clause = " DEFAULT 0"
            connection.execute(
                text(f"ALTER TABLE enrichment_jobs ADD COLUMN {column_name} {column_type}{default_clause}")
            )

        connection.execute(text("UPDATE enrichment_jobs SET status = 'pending' WHERE status IS NULL"))
        for column_name in ("total", "processed", "succeeded", "skipped", "failed"):
            connection.execute(text(f"UPDATE enrichment_jobs SET {column_name} = 0 WHERE {column_name} IS NULL"))


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

    if not missing_columns:
        return

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
