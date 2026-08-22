from fastapi import APIRouter, HTTPException

router = APIRouter(
    prefix="/ai",
    tags=["AI"]
)


@router.post("/generate-email/{lead_id}")
def generate_email_for_lead(lead_id: int):
    raise HTTPException(
        status_code=501,
        detail="Outbound email generation is deprecated. Use SpecForge product intelligence pipeline."
    )


@router.post("/generate-emails/campaign/{campaign_id}")
def generate_emails_for_campaign(campaign_id: int):
    raise HTTPException(
        status_code=501,
        detail="Outbound email generation is deprecated. Use SpecForge product intelligence pipeline."
    )
