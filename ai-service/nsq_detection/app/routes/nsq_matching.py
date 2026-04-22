from fastapi import APIRouter, HTTPException
from app.services.drug_matcher import compute_similarity, classify
from app.models import MatchRequest, MatchResponse

router = APIRouter(prefix="/api/nsq", tags=["NSQ Detection"])


@router.post("/analyse", response_model=MatchResponse)
async def analyse_matches(request: MatchRequest):
    """
    Receives batch-matched pairs from the MERN backend.
    Only performs drug name similarity comparison.

    The MERN backend already matched batch numbers in MongoDB.
    This service only compares drugName from pharmacy vs drugName from NSQ.
    """
    try:
        results = []

        for record in request.records:
            score                      = compute_similarity(
                                             record.pharmacy_drug_name,
                                             record.nsq_drug_name
                                         )
            classification, confidence = classify(score, request.threshold)

            results.append({
                "pharmacy_record_id"  : record.pharmacy_record_id,
                "batch_number"        : record.batch_number,
                "pharmacy_drug_name"  : record.pharmacy_drug_name,
                "nsq_drug_name"       : record.nsq_drug_name,
                "similarity_score"    : round(score, 2),
                "match_classification": classification,
                "confidence"          : confidence,
            })

        return MatchResponse(
            total_records_checked = len(results),
            exact_matches         = sum(1 for r in results if r["match_classification"] == "Exact Match"),
            probable_matches      = sum(1 for r in results if r["match_classification"] == "Probable Match"),
            mismatches            = sum(1 for r in results if r["match_classification"] == "Mismatch"),
            results               = results,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.get("/health")
async def health_check():
    return {"status": "ok", "service": "nsq-detection"}