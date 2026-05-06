from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import os

from app.services.scoring_engine import score_antibiotic_candidates


router = APIRouter(prefix="/api/scoring", tags=["Antibiotic Scoring"])
API_KEY = os.getenv("AI_API_KEY", "")


class ScoringRequest(BaseModel):
    category: str = Field(default="ANTIBIOTIC", pattern="^(ANTIBIOTIC|antibiotic)$")
    maxSales: Optional[int] = Field(default=None, ge=1, le=10000)
    pharmacyIds: list[str] = Field(default_factory=list)


def _verify_key(x_api_key: Optional[str]):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@router.post("/candidates")
async def score_candidates(
    request: ScoringRequest,
    x_api_key: Optional[str] = Header(None),
):
    _verify_key(x_api_key)

    try:
        return score_antibiotic_candidates(
            max_sales=request.maxSales,
            pharmacy_ids=request.pharmacyIds,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}")


@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "antibiotic-scoring",
        "endpoint": "POST /api/scoring/candidates",
    }
