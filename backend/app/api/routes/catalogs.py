import logging
from datetime import timedelta
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import SessionLocal, get_db
from app.db.models import Catalog, EnrichmentJob, Product
from app.schemas.catalog_schema import CatalogCreate, CatalogResponse
from app.services.extraction_service import enrich_product
from app.utils.time_utils import utc_now

router = APIRouter(
    prefix="/catalogs",
    tags=["Catalogs"]
)

logger = logging.getLogger(__name__)


def _run_enrichment_job(job_id: int, catalog_id: int, limit: int = 50):
    db = SessionLocal()
    job = None
    try:
        job = db.get(EnrichmentJob, job_id)
        if not job:
            logger.warning("Enrichment job %s disappeared before it could start.", job_id)
            return

        job.status = "running"
        job.started_at = utc_now()
        db.commit()

        products = (
            db.query(Product)
            .filter(Product.catalog_id == catalog_id)
            .order_by(Product.created_at.asc(), Product.id.asc())
            .limit(limit)
            .all()
        )

        job.total = len(products)
        db.commit()

        if not products:
            job.status = "completed"
            job.finished_at = utc_now()
            db.commit()
            return

        for product in products:
            try:
                result = enrich_product(db, product.id)
                if result.get("status") == "success":
                    job.succeeded = (job.succeeded or 0) + 1
                else:
                    job.failed = (job.failed or 0) + 1
                    if not job.error:
                        job.error = result.get("error")
            except Exception as exc:
                logger.exception("Enrichment failed for product %s in job %s", product.id, job_id)
                job.failed = (job.failed or 0) + 1
                if not job.error:
                    job.error = str(exc)
            finally:
                job.processed = (job.processed or 0) + 1
                db.commit()

        job.status = "completed"
        job.finished_at = utc_now()
        db.commit()

    except Exception as exc:
        logger.exception("Enrichment job %s failed completely", job_id)
        db.rollback()
        if job:
            job.status = "failed"
            job.error = str(exc)
            job.finished_at = utc_now()
            db.commit()
    finally:
        db.close()


@router.post("/", response_model=CatalogResponse)
@router.post("/create", response_model=CatalogResponse)
def create_catalog(catalog_in: CatalogCreate, db: Session = Depends(get_db)):
    new_catalog = Catalog(
        name=catalog_in.name,
        vertical=catalog_in.vertical,
        description=catalog_in.description,
    )
    db.add(new_catalog)
    db.commit()
    db.refresh(new_catalog)
    return new_catalog


@router.get("/")
def get_catalogs(db: Session = Depends(get_db)):
    catalogs = db.query(Catalog).order_by(Catalog.created_at.desc(), Catalog.id.desc()).all()
    return {
        "status": "success",
        "data": catalogs
    }


@router.get("/enrichment-job/{job_id}")
def get_enrichment_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(EnrichmentJob).filter(EnrichmentJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Enrichment job with id {job_id} was not found")

    return {
        "status": "success",
        "data": {
            "id": job.id,
            "catalog_id": job.catalog_id,
            "status": job.status,
            "total": job.total,
            "processed": job.processed,
            "succeeded": job.succeeded,
            "skipped": job.skipped,
            "failed": job.failed,
            "started_at": job.started_at,
            "finished_at": job.finished_at,
            "error": job.error,
        }
    }


@router.post("/{catalog_id}/enrich-async")
def enrich_catalog_async(
    catalog_id: int,
    background_tasks: BackgroundTasks,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    catalog = db.query(Catalog).filter(Catalog.id == catalog_id).first()
    if not catalog:
        raise HTTPException(status_code=404, detail=f"Catalog with id {catalog_id} was not found")

    job = EnrichmentJob(
        catalog_id=catalog_id,
        status="pending",
        total=0,
        processed=0,
        succeeded=0,
        skipped=0,
        failed=0,
        started_at=utc_now(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_run_enrichment_job, job.id, catalog_id, limit)

    return {
        "status": "success",
        "message": "Catalog enrichment job started in background.",
        "job_id": job.id,
        "poll_url": f"/api/catalogs/enrichment-job/{job.id}",
    }


@router.get("/{catalog_id}")
def get_catalog(catalog_id: int, db: Session = Depends(get_db)):
    catalog = db.query(Catalog).filter(Catalog.id == catalog_id).first()
    if not catalog:
        raise HTTPException(status_code=404, detail=f"Catalog with id {catalog_id} was not found")
    return {
        "status": "success",
        "data": catalog
    }


@router.delete("/{catalog_id}")
def delete_catalog(catalog_id: int, db: Session = Depends(get_db)):
    catalog = db.query(Catalog).filter(Catalog.id == catalog_id).first()
    if not catalog:
        raise HTTPException(status_code=404, detail=f"Catalog with id {catalog_id} was not found")
    db.delete(catalog)
    db.commit()
    return {
        "status": "success",
        "message": f"Catalog {catalog_id} deleted successfully"
    }


@router.get("/{catalog_id}/summary")
def get_catalog_summary(catalog_id: int, db: Session = Depends(get_db)):
    catalog = db.query(Catalog).filter(Catalog.id == catalog_id).first()
    if not catalog:
        raise HTTPException(status_code=404, detail=f"Catalog with id {catalog_id} was not found")

    total_products = db.query(func.count(Product.id)).filter(Product.catalog_id == catalog_id).scalar() or 0
    approved_products = db.query(func.count(Product.id)).filter(
        Product.catalog_id == catalog_id,
        Product.status == "approved"
    ).scalar() or 0
    needs_review = db.query(func.count(Product.id)).filter(
        Product.catalog_id == catalog_id,
        Product.status == "needs_review"
    ).scalar() or 0
    mean_completeness = db.query(func.avg(Product.completeness_score)).filter(
        Product.catalog_id == catalog_id,
        Product.completeness_score.isnot(None)
    ).scalar() or 0
    mean_confidence = db.query(func.avg(Product.confidence_score)).filter(
        Product.catalog_id == catalog_id,
        Product.confidence_score.isnot(None)
    ).scalar() or 0

    return {
        "status": "success",
        "data": {
            "catalog_id": catalog.id,
            "name": catalog.name,
            "vertical": catalog.vertical,
            "total_products": total_products,
            "approved_products": approved_products,
            "needs_review": needs_review,
            "mean_completeness": round(float(mean_completeness), 1),
            "mean_confidence": round(float(mean_confidence), 1),
        }
    }
