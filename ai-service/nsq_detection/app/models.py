# models.py
# Single source of truth for AI service data contracts
# Last updated: April 2026
# Matches: nsqService.js → buildAIPayload() + processAIResults()

from pydantic import BaseModel, Field

# ═══════════════════════════════════════════════════════════════
# INPUT — what MERN sends to POST /api/nsq/validate-nsq
# ═══════════════════════════════════════════════════════════════

class AIRow(BaseModel):
    """
    One pharmacy sale row.
    Batch number already matched against NSQ master in MongoDB.
    Source: pharmacySaleModel fields after $in query.
    """
    batchNumber : str
    drugName    : str

class AINSQRecord(BaseModel):
    """
    One NSQ master record matching a pharmacy batch.
    Source: nsqDrugModel fields.
    reportDate arrives as ISO string e.g. "2020-01-01T00:00:00.000Z"
    because JSON.stringify converts MongoDB Date objects automatically.
    """
    batchNumber  : str
    drugName     : str
    manufacturer : str = ""
    reportDate   : str = ""

class AIValidateRequest(BaseModel):
    """
    Full payload from MERN after MongoDB batch matching.
    Built by nsqService.buildAIPayload().

    pharmacyId and sessionId are for tracing/logging only.
    AI does not use them for matching logic.

    rows[]       — pharmacy sale rows with matched batch numbers
    nsqRecords[] — NSQ master records for those batches
                   one batch can have multiple NSQ records (different report dates)
    """
    pharmacyId : str
    sessionId  : str
    rows       : list[AIRow]
    nsqRecords : list[AINSQRecord]

# ═══════════════════════════════════════════════════════════════
# OUTPUT — what AI returns to MERN from POST /api/nsq/validate-nsq
# ═══════════════════════════════════════════════════════════════

class AIValidateResult(BaseModel):
    """
    One matched result row returned to MERN.

    IMPORTANT: Only NSQ_CONFIRMED and PROBABLE_MATCH rows are returned.
    MISMATCH rows are intentionally dropped.
    MERN marks all unreturned rows as SAFE in processAIResults().

    result values:
      NSQ_CONFIRMED  — similarity == 100% after normalisation
      PROBABLE_MATCH — similarity >= 80% after normalisation

    reportDate is passed through unchanged from AINSQRecord.
    MERN stores it as banDate in alertModel.
    """
    batchNumber    : str
    drugName       : str
    result         : str    # "NSQ_CONFIRMED" | "PROBABLE_MATCH"
    nsqDrugName    : str
    similarityScore: float  # 0.0 to 100.0
    reportDate     : str    # ISO string from MongoDB Date e.g. "2020-01-01T00:00:00.000Z"
    manufacturer   : str

class AIValidateResponse(BaseModel):
    """
    Full response body.
    MERN reads: response.data.results
    """
    results: list[AIValidateResult]


class AISalesRow(BaseModel):
    sourceRecordId: str = ""
    batchNumber: str = ""
    drugName: str
    manufacturer: str = ""
    saleMonth: int | None = None
    saleYear: int | None = None
    quantity: float | None = None
    unitPrice: float | None = None


class AIAntibioticRecord(BaseModel):
    recordId: str = ""
    drugName: str
    manufacturer: str = ""
    activeIngredient: str = ""
    dosageForm: str = ""
    strength: str = ""


class AIAntibioticMatchRequest(BaseModel):
    pharmacyId: str
    sessionId: str
    salesRows: list[AISalesRow]
    antibioticRecords: list[AIAntibioticRecord]
    threshold: float = 80.0
    confirmThreshold: float = 98.0


class AIMatchFeatures(BaseModel):
    tokenSort: float
    partial: float
    tokenSet: float
    normalizedInput: str
    normalizedMatch: str
    strengthMatch: bool
    dosageFormMatch: bool
    inputStrength: str = ""
    matchedStrength: str = ""
    inputDosageForm: str = ""
    matchedDosageForm: str = ""


class AIAntibioticMatchResult(BaseModel):
    sourceType: str = "ANTIBIOTIC_SALE"
    sourceRecordId: str = ""
    pharmacyId: str
    sessionId: str
    saleMonth: int | None = None
    saleYear: int | None = None
    inputDrugName: str
    normalizedInputDrugName: str
    matchedRecordId: str = ""
    matchedDrugName: str
    normalizedMatchedDrugName: str
    similarityScore: float
    matchLabel: str
    confidence: str
    batchNumber: str = ""
    manufacturerInput: str = ""
    manufacturerMatched: str = ""
    quantity: float | None = None
    unitPrice: float | None = None
    matchFeatures: AIMatchFeatures


class AIAntibioticMatchResponse(BaseModel):
    pipeline: str = "antibiotic_sales_matching"
    schemaVersion: str = "v1"
    pharmacyId: str
    sessionId: str
    threshold: float
    confirmThreshold: float
    results: list[AIAntibioticMatchResult]
    csvRows: list[dict] = Field(default_factory=list)
