from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db.database import Base
from app.utils.time_utils import utc_now


class Catalog(Base):
    __tablename__ = "catalogs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    vertical = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    products = relationship("Product", back_populates="catalog", cascade="all, delete-orphan")
    attribute_schemas = relationship("AttributeSchema", back_populates="catalog", cascade="all, delete-orphan")
    enrichment_jobs = relationship("EnrichmentJob", back_populates="catalog", cascade="all, delete-orphan")


class AttributeSchema(Base):
    __tablename__ = "attribute_schemas"

    id = Column(Integer, primary_key=True, index=True)
    catalog_id = Column(Integer, ForeignKey("catalogs.id"), nullable=True, index=True)
    category_name = Column(String(255), nullable=False)
    attributes = Column(Text, nullable=False)  # JSON array of schema definitions
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, nullable=True, onupdate=utc_now)

    catalog = relationship("Catalog", back_populates="attribute_schemas")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    catalog_id = Column(Integer, ForeignKey("catalogs.id"), nullable=False, index=True)
    part_number = Column(String(255), nullable=False, index=True)
    manufacturer = Column(String(255), nullable=True)
    short_description = Column(Text, nullable=True)
    category = Column(String(255), nullable=True)
    canonical_name = Column(String(500), nullable=True)
    long_description = Column(Text, nullable=True)
    status = Column(String(50), default="pending", nullable=False)
    completeness_score = Column(Integer, nullable=True)
    confidence_score = Column(Integer, nullable=True)
    quality_grade = Column(String(2), nullable=True)
    enriched_at = Column(DateTime, nullable=True)
    model_used = Column(String(255), nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    catalog = relationship("Catalog", back_populates="products")
    attributes = relationship("ProductAttribute", back_populates="product", cascade="all, delete-orphan")
    source_documents = relationship("SourceDocument", back_populates="product", cascade="all, delete-orphan")
    conflicts = relationship("AttributeConflict", back_populates="product", cascade="all, delete-orphan")


class SourceDocument(Base):
    __tablename__ = "source_documents"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    url = Column(String(1000), nullable=True)
    filename = Column(String(500), nullable=True)
    doc_type = Column(String(20), nullable=True)  # html|pdf|image|xlsx|docx
    fetched_at = Column(DateTime, nullable=True)
    content_hash = Column(String(64), nullable=True, index=True)
    text_snippet = Column(Text, nullable=True)
    page_number = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, nullable=True, onupdate=utc_now)

    product = relationship("Product", back_populates="source_documents")
    attributes = relationship("ProductAttribute", back_populates="source")


class ProductAttribute(Base):
    __tablename__ = "product_attributes"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    key = Column(String(255), nullable=False, index=True)
    value_raw = Column(Text, nullable=True)
    value_norm = Column(Text, nullable=True)
    unit = Column(String(50), nullable=True)
    confidence = Column(Integer, nullable=True)  # 0-100
    status = Column(String(20), default="proposed", nullable=False)  # proposed|approved|rejected|conflicted
    source_id = Column(Integer, ForeignKey("source_documents.id"), nullable=True, index=True)
    extraction_method = Column(String(20), nullable=True)  # html|pdf|vision|inferred
    page_number = Column(Integer, nullable=True)
    validation_flags = Column(Text, nullable=True)  # JSON array of strings
    model_used = Column(String(255), nullable=True)
    reviewed_by = Column(String(255), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, nullable=True, onupdate=utc_now)

    __table_args__ = (
        UniqueConstraint("product_id", "key", "source_id", name="uq_product_attr_source"),
    )

    product = relationship("Product", back_populates="attributes")
    source = relationship("SourceDocument", back_populates="attributes")


class AttributeConflict(Base):
    __tablename__ = "attribute_conflicts"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    key = Column(String(255), nullable=False, index=True)
    candidates = Column(Text, nullable=False)  # JSON array [{value, source_id, confidence}]
    resolution = Column(String(20), default="unresolved", nullable=False)  # unresolved|auto|human
    resolved_value = Column(Text, nullable=True)
    resolved_by = Column(String(255), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    product = relationship("Product", back_populates="conflicts")


class EnrichmentJob(Base):
    __tablename__ = "enrichment_jobs"

    id = Column(Integer, primary_key=True, index=True)
    catalog_id = Column(Integer, ForeignKey("catalogs.id"), nullable=False, index=True)
    status = Column(String(50), default="pending", nullable=False)
    total = Column(Integer, default=0, nullable=False)
    processed = Column(Integer, default=0, nullable=False)
    succeeded = Column(Integer, default=0, nullable=False)
    skipped = Column(Integer, default=0, nullable=False)
    failed = Column(Integer, default=0, nullable=False)
    started_at = Column(DateTime, default=utc_now)
    finished_at = Column(DateTime, nullable=True)
    error = Column(Text, nullable=True)

    catalog = relationship("Catalog", back_populates="enrichment_jobs")


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
