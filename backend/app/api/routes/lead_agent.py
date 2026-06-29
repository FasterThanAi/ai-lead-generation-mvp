import logging
import os
from typing import Any

import requests
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Campaign, DiscoveredLead, DiscoveryJob, Lead

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/lead-agent",
    tags=["Lead Agent"],
)


class LeadAgentStartRequest(BaseModel):
    campaign_id: int
    target_leads: int = Field(default=100, ge=1, le=500)
    max_results: int | None = Field(default=None, ge=1, le=500)
    queries_per_day: int = Field(default=1, ge=1, le=3)
    sectors: list[str] | None = None
    cities: list[str] | None = None
    notes: str | None = None


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _split_terms(value: str) -> list[str]:
    separators = [",", "/", "|", "\n", ";"]
    text = _clean_text(value)

    for separator in separators:
        text = text.replace(separator, ",")

    terms = []
    seen = set()

    for part in text.split(","):
        term = part.strip()
        key = term.lower()

        if not term or key in seen:
            continue

        seen.add(key)
        terms.append(term)

    return terms


def _generate_sectors(campaign: Campaign) -> list[str]:
    combined_text = " ".join([
        _clean_text(campaign.industry),
        _clean_text(campaign.target_role),
        _clean_text(campaign.offer),
    ]).lower()

    sectors = _split_terms(campaign.industry)

    keyword_sectors = [
        ("mechanical", ["Mechanical Engineering", "Manufacturing", "Product Design", "Industrial Automation"]),
        ("manufacturing", ["Manufacturing", "Industrial Automation", "Fabrication"]),
        ("robot", ["Robotics", "Industrial Automation", "Hardware Startups"]),
        ("ev", ["Electric Vehicles", "Battery Tech", "Automotive"]),
        ("electric vehicle", ["Electric Vehicles", "Battery Tech", "Automotive"]),
        ("aerospace", ["Aerospace", "Drones", "Defence Tech"]),
        ("drone", ["Drones", "Aerospace", "Robotics"]),
        ("startup", ["Startups", "Hardware Startups"]),
        ("hardware", ["Hardware Startups", "IoT", "Product Design"]),
        ("cad", ["CAD/CAM", "Mechanical Design", "Product Design"]),
    ]

    for keyword, matched_sectors in keyword_sectors:
        if keyword in combined_text:
            sectors.extend(matched_sectors)

    if not sectors:
        sectors = ["Startups", "SMEs", "Technology Companies"]

    deduped = []
    seen = set()

    for sector in sectors:
        key = sector.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(sector)

    return deduped[:10]


def _generate_cities(campaign: Campaign) -> list[str]:
    location = _clean_text(campaign.location)
    cities = _split_terms(location)
    location_lower = location.lower()

    region_city_map = {
        "hyderabad": ["Hyderabad", "Secunderabad", "Ranga Reddy"],
        "telangana": ["Hyderabad", "Secunderabad", "Warangal", "Ranga Reddy"],
        "bangalore": ["Bengaluru", "Bangalore"],
        "bengaluru": ["Bengaluru", "Bangalore"],
        "mumbai": ["Mumbai", "Navi Mumbai", "Thane"],
        "delhi": ["Delhi", "Noida", "Gurugram", "Faridabad"],
        "ncr": ["Delhi", "Noida", "Gurugram", "Faridabad"],
        "pune": ["Pune", "Pimpri-Chinchwad"],
        "chennai": ["Chennai"],
        "india": ["Hyderabad", "Bengaluru", "Pune", "Chennai", "Mumbai", "Delhi NCR"],
    }

    for keyword, mapped_cities in region_city_map.items():
        if keyword in location_lower:
            cities.extend(mapped_cities)

    if not cities:
        cities = ["India"]

    deduped = []
    seen = set()

    for city in cities:
        key = city.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(city)

    return deduped[:10]


def _generate_search_queries(campaign: Campaign, sectors: list[str], cities: list[str], queries_per_day: int) -> list[str]:
    role = _clean_text(campaign.target_role) or "Founder OR CTO OR Operations"
    generated_queries = []

    for city in cities:
        for sector in sectors:
            generated_queries.extend([
                f'"{city}" "{sector}" "startup" "contact"',
                f'"{city}" "{sector}" "{role}" "email"',
                f'site:.in "{city}" "{sector}" "contact"',
            ])

    deduped = []
    seen = set()

    for query in generated_queries:
        key = query.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(query)

    return deduped[: max(1, queries_per_day) * 5]


