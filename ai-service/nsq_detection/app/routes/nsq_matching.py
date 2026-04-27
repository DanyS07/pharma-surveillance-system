# nsq_matching.py
# Single endpoint: POST /api/nsq/validate-nsq
# Called by: nsqService.sendToAI()
# Returns: only NSQ_CONFIRMED and PROBABLE_MATCH rows

from fastapi import APIRouter, HTTPException, Header
from typing  import Optional
from app.services.drug_matcher import compute_similarity, classify
from app.models import (
    AIValidateRequest,
    AIValidateResponse,
    AIValidateResult,
)
from dotenv import load_dotenv
import os

load_dotenv()

router  = APIRouter(prefix="/api/nsq", tags=["NSQ Detection"])
API_KEY = os.getenv("AI_API_KEY", "")

MATCH_THRESHOLD = 80.0   # minimum score to be a PROBABLE_MATCH


# ── API Key Verification ──────────────────────────────────────────────────────
def _verify_key(x_api_key: Optional[str]):
    """Rejects requests with wrong or missing API key."""
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


# ── Best NSQ Candidate Finder ─────────────────────────────────────────────────
def _best_match(
    pharmacy_drug : str,
    candidates    : list,
    threshold     : float,
) -> dict | None:
    """
    Compares one pharmacy drug name against all NSQ candidates
    for the same batch number.

    Why multiple candidates per batch?
    The same batch can appear in multiple CDSCO reports.
    We take the highest scoring candidate.

    Returns match dict if score >= threshold, else None.
    """
    best_score  = -1.0
    best        = None

    for candidate in candidates:
        score = compute_similarity(pharmacy_drug, candidate.drugName)
        if score > best_score:
            best_score = score
            best       = candidate

    if best_score < threshold:
        return None   # below threshold — MISMATCH — drop this row

    classification, _ = classify(best_score, threshold)

    return {
        "score"        : round(best_score, 2),
        "classification": classification,
        "nsqDrugName"  : best.drugName,
        "reportDate"   : str(best.reportDate),
        "manufacturer" : best.manufacturer,
    }


# ── Main Endpoint ─────────────────────────────────────────────────────────────
@router.post("/validate-nsq", response_model=AIValidateResponse)
async def validate_nsq(
    request   : AIValidateRequest,
    x_api_key : Optional[str] = Header(None),
):
    """
    POST /api/nsq/validate-nsq

    Called by MERN nsqService.sendToAI() after MongoDB batch matching.

    Flow:
      1. Verify API key
      2. Build NSQ lookup {batchNumber: [nsqRecords]}
      3. For each pharmacy row — find best NSQ name match
      4. Return ONLY confirmed and probable matches
         MISMATCH rows dropped — MERN marks remainder as SAFE

    Threshold: 80.0 (hardcoded — matches MERN calculateRiskTier logic)
    """
    _verify_key(x_api_key)

    try:
        # Build lookup — one batch can map to multiple NSQ records
        nsq_by_batch: dict = {}
        for nsq in request.nsqRecords:
            key = nsq.batchNumber.strip().upper()
            nsq_by_batch.setdefault(key, []).append(nsq)

        results: list[AIValidateResult] = []

        for row in request.rows:
            batch      = row.batchNumber.strip().upper()
            candidates = nsq_by_batch.get(batch)

            if not candidates:
                continue   # batch not in NSQ master — skip

            match = _best_match(row.drugName, candidates, MATCH_THRESHOLD)

            if match is None:
                continue   # MISMATCH — drop row, MERN marks as SAFE

            # Map to MERN-expected result labels
            result_label = (
                "NSQ_CONFIRMED"
                if match["classification"] == "Exact Match"
                else "PROBABLE_MATCH"
            )

            results.append(AIValidateResult(
                batchNumber    = row.batchNumber,
                drugName       = row.drugName,
                result         = result_label,
                nsqDrugName    = match["nsqDrugName"],
                similarityScore= match["score"],
                reportDate     = match["reportDate"],
                manufacturer   = match["manufacturer"],
            ))

        return AIValidateResponse(results=results)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal error: {str(e)}"
        )


# ── Health Check ──────────────────────────────────────────────────────────────
@router.get("/health")
async def health_check():
    return {
        "status"  : "ok",
        "service" : "nsq-detection",
        "endpoint": "POST /api/nsq/validate-nsq",
    }