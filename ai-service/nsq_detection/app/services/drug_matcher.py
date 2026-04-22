import re
from rapidfuzz import fuzz

# ── Step 1: Text Normalisation ──────────────────────────────────────────────
def normalise(name: str) -> str:
    """
    Cleans a drug name before comparison.
    
    Why this matters:
    "AMOXICILLIN CAP 500MG" and "amoxicillin 500 mg capsules"
    are the same drug — normalisation makes them comparable.
    
    What it does step by step:
    1. Lowercase everything
    2. Remove dosage forms (tablet, capsule, syrup etc.)
    3. Remove numeric dosages (500mg, 250ml etc.)
    4. Remove special characters
    5. Collapse extra spaces
    """
    if not name:
        return ""

    # 1. Lowercase
    name = name.lower().strip()

    # 2. Remove dosage forms
    dosage_forms = (
        r'\b(tab|tablet|tablets|cap|capsule|capsules|inj|injection|'
        r'syp|syrup|sol|solution|susp|suspension|cream|oint|ointment|'
        r'drop|drops|gel|powder|sachet|inhaler)\b'
    )
    name = re.sub(dosage_forms, '', name)

    # 3. Remove numeric dosages like 500mg, 250ml, 10mcg
    name = re.sub(r'\d+\s*(mg|mcg|ml|g|iu|%)', '', name)

    # 4. Remove special characters — keep only letters and spaces
    name = re.sub(r'[^a-z\s]', '', name)

    # 5. Collapse multiple spaces into one
    name = re.sub(r'\s+', ' ', name).strip()

    return name


# ── Step 2: Similarity Scoring ───────────────────────────────────────────────
def compute_similarity(pharmacy_name: str, nsq_name: str) -> float:
    """
    Compares two drug names and returns a score from 0 to 100.
    
    Uses 3 strategies and returns the highest score:
    
    token_sort_ratio  → handles word order differences
                        "Paracetamol Tab 500mg" vs "Tab Paracetamol 500mg" ✅
    
    partial_ratio     → handles abbreviations / one name inside another
                        "Amox" vs "Amoxicillin" ✅
    
    token_set_ratio   → handles extra or missing words
                        "Aspirin Tablet" vs "Aspirin" ✅
    """
    p = normalise(pharmacy_name)
    n = normalise(nsq_name)

    # Safety check
    if not p or not n:
        return 0.0

    # If identical after normalisation → perfect score
    if p == n:
        return 100.0

    score_token_sort = fuzz.token_sort_ratio(p, n)
    score_partial    = fuzz.partial_ratio(p, n)
    score_token_set  = fuzz.token_set_ratio(p, n)

    # Return the best score across all three strategies
    return float(max(score_token_sort, score_partial, score_token_set))


# ── Step 3: Classification ───────────────────────────────────────────────────
def classify(score: float, threshold: float = 80.0) -> tuple[str, str]:
    """
    Converts a numeric score into a human-readable classification.
    
    100          → Exact Match    + High confidence
    threshold-99 → Probable Match + High (≥90) or Medium confidence
    <threshold   → Mismatch       + Low confidence
    """
    if score == 100.0:
        return "Exact Match", "High"
    elif score >= threshold:
        confidence = "High" if score >= 90 else "Medium"
        return "Probable Match", confidence
    else:
        return "Mismatch", "Low"


 