from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import os

from app.services.risk_forecasting import run_risk_forecast


router = APIRouter(prefix="/api/risk", tags=["Risk Forecasting"])
API_KEY = os.getenv("AI_API_KEY", "")


class RiskForecastRequest(BaseModel):
    pharmacyIds: list[str] = Field(default_factory=list)
    sales: Optional[list[dict]] = None
    top: int = Field(default=20, ge=1, le=100)


def _verify_key(x_api_key: Optional[str]):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@router.post("/forecast")
async def forecast_risk(
    request: RiskForecastRequest,
    x_api_key: Optional[str] = Header(None),
):
    _verify_key(x_api_key)

    try:
        return run_risk_forecast(
            pharmacy_ids=request.pharmacyIds,
            top=request.top,
            sales=request.sales,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}")


@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "risk-forecasting",
        "endpoint": "POST /api/risk/forecast",
    }