def _trigger_n8n(payload: dict):
    webhook_url = os.getenv("N8N_WEBHOOK_URL", "").strip()

    if not webhook_url:
        logger.warning("N8N_WEBHOOK_URL is not configured. Lead Agent trigger skipped.")
        return

    try:
        response = requests.post(webhook_url, json=payload, timeout=20)
        response.raise_for_status()
        logger.info(
            "Lead Agent n8n workflow triggered for campaign %s.",
            payload.get("campaign_id"),
        )
    except requests.RequestException as exc:
        logger.exception(
            "Lead Agent n8n workflow failed for campaign %s: %s",
            payload.get("campaign_id"),
            exc,
        )


@router.post("/start")
def start_lead_agent(
    payload: LeadAgentStartRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    webhook_url = os.getenv("N8N_WEBHOOK_URL", "").strip()

    if not webhook_url:
        raise HTTPException(
            status_code=500,
            detail="N8N_WEBHOOK_URL is not configured in the backend environment.",
        )

    campaign = db.get(Campaign, payload.campaign_id)

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")

    sectors = payload.sectors or _generate_sectors(campaign)
    cities = payload.cities or _generate_cities(campaign)
    max_results = payload.max_results or payload.target_leads
    search_queries = _generate_search_queries(campaign, sectors, cities, payload.queries_per_day)

    n8n_payload = {
        "campaign_id": campaign.id,
        "campaign_name": campaign.campaign_name,
        "industry": campaign.industry,
        "location": campaign.location,
        "target_role": campaign.target_role,
        "offer": campaign.offer,
        "target_leads": max_results,
        "max_results": max_results,
        "queries_per_day": payload.queries_per_day,
        "sectors": sectors,
        "cities": cities,
        "search_queries": search_queries,
        "notes": payload.notes,
    }

    background_tasks.add_task(_trigger_n8n, n8n_payload)

    return {
        "status": "started",
        "message": "Lead Agent started. n8n will continue the workflow in the background.",
        "campaign_id": campaign.id,
        "target_leads": max_results,
        "max_results": max_results,
        "queries_per_day": payload.queries_per_day,
        "sectors": sectors,
        "cities": cities,
        "search_queries": search_queries,
    }


@router.get("/status/{campaign_id}")
def get_lead_agent_status(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.get(Campaign, campaign_id)

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")

    total_leads = db.query(func.count(Lead.id)).filter(Lead.campaign_id == campaign_id).scalar() or 0
    leads_with_email = (
        db.query(func.count(Lead.id))
        .filter(
            Lead.campaign_id == campaign_id,
            Lead.email.is_not(None),
            Lead.email != "",
        )
        .scalar()
        or 0
    )
    leads_missing_email = max(total_leads - leads_with_email, 0)
    discovery_jobs = db.query(func.count(DiscoveryJob.id)).filter(DiscoveryJob.campaign_id == campaign_id).scalar() or 0
    discovered_contacts = (
        db.query(func.count(DiscoveredLead.id))
        .filter(DiscoveredLead.campaign_id == campaign_id)
        .scalar()
        or 0
    )
    imported_contacts = (
        db.query(func.count(DiscoveredLead.id))
        .filter(
            DiscoveredLead.campaign_id == campaign_id,
            DiscoveredLead.imported_lead_id.is_not(None),
        )
        .scalar()
        or 0
    )
    latest_job = (
        db.query(DiscoveryJob)
        .filter(DiscoveryJob.campaign_id == campaign_id)
        .order_by(DiscoveryJob.created_at.desc(), DiscoveryJob.id.desc())
        .first()
    )

    return {
        "campaign_id": campaign_id,
        "campaign_name": campaign.campaign_name,
        "n8n_configured": bool(os.getenv("N8N_WEBHOOK_URL", "").strip()),
        "total_leads": total_leads,
        "leads_with_email": leads_with_email,
        "leads_missing_email": leads_missing_email,
        "email_coverage_percent": round((leads_with_email / total_leads * 100) if total_leads else 0),
        "discovery_jobs": discovery_jobs,
        "discovered_contacts": discovered_contacts,
        "imported_contacts": imported_contacts,
        "latest_discovery_job": {
            "id": latest_job.id,
            "title": latest_job.title,
            "status": latest_job.status,
            "pages_attempted": latest_job.pages_attempted,
            "contacts_found": latest_job.contacts_found,
            "created_at": latest_job.created_at,
            "updated_at": latest_job.updated_at,
        } if latest_job else None,
    }
