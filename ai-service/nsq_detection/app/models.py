from pydantic import BaseModel

# ── Input ─────────────────────────────────────────────────────────────────────
class MatchedRecord(BaseModel):
    """
    One batch-matched pair sent by MERN backend.
    Batch matching already done in MongoDB.
    """
    pharmacy_record_id : str
    batch_number       : str
    pharmacy_drug_name : str
    nsq_drug_name      : str
    ban_date           : str    # e.g. "Jan-20"
    manufacturer       : str    # from NSQ record

class MatchRequest(BaseModel):
    """
    One pharmacy's monthly report sent to AI service.
    """
    report_id      : str
    pharmacy_id    : str
    pharmacy_name  : str
    officer_id     : str
    month          : str
    year           : int
    records        : list[MatchedRecord]
    threshold      : float = 80.0

# ── Output ────────────────────────────────────────────────────────────────────
class FlaggedDrug(BaseModel):
    """
    One flagged drug in the officer's report.
    Only Exact and Probable matches are flagged.
    """
    pharmacy_record_id   : str
    batch_number         : str
    pharmacy_drug_name   : str
    nsq_drug_name        : str
    manufacturer         : str
    similarity_score     : float
    match_classification : str  # "Exact Match" | "Probable Match"
    confidence           : str  # "High" | "Medium" | "Low"
    ban_date             : str

class MatchResponse(BaseModel):
    """
    Complete analysis result returned to MERN for officer review.
    """
    report_id        : str
    pharmacy_id      : str
    pharmacy_name    : str
    officer_id       : str
    month            : str
    year             : int
    risk_level       : str      # "High" | "Medium" | "Low" | "Clear"
    risk_score       : float    # 0 to 100
    total_checked    : int
    flagged_count    : int
    exact_matches    : int
    probable_matches : int
    mismatches       : int
    flagged_drugs    : list[FlaggedDrug]