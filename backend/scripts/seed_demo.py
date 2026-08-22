import argparse
import glob
import json
import logging
import os
import sys

# Ensure backend root is in pythonpath
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.db.database import Base, SessionLocal, engine
from app.db.models import (
    AttributeConflict,
    AttributeSchema,
    Catalog,
    CompanyKnowledge,
    EnrichmentJob,
    KnowledgeDocument,
    Product,
    ProductAttribute,
    SourceDocument,
)
from app.services.ingestion_service import ingest_products, parse_product_csv, register_document
from app.services.quality_service import compute_product_scores, score_catalog
from app.utils.time_utils import utc_now

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed_demo")


def run_seed(reset: bool = False):
    logger.info("Starting SpecForge Demo Seeding (reset=%s)...", reset)

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        if reset:
            logger.info("Resetting existing catalog records...")
            db.query(AttributeConflict).delete()
            db.query(ProductAttribute).delete()
            db.query(SourceDocument).delete()
            db.query(EnrichmentJob).delete()
            db.query(Product).delete()
            db.query(AttributeSchema).delete()
            db.query(Catalog).delete()
            db.commit()
            logger.info("Cleared existing records successfully.")

        # 1. Create or Find Catalog
        catalog_name = "Industrial Valves & Fittings"
        catalog = db.query(Catalog).filter(Catalog.name == catalog_name).first()
        if not catalog:
            catalog = Catalog(
                name=catalog_name,
                vertical="Plumbing & Flow Control",
                description="High-pressure industrial ball valves, digital pressure gauges, and forged stainless fittings with full document receipts.",
            )
            db.add(catalog)
            db.commit()
            db.refresh(catalog)
            logger.info("Created Catalog '%s' (ID: %d)", catalog.name, catalog.id)
        else:
            logger.info("Using existing Catalog '%s' (ID: %d)", catalog.name, catalog.id)

        # 2. Seed AttributeSchemas from JSON files
        schema_dir = os.path.join(backend_dir, "scripts", "schemas")
        schema_mapping = {
            "ball_valve.json": "Ball Valves",
            "pressure_gauge.json": "Pressure Gauges",
            "pipe_fitting.json": "Pipe Fittings",
        }

        for json_file, category_name in schema_mapping.items():
            path = os.path.join(schema_dir, json_file)
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    attrs_data = json.load(f)

                existing_s = db.query(AttributeSchema).filter(
                    AttributeSchema.catalog_id == catalog.id,
                    AttributeSchema.category_name.ilike(category_name)
                ).first()

                if existing_s:
                    existing_s.attributes = json.dumps(attrs_data)
                    existing_s.updated_at = utc_now()
                else:
                    new_s = AttributeSchema(
                        catalog_id=catalog.id,
                        category_name=category_name,
                        attributes=json.dumps(attrs_data),
                    )
                    db.add(new_s)
                logger.info("Seeded Schema for Category: '%s'", category_name)

        db.commit()

        # 3. Ingest CSV Products
        csv_path = os.path.join(backend_dir, "scripts", "demo_data", "products.csv")
        if os.path.exists(csv_path):
            with open(csv_path, "rb") as f:
                csv_bytes = f.read()

            parsed = parse_product_csv(csv_bytes, filename="products.csv")
            ingest_result = ingest_products(db, catalog.id, parsed["valid"])
            logger.info("Ingested Products -> Created: %d, Updated: %d, Rejected: %d",
                        ingest_result["created"], ingest_result["updated"], ingest_result["rejected"])

        products = db.query(Product).filter(Product.catalog_id == catalog.id).all()
        prod_map = {p.part_number: p for p in products}

        # 4. Register Demo Spec Sheet PDFs
        docs_dir = os.path.join(backend_dir, "scripts", "demo_data", "docs")
        pdf_files = glob.glob(os.path.join(docs_dir, "*.pdf"))

        for pdf_path in pdf_files:
            filename = os.path.basename(pdf_path)
            with open(pdf_path, "rb") as f:
                pdf_bytes = f.read()

            matched_prod = None
            for sku, prod in prod_map.items():
                if sku in filename:
                    matched_prod = prod
                    break

            if matched_prod:
                register_document(
                    db=db,
                    product_id=matched_prod.id,
                    filename=filename,
                    file_bytes=pdf_bytes,
                )
                logger.info("Registered Spec Doc '%s' to SKU '%s'", filename, matched_prod.part_number)

        # 5. Populate structured product attributes
        demo_attributes_fixture = {
            "MFC-70-104-01": [
                {"key": "body_material", "value_raw": "Cast Bronze ASTM B584", "value_norm": "bronze", "unit": None, "confidence": 95},
                {"key": "size_nominal", "value_raw": "1/2 in. (12.7 mm)", "value_norm": "12.7", "unit": "mm", "confidence": 98},
                {"key": "pressure_rating", "value_raw": "600 CWP", "value_norm": "600", "unit": "psi", "confidence": 95},
                {"key": "end_connection", "value_raw": "FNPT Threaded", "value_norm": "npt_female", "unit": None, "confidence": 95},
                {"key": "port_type", "value_raw": "Standard Port", "value_norm": "standard_port", "unit": None, "confidence": 92},
                {"key": "temp_range_min", "value_raw": "-20 deg F", "value_norm": "-28.8889", "unit": "C", "confidence": 90},
                {"key": "temp_range_max", "value_raw": "450 deg F", "value_norm": "232.2222", "unit": "C", "confidence": 90},
                {"key": "actuation_type", "value_raw": "Steel Lever Handle", "value_norm": "lever_handle", "unit": None, "confidence": 88},
            ],
            "MFC-70-105-01": [
                {"key": "body_material", "value_raw": "Cast Bronze", "value_norm": "bronze", "unit": None, "confidence": 95},
                {"key": "size_nominal", "value_raw": "3/4 in", "value_norm": "19.05", "unit": "mm", "confidence": 98},
                {"key": "pressure_rating", "value_raw": "600 PSI CWP", "value_norm": "600", "unit": "psi", "confidence": 95},
                {"key": "end_connection", "value_raw": "FNPT", "value_norm": "npt_female", "unit": None, "confidence": 95},
                {"key": "port_type", "value_raw": "Standard Port", "value_norm": "standard_port", "unit": None, "confidence": 92},
            ],
            "MFC-70-106-01": [
                {"key": "body_material", "value_raw": "Bronze", "value_norm": "bronze", "unit": None, "confidence": 95},
                {"key": "size_nominal", "value_raw": "1 in", "value_norm": "25.4", "unit": "mm", "confidence": 98},
                {"key": "pressure_rating", "value_raw": "600 CWP", "value_norm": "600", "unit": "psi", "confidence": 95},
                {"key": "end_connection", "value_raw": "NPT Female", "value_norm": "npt_female", "unit": None, "confidence": 95},
                {"key": "port_type", "value_raw": "Standard Port", "value_norm": "standard_port", "unit": None, "confidence": 90},
            ],
            "CVW-316-050-F": [
                {"key": "body_material", "value_raw": "316 Stainless Steel", "value_norm": "stainless_316", "unit": None, "confidence": 96},
                {"key": "size_nominal", "value_raw": "1/2 in.", "value_norm": "12.7", "unit": "mm", "confidence": 98},
                {"key": "pressure_rating", "value_raw": "1000 WOG", "value_norm": "1000", "unit": "psi", "confidence": 95},
                {"key": "end_connection", "value_raw": "NPT Female", "value_norm": "npt_female", "unit": None, "confidence": 95},
                {"key": "port_type", "value_raw": "Full Port", "value_norm": "full_port", "unit": None, "confidence": 95},
            ],
            "CVW-316-075-F": [
                {"key": "body_material", "value_raw": "316 Stainless Steel", "value_norm": "stainless_316", "unit": None, "confidence": 96},
                {"key": "size_nominal", "value_raw": "3/4 in.", "value_norm": "19.05", "unit": "mm", "confidence": 98},
                {"key": "pressure_rating", "value_raw": "1000 WOG", "value_norm": "1000", "unit": "psi", "confidence": 95},
                {"key": "end_connection", "value_raw": "NPT Female", "value_norm": "npt_female", "unit": None, "confidence": 95},
                {"key": "port_type", "value_raw": "Full Port", "value_norm": "full_port", "unit": None, "confidence": 95},
            ],
            "CVW-316-100-F": [
                {"key": "body_material", "value_raw": "316 Stainless Steel", "value_norm": "stainless_316", "unit": None, "confidence": 96},
                {"key": "size_nominal", "value_raw": "1 in.", "value_norm": "25.4", "unit": "mm", "confidence": 98},
                {"key": "pressure_rating", "value_raw": "1000 WOG", "value_norm": "1000", "unit": "psi", "confidence": 95},
                {"key": "end_connection", "value_raw": "NPT Female", "value_norm": "npt_female", "unit": None, "confidence": 95},
                {"key": "port_type", "value_raw": "Full Port", "value_norm": "full_port", "unit": None, "confidence": 95},
            ],
            "CVW-CS-200-FL": [
                {"key": "body_material", "value_raw": "Carbon Steel ASTM A216 WCB", "value_norm": "carbon_steel", "unit": None, "confidence": 95},
                {"key": "size_nominal", "value_raw": "2 in.", "value_norm": "50.8", "unit": "mm", "confidence": 98},
                {"key": "pressure_rating", "value_raw": "Class 150 (285 psi)", "value_norm": "285", "unit": "psi", "confidence": 92},
                {"key": "end_connection", "value_raw": "Flanged 150#", "value_norm": "flanged_150", "unit": None, "confidence": 95},
            ],
            "CVW-PVC-150-S": [
                {"key": "body_material", "value_raw": "Industrial Grade PVC", "value_norm": "pvc", "unit": None, "confidence": 95},
                {"key": "size_nominal", "value_raw": "1-1/2 in.", "value_norm": "38.1", "unit": "mm", "confidence": 98},
                {"key": "pressure_rating", "value_raw": "150 PSI @ 73F", "value_norm": "150", "unit": "psi", "confidence": 95},
                {"key": "end_connection", "value_raw": "Socket Weld", "value_norm": "socket_weld", "unit": None, "confidence": 92},
            ],
            "VLI-213-25-030": [
                {"key": "dial_size", "value_raw": "2.5 in", "value_norm": "63.5", "unit": "mm", "confidence": 95},
                {"key": "pressure_range_max", "value_raw": "30 psi", "value_norm": "30", "unit": "psi", "confidence": 95},
                {"key": "connection_size", "value_raw": "1/4 in NPT", "value_norm": "6.35", "unit": "mm", "confidence": 95},
                {"key": "connection_type", "value_raw": "1/4 in NPT Male", "value_norm": "npt_male", "unit": None, "confidence": 95},
                {"key": "case_material", "value_raw": "Brass", "value_norm": "brass", "unit": None, "confidence": 92},
                {"key": "liquid_filled", "value_raw": "false", "value_norm": "false", "unit": None, "confidence": 90},
            ],
            "VLI-232-25-100": [
                {"key": "dial_size", "value_raw": "2.5 in (63 mm)", "value_norm": "63.5", "unit": "mm", "confidence": 95},
                {"key": "pressure_range_max", "value_raw": "100 psi", "value_norm": "100", "unit": "psi", "confidence": 95},
                {"key": "connection_size", "value_raw": "1/4 in NPT", "value_norm": "6.35", "unit": "mm", "confidence": 95},
                {"key": "connection_type", "value_raw": "1/4 in NPT Male", "value_norm": "npt_male", "unit": None, "confidence": 95},
                {"key": "case_material", "value_raw": "304 Stainless Steel", "value_norm": "stainless_304", "unit": None, "confidence": 95},
                {"key": "liquid_filled", "value_raw": "Glycerin Fillable", "value_norm": "false", "unit": None, "confidence": 88},
            ],
            "VLI-232-25-160": [
                {"key": "dial_size", "value_raw": "2.5 in", "value_norm": "63.5", "unit": "mm", "confidence": 95},
                {"key": "pressure_range_max", "value_raw": "160 psi", "value_norm": "160", "unit": "psi", "confidence": 95},
                {"key": "connection_size", "value_raw": "1/4 in NPT", "value_norm": "6.35", "unit": "mm", "confidence": 95},
                {"key": "connection_type", "value_raw": "1/4 in NPT Male", "value_norm": "npt_male", "unit": None, "confidence": 95},
                {"key": "case_material", "value_raw": "304 Stainless Steel", "value_norm": "stainless_304", "unit": None, "confidence": 95},
            ],
            "VLI-232-40-300": [
                {"key": "dial_size", "value_raw": "4.0 in", "value_norm": "101.6", "unit": "mm", "confidence": 95},
                {"key": "pressure_range_max", "value_raw": "300 psi", "value_norm": "300", "unit": "psi", "confidence": 95},
                {"key": "connection_size", "value_raw": "1/2 in NPT", "value_norm": "12.7", "unit": "mm", "confidence": 95},
                {"key": "connection_type", "value_raw": "1/2 in NPT Male", "value_norm": "npt_male", "unit": None, "confidence": 95},
                {"key": "case_material", "value_raw": "316 Stainless Steel", "value_norm": "stainless_316", "unit": None, "confidence": 95},
                {"key": "liquid_filled", "value_raw": "Liquid Filled (Glycerin)", "value_norm": "true", "unit": None, "confidence": 95},
            ],
            "PPX-100-20-060": [
                {"key": "dial_size", "value_raw": "2.0 in", "value_norm": "50.8", "unit": "mm", "confidence": 95},
                {"key": "pressure_range_max", "value_raw": "60 psi", "value_norm": "60", "unit": "psi", "confidence": 95},
                {"key": "connection_size", "value_raw": "1/4 in NPT", "value_norm": "6.35", "unit": "mm", "confidence": 95},
                {"key": "connection_type", "value_raw": "1/4 in NPT Male", "value_norm": "npt_male", "unit": None, "confidence": 95},
            ],
            "PPX-100-25-200": [
                {"key": "dial_size", "value_raw": "2.5 in", "value_norm": "63.5", "unit": "mm", "confidence": 95},
                {"key": "pressure_range_max", "value_raw": "200 psi", "value_norm": "200", "unit": "psi", "confidence": 95},
                {"key": "connection_size", "value_raw": "1/4 in NPT", "value_norm": "6.35", "unit": "mm", "confidence": 95},
                {"key": "connection_type", "value_raw": "1/4 in NPT Male", "value_norm": "npt_male", "unit": None, "confidence": 95},
            ],
            "PPX-400-40-600": [
                {"key": "dial_size", "value_raw": "4.0 in", "value_norm": "101.6", "unit": "mm", "confidence": 95},
                {"key": "pressure_range_max", "value_raw": "600 psi", "value_norm": "600", "unit": "psi", "confidence": 95},
                {"key": "connection_size", "value_raw": "1/2 in NPT", "value_norm": "12.7", "unit": "mm", "confidence": 95},
                {"key": "connection_type", "value_raw": "1/2 in NPT Male", "value_norm": "npt_male", "unit": None, "confidence": 95},
            ],
            "PPX-VAC-25-030": [
                {"key": "dial_size", "value_raw": "2.5 in", "value_norm": "63.5", "unit": "mm", "confidence": 95},
                {"key": "pressure_range_max", "value_raw": "30 psi", "value_norm": "30", "unit": "psi", "confidence": 90},
                {"key": "connection_size", "value_raw": "1/4 in NPT", "value_norm": "6.35", "unit": "mm", "confidence": 95},
                {"key": "connection_type", "value_raw": "1/4 in NPT Male", "value_norm": "npt_male", "unit": None, "confidence": 95},
            ],
            "IFC-150-EL45-100": [
                {"key": "fitting_type", "value_raw": "Street Elbow 45 Degree", "value_norm": "street_elbow", "unit": None, "confidence": 95},
                {"key": "material", "value_raw": "316 Stainless Steel", "value_norm": "stainless_316", "unit": None, "confidence": 95},
                {"key": "thread_size", "value_raw": "1 in. NPT", "value_norm": "25.4", "unit": "mm", "confidence": 95},
                {"key": "pressure_class", "value_raw": "150# (300 psi)", "value_norm": "300", "unit": "psi", "confidence": 92},
                {"key": "end_connection", "value_raw": "Male x Female NPT", "value_norm": "npt_male", "unit": None, "confidence": 95},
            ],
            "IFC-150-EL90-050": [
                {"key": "fitting_type", "value_raw": "90 Degree Pipe Elbow", "value_norm": "street_elbow", "unit": None, "confidence": 95},
                {"key": "material", "value_raw": "316 Stainless Steel", "value_norm": "stainless_316", "unit": None, "confidence": 95},
                {"key": "thread_size", "value_raw": "1/2 in. NPT", "value_norm": "12.7", "unit": "mm", "confidence": 95},
                {"key": "pressure_class", "value_raw": "150# (300 psi)", "value_norm": "300", "unit": "psi", "confidence": 92},
                {"key": "end_connection", "value_raw": "Female NPT", "value_norm": "npt_female", "unit": None, "confidence": 95},
            ],
            "IFC-150-EL90-075": [
                {"key": "fitting_type", "value_raw": "90 Degree Pipe Elbow", "value_norm": "street_elbow", "unit": None, "confidence": 95},
                {"key": "material", "value_raw": "316 Stainless Steel", "value_norm": "stainless_316", "unit": None, "confidence": 95},
                {"key": "thread_size", "value_raw": "3/4 in. NPT", "value_norm": "19.05", "unit": "mm", "confidence": 95},
                {"key": "pressure_class", "value_raw": "150# (300 psi)", "value_norm": "300", "unit": "psi", "confidence": 92},
                {"key": "end_connection", "value_raw": "Female NPT", "value_norm": "npt_female", "unit": None, "confidence": 95},
            ],
            "IFC-150-TEE-050": [
                {"key": "fitting_type", "value_raw": "Equal Pipe Tee", "value_norm": "tee", "unit": None, "confidence": 95},
                {"key": "material", "value_raw": "316 Stainless Steel", "value_norm": "stainless_316", "unit": None, "confidence": 95},
                {"key": "thread_size", "value_raw": "1/2 in. NPT", "value_norm": "12.7", "unit": "mm", "confidence": 95},
                {"key": "pressure_class", "value_raw": "150# (300 psi)", "value_norm": "300", "unit": "psi", "confidence": 92},
                {"key": "end_connection", "value_raw": "Female NPT All Ports", "value_norm": "npt_female", "unit": None, "confidence": 95},
            ],
            "IFC-300-TEE-075": [
                {"key": "fitting_type", "value_raw": "Forged Class 3000 Tee", "value_norm": "tee", "unit": None, "confidence": 95},
                {"key": "material", "value_raw": "Carbon Steel ASTM A105", "value_norm": "carbon_steel", "unit": None, "confidence": 95},
                {"key": "thread_size", "value_raw": "3/4 in. NPT", "value_norm": "19.05", "unit": "mm", "confidence": 95},
                {"key": "pressure_class", "value_raw": "3000 psig", "value_norm": "3000", "unit": "psi", "confidence": 95},
                {"key": "end_connection", "value_raw": "Female NPT", "value_norm": "npt_female", "unit": None, "confidence": 95},
            ],
            "IFC-SS-CPL-050": [
                {"key": "fitting_type", "value_raw": "Full Hex Coupling", "value_norm": "coupling", "unit": None, "confidence": 95},
                {"key": "material", "value_raw": "316 Stainless Steel", "value_norm": "stainless_316", "unit": None, "confidence": 95},
                {"key": "thread_size", "value_raw": "1/2 in. NPT", "value_norm": "12.7", "unit": "mm", "confidence": 95},
                {"key": "pressure_class", "value_raw": "3000 psig", "value_norm": "3000", "unit": "psi", "confidence": 95},
                {"key": "end_connection", "value_raw": "Female NPT", "value_norm": "npt_female", "unit": None, "confidence": 95},
            ],
            "IFC-SS-UN-100": [
                {"key": "fitting_type", "value_raw": "Ground Joint Union", "value_norm": "union", "unit": None, "confidence": 95},
                {"key": "material", "value_raw": "316 Stainless Steel", "value_norm": "stainless_316", "unit": None, "confidence": 95},
                {"key": "thread_size", "value_raw": "1 in. NPT", "value_norm": "25.4", "unit": "mm", "confidence": 95},
                {"key": "pressure_class", "value_raw": "3000 psig", "value_norm": "3000", "unit": "psi", "confidence": 95},
                {"key": "end_connection", "value_raw": "Female NPT", "value_norm": "npt_female", "unit": None, "confidence": 95},
            ],
            "70-104-01": [
                {"key": "body_material", "value_raw": "Cast Bronze ASTM B584", "value_norm": "bronze", "unit": None, "confidence": 95},
                {"key": "size_nominal", "value_raw": "1/2 in. (12.7 mm)", "value_norm": "12.7", "unit": "mm", "confidence": 98},
                {"key": "pressure_rating", "value_raw": "600 CWP", "value_norm": "600", "unit": "psi", "confidence": 95},
                {"key": "end_connection", "value_raw": "FNPT Threaded", "value_norm": "npt_female", "unit": None, "confidence": 95},
                {"key": "port_type", "value_raw": "Standard Port", "value_norm": "standard_port", "unit": None, "confidence": 92},
            ],
            "77-104-01": [
                {"key": "body_material", "value_raw": "Cast Bronze", "value_norm": "bronze", "unit": None, "confidence": 95},
                {"key": "size_nominal", "value_raw": "1/2 in", "value_norm": "12.7", "unit": "mm", "confidence": 98},
                {"key": "pressure_rating", "value_raw": "600 PSI CWP", "value_norm": "600", "unit": "psi", "confidence": 95},
                {"key": "end_connection", "value_raw": "Female NPT", "value_norm": "npt_female", "unit": None, "confidence": 95},
                {"key": "port_type", "value_raw": "Full Port", "value_norm": "full_port", "unit": None, "confidence": 95},
            ],
            "T-585-70": [
                {"key": "body_material", "value_raw": "Cast Bronze Alloy C84400", "value_norm": "bronze", "unit": None, "confidence": 95},
                {"key": "size_nominal", "value_raw": "1/2 inch", "value_norm": "12.7", "unit": "mm", "confidence": 98},
                {"key": "pressure_rating", "value_raw": "600 PSI CWP", "value_norm": "600", "unit": "psi", "confidence": 95},
                {"key": "end_connection", "value_raw": "NPT Female Threaded", "value_norm": "npt_female", "unit": None, "confidence": 95},
                {"key": "port_type", "value_raw": "Full Port Two-Piece", "value_norm": "full_port", "unit": None, "confidence": 90},
            ],
            "232.53-2.5-100": [
                {"key": "dial_size", "value_raw": "2.5 in (63 mm)", "value_norm": "63.5", "unit": "mm", "confidence": 95},
                {"key": "pressure_range_max", "value_raw": "100 psi", "value_norm": "100", "unit": "psi", "confidence": 95},
                {"key": "connection_size", "value_raw": "1/4 in NPT", "value_norm": "6.35", "unit": "mm", "confidence": 95},
                {"key": "connection_type", "value_raw": "1/4 in NPT Male", "value_norm": "npt_male", "unit": None, "confidence": 95},
                {"key": "case_material", "value_raw": "304 Stainless Steel", "value_norm": "stainless_304", "unit": None, "confidence": 92},
            ],
            "SS-4-HN": [
                {"key": "fitting_type", "value_raw": "Hex Nipple", "value_norm": "hex_nipple", "unit": None, "confidence": 98},
                {"key": "material", "value_raw": "316 Stainless Steel ASTM A276", "value_norm": "stainless_316", "unit": None, "confidence": 98},
                {"key": "thread_size", "value_raw": "1/4 in. Male NPT", "value_norm": "6.35", "unit": "mm", "confidence": 95},
                {"key": "pressure_class", "value_raw": "10000 psig", "value_norm": "10000", "unit": "psi", "confidence": 95},
                {"key": "end_connection", "value_raw": "Male NPT", "value_norm": "npt_male", "unit": None, "confidence": 95},
            ],
        }

        logger.info("Populating structured specifications for %d products...", len(products))
        doc_map = {doc.product_id: doc for doc in db.query(SourceDocument).all()}

        for p in products:
            sku_attrs = demo_attributes_fixture.get(p.part_number, [
                {"key": "body_material", "value_raw": "Forged Steel", "value_norm": "carbon_steel", "unit": None, "confidence": 90},
                {"key": "size_nominal", "value_raw": "1/2 in.", "value_norm": "12.7", "unit": "mm", "confidence": 92},
                {"key": "pressure_rating", "value_raw": "600 PSI", "value_norm": "600", "unit": "psi", "confidence": 90},
                {"key": "end_connection", "value_raw": "Socket Weld", "value_norm": "socket_weld", "unit": None, "confidence": 88},
            ])

            doc_match = doc_map.get(p.id)
            for a_data in sku_attrs:
                new_attr = ProductAttribute(
                    product_id=p.id,
                    key=a_data["key"],
                    value_raw=a_data["value_raw"],
                    value_norm=a_data["value_norm"],
                    unit=a_data["unit"],
                    confidence=a_data["confidence"],
                    status="approved" if a_data["confidence"] >= 85 else "proposed",
                    source_id=doc_match.id if doc_match else None,
                    extraction_method="pdf" if doc_match else "html",
                    page_number=1,
                    model_used="gemini-flash-latest",
                )
                db.add(new_attr)

            p.status = "needs_review"
            p.enriched_at = utc_now()
            p.model_used = settings.GEMINI_MODEL

        db.commit()

        # 6. Curate Demo State: Approve confidence >= 85, set exactly 2 unresolved conflicts, and review-queue items
        all_attrs = db.query(ProductAttribute).all()
        for a in all_attrs:
            if (a.confidence or 0) >= 85 and not a.validation_flags:
                a.status = "approved"
                a.reviewed_by = "auto_approver"
                a.reviewed_at = utc_now()
            else:
                a.status = "proposed"

        db.commit()

        # Seed exactly 2 conflicts for demo resolution
        p_conflict_1 = prod_map.get("MFC-70-104-01") or prod_map.get("70-104-01") or products[0]
        p_conflict_2 = prod_map.get("VLI-232-25-100") or prod_map.get("232.53-2.5-100") or products[1]

        # Conflict 1: body_material on MFC-70-104-01
        c1 = db.query(AttributeConflict).filter(AttributeConflict.product_id == p_conflict_1.id, AttributeConflict.key == "body_material").first()
        if not c1:
            c1 = AttributeConflict(
                product_id=p_conflict_1.id,
                key="body_material",
                resolution="unresolved",
                candidates=json.dumps([
                    {"value_raw": "Cast Bronze ASTM B584", "value_norm": "bronze", "confidence": 90, "source_id": 1},
                    {"value_raw": "Brass Alloy C36000", "value_norm": "brass", "confidence": 85, "source_id": 2},
                ]),
            )
            db.add(c1)

        # Conflict 2: pressure_range_max on VLI-232-25-100
        c2 = db.query(AttributeConflict).filter(AttributeConflict.product_id == p_conflict_2.id, AttributeConflict.key == "pressure_range_max").first()
        if not c2:
            c2 = AttributeConflict(
                product_id=p_conflict_2.id,
                key="pressure_range_max",
                resolution="unresolved",
                candidates=json.dumps([
                    {"value_raw": "100 PSI", "value_norm": "100", "unit": "psi", "confidence": 92, "source_id": 1},
                    {"value_raw": "150 PSI", "value_norm": "150", "unit": "psi", "confidence": 88, "source_id": 2},
                ]),
            )
            db.add(c2)

        db.commit()

        # Ensure review queue has items for demo
        review_attrs = db.query(ProductAttribute).filter(ProductAttribute.status.in_(["proposed", "conflicted"])).all()
        if len(review_attrs) < 5:
            candidates_to_demote = db.query(ProductAttribute).filter(ProductAttribute.status == "approved").limit(5).all()
            for idx, attr_to_demote in enumerate(candidates_to_demote):
                attr_to_demote.status = "proposed"
                attr_to_demote.confidence = 68 + (idx * 2)
                attr_to_demote.validation_flags = json.dumps(["low_confidence"])
            db.commit()

        # Re-score all products & catalog
        for p in products:
            compute_product_scores(db, p.id)

        catalog_summary = score_catalog(db, catalog.id)

        logger.info("\n========================================================")
        logger.info("🎉 DEMO SEEDING COMPLETED SUCCESSFULLY!")
        logger.info("Catalog: %s (ID: %d)", catalog.name, catalog.id)
        logger.info("Total Products: %d", catalog_summary["total_products"])
        logger.info("Products by Grade: %s", catalog_summary["products_by_grade"])
        logger.info("Mean Completeness: %s%% | Mean Confidence: %s%%", catalog_summary["mean_completeness"], catalog_summary["mean_confidence"])
        logger.info("Total Attributes: %d | Open Conflicts: %d", catalog_summary["total_attributes"], catalog_summary["open_conflicts"])
        logger.info("Review Queue Backlog: %d items", catalog_summary["review_backlog"])
        logger.info("========================================================\n")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed SpecForge Demo Data")
    parser.add_argument("--reset", action="store_true", help="Reset database tables before seeding")
    args = parser.parse_args()
    run_seed(reset=args.reset)
