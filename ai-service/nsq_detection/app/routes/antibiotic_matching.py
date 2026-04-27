from fastapi import APIRouter, Header, HTTPException
from typing import Optional
import os

from app.models import (
    AIAntibioticMatchRequest,
    AIAntibioticMatchResponse,
    AIAntibioticMatchResult,
    AIMatchFeatures,
)
from app.services.csv_export import build_csv_rows
from app.services.matcher_core import classify, compute_component_scores


router = APIRouter(prefix="/api/antibiotic", tags=["Antibiotic Matching"])
API_KEY = os.getenv("AI_API_KEY", "")


def _verify_key(x_api_key: Optional[str]):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def _best_antibiotic_match(drug_name: str, candidates: list):
    best_score = -1.0
    best_candidate = None
    best_components = None

    for candidate in candidates:
        components = compute_component_scores(drug_name, candidate.drugName)
        if components["score"] > best_score:
            best_score = components["score"]
            best_candidate = candidate
            best_components = components

    return best_candidate, best_components


@router.post("/match-sales", response_model=AIAntibioticMatchResponse)
async def match_antibiotic_sales(
    request: AIAntibioticMatchRequest,
    x_api_key: Optional[str] = Header(None),
):
    _verify_key(x_api_key)

    try:
        results: list[AIAntibioticMatchResult] = []

        for row in request.salesRows:
            best_candidate, components = _best_antibiotic_match(
                row.drugName,
                request.antibioticRecords,
            )

            if best_candidate is None or components is None:
                continue

            classification, confidence = classify(
                components["score"],
                request.threshold,
                request.confirmThreshold,
            )

            if classification == "Mismatch":
                continue

            result = AIAntibioticMatchResult(
                pharmacyId=request.pharmacyId,
                sessionId=request.sessionId,
                sourceRecordId=row.sourceRecordId,
                saleMonth=row.saleMonth,
                saleYear=row.saleYear,
                inputDrugName=row.drugName,
                normalizedInputDrugName=components["normalized_source"],
                matchedRecordId=best_candidate.recordId,
                matchedDrugName=best_candidate.drugName,
                normalizedMatchedDrugName=components["normalized_target"],
                similarityScore=round(components["score"], 2),
                matchLabel=classification.upper().replace(" ", "_"),
                confidence=confidence,
                batchNumber=row.batchNumber,
                manufacturerInput=row.manufacturer,
                manufacturerMatched=best_candidate.manufacturer,
                quantity=row.quantity,
                unitPrice=row.unitPrice,
                matchFeatures=AIMatchFeatures(
                    tokenSort=round(components["token_sort"], 2),
                    partial=round(components["partial"], 2),
                    tokenSet=round(components["token_set"], 2),
                    normalizedInput=components["normalized_source"],
                    normalizedMatch=components["normalized_target"],
                    strengthMatch=components["strength_match"],
                    dosageFormMatch=components["form_match"],
                    inputStrength=components["source_strength"],
                    matchedStrength=components["target_strength"],
                    inputDosageForm=components["source_form"],
                    matchedDosageForm=components["target_form"],
                ),
            )
            results.append(result)

        csv_rows = build_csv_rows(result.model_dump() for result in results)

        return AIAntibioticMatchResponse(
            pharmacyId=request.pharmacyId,
            sessionId=request.sessionId,
            threshold=request.threshold,
            confirmThreshold=request.confirmThreshold,
            results=results,
            csvRows=csv_rows,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}")


@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "antibiotic-matching",
        "endpoint": "POST /api/antibiotic/match-sales",
    }
