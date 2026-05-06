from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field
from typing import Optional
import os

from app.services.antibiotic_analyzer import detect_anomalies, score_sales_rows


router = APIRouter(prefix="/api/antibiotic", tags=["Antibiotic Analysis"])
API_KEY = os.getenv("AI_API_KEY", "")


class AntibioticAnalyzeRequest(BaseModel):
    sales: list[dict] = Field(default_factory=list)
    role: str = "pharmacy"


def _verify_key(x_api_key: Optional[str]):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@router.post("/analyze")
async def analyze_antibiotic_candidates(
    request: AntibioticAnalyzeRequest,
    x_api_key: Optional[str] = Header(None),
):
    _verify_key(x_api_key)

    try:
        scored_rows = score_sales_rows(request.sales, role=request.role)
        anomalies = [row for row in scored_rows if row.get("classification") != "NORMAL"]

        return {
            "success": True,
            "role_used": request.role,
            "input_records": len(request.sales),
            "total_anomalies": len(anomalies),
            "scored_rows": scored_rows,
            "anomalies": anomalies,
        }
    except Exception as exc:
        import traceback
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}\n{traceback.format_exc()}")


@router.get("/analyze/health")
async def health_check():
    return {
        "status": "ok",
        "service": "antibiotic-analysis",
        "endpoint": "POST /api/antibiotic/analyze",
    }