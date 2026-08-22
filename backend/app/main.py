from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.api_router import api_router
from app.db.database import Base, engine
from app.db.database_utils import (
    ensure_catalog_columns,
    ensure_attribute_schema_columns,
    ensure_product_columns,
    ensure_source_document_columns,
    ensure_product_attribute_columns,
    ensure_attribute_conflict_columns,
    ensure_enrichment_job_columns,
    ensure_company_knowledge_columns,
    ensure_knowledge_document_columns,
    ensure_company_knowledge_embedding_columns,
)
from app.db.models import (  # noqa: F401
    Catalog,
    AttributeSchema,
    Product,
    SourceDocument,
    ProductAttribute,
    AttributeConflict,
    EnrichmentJob,
    KnowledgeDocument,
    CompanyKnowledge,
)

# Import models above so Base.metadata includes all MVP tables before create_all.
Base.metadata.create_all(bind=engine)
ensure_catalog_columns(engine)
ensure_attribute_schema_columns(engine)
ensure_product_columns(engine)
ensure_source_document_columns(engine)
ensure_product_attribute_columns(engine)
ensure_attribute_conflict_columns(engine)
ensure_enrichment_job_columns(engine)
ensure_company_knowledge_columns(engine)
ensure_knowledge_document_columns(engine)
ensure_company_knowledge_embedding_columns(engine)

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.FRONTEND_URLS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

@app.get("/")
def root():
    return {
        "message": f"{settings.APP_NAME} Backend is running"
    }
