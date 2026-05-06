import re
import uuid
from rapidfuzz import fuzz

# -----------------------------
# CONFIG
# -----------------------------
DEFAULT_MATCH_THRESHOLD = 80.0
DEFAULT_CONFIRM_THRESHOLD = 98.0

NAME_WEIGHT = 0.8
MANUFACTURER_WEIGHT = 0.2

# -----------------------------
# PATTERNS
# -----------------------------
_DOSAGE_FORMS = (
    r"\b(tab|tablet|tablets|cap|capsule|capsules|inj|injection|"
    r"syp|syrup|sol|solution|susp|suspension|cream|oint|ointment|"
    r"drop|drops|gel|powder|sachet|inhaler|vial)\b"
)

_STRENGTH_PATTERN = r"\d+\s*(mg|mcg|ml|g|iu|%)"

_MANUFACTURER_CLEAN = r"\b(ltd|limited|pvt|private|pharma|pharmaceuticals|inc|corp|co)\b"


# -----------------------------
# NORMALIZATION
# -----------------------------
def normalise(name: str) -> str:
    if not name:
        return ""

    cleaned = name.lower().strip()
    cleaned = re.sub(_DOSAGE_FORMS, " ", cleaned)
    cleaned = re.sub(_STRENGTH_PATTERN, " ", cleaned)
    cleaned = re.sub(r"[^a-z\s]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def normalise_manufacturer(name: str) -> str:
    if not name:
        return ""

    cleaned = name.lower().strip()
    cleaned = re.sub(_MANUFACTURER_CLEAN, " ", cleaned)
    cleaned = re.sub(r"[^a-z\s]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


# -----------------------------
# EXTRACTION
# -----------------------------
def extract_strength(name: str) -> str:
    if not name:
        return ""

    matches = [m.group(0).replace(" ", "") for m in re.finditer(_STRENGTH_PATTERN, name.lower())]
    return "|".join(matches)


def extract_form(name: str) -> str:
    if not name:
        return ""

    match = re.search(_DOSAGE_FORMS, name.lower())
    return match.group(0) if match else ""


# -----------------------------
# SCORING
# -----------------------------
def compute_name_score(source: str, target: str) -> dict:
    s_clean = normalise(source)
    t_clean = normalise(target)

    s_strength = extract_strength(source)
    t_strength = extract_strength(target)

    s_form = extract_form(source)
    t_form = extract_form(target)

    if not s_clean or not t_clean:
        return {
            "score": 0.0,
            "strength_match": False,
            "form_match": False,
        }

    if s_clean == t_clean:
        score = 100.0
    else:
        score = max(
            fuzz.token_sort_ratio(s_clean, t_clean),
            fuzz.partial_ratio(s_clean, t_clean),
            fuzz.token_set_ratio(s_clean, t_clean)
        )

    return {
        "score": float(score),
        "strength_match": s_strength and t_strength and s_strength == t_strength,
        "form_match": s_form and t_form and s_form == t_form,
    }


def compute_manufacturer_score(source: str, target: str) -> float:
    s = normalise_manufacturer(source)
    t = normalise_manufacturer(target)

    if not s or not t:
        return 0.0

    if s == t:
        return 100.0

    return float(fuzz.token_set_ratio(s, t))


def compute_final_score(source_name, target_name, source_mfg, target_mfg):
    name_data = compute_name_score(source_name, target_name)
    name_score = name_data["score"]

    mfg_score = compute_manufacturer_score(source_mfg, target_mfg)

    final_score = (NAME_WEIGHT * name_score) + (MANUFACTURER_WEIGHT * mfg_score)

    return {
        "name_score": name_score,
        "manufacturer_score": mfg_score,
        "final_score": final_score,
        "strength_match": name_data["strength_match"],
        "form_match": name_data["form_match"],
        "manufacturer_match": mfg_score >= 90
    }


# -----------------------------
# CLASSIFICATION
# -----------------------------
def classify(score_data,
             threshold=DEFAULT_MATCH_THRESHOLD,
             confirm_threshold=DEFAULT_CONFIRM_THRESHOLD):

    # Backward compatibility:
    # - NSQ/antibiotic routes pass a numeric similarity score
    # - legacy NSQ matching passes a score-data dict
    if isinstance(score_data, dict):
        score = float(score_data.get("final_score", score_data.get("score", 0.0)))
        mfg_match = bool(score_data.get("manufacturer_match", False))
    else:
        score = float(score_data)
        # For name-only workflows (NSQ/antibiotic), exactness is score-driven.
        mfg_match = None

    if score >= confirm_threshold and (mfg_match is None or mfg_match):
        return "Exact Match", "High"

    if score >= threshold:
        if mfg_match:
            return "Probable Match", "High"
        return "Probable Match", "Medium"

    return "Mismatch", "Low"


# -----------------------------
# OUTPUT BUILDER
# -----------------------------
def build_match_output(sales_record: dict, nsq_record: dict) -> dict:
    score_data = compute_final_score(
        sales_record.get("drug_name", ""),
        nsq_record.get("drug_name", ""),
        sales_record.get("manufacturer", ""),
        nsq_record.get("manufacturer", "")
    )

    match_type, confidence = classify(score_data)

    return {
        "match_id": str(uuid.uuid4()),

        "sales_drug_name": sales_record.get("drug_name", ""),
        "nsq_drug_name": nsq_record.get("drug_name", ""),

        "sales_manufacturer": sales_record.get("manufacturer", ""),
        "nsq_manufacturer": nsq_record.get("manufacturer", ""),

        "batch_number": sales_record.get("batch_number", ""),

        "quantity_sold": sales_record.get("quantity_sold", 0),

        "ban_date": nsq_record.get("ban_date", ""),

        "similarity_score": round(score_data["final_score"], 2),

        "match_type": match_type,
        "confidence": confidence
    }


# -----------------------------
# BULK MATCHING
# -----------------------------
def match_datasets(sales_data: list, nsq_data: list) -> list:
    results = []

    for sale in sales_data:
        for nsq in nsq_data:
            result = build_match_output(sale, nsq)
            results.append(result)

    return results


# =============================
# ANTIBIOTIC MATCHING WORKFLOW
# =============================

# Abbreviation mapping for antibiotic drug names
_ANTIBIOTIC_ABBREVIATIONS = {
    "amox": "amoxicillin",
    "cipro": "ciprofloxacin",
    "doxy": "doxycycline",
    "metro": "metronidazole",
    "levo": "levofloxacin",
    "chloro": "chloramphenicol",
    "tetra": "tetracycline",
    "peni": "penicillin",
    "strep": "streptomycin",
    "sulfa": "sulfamethoxazole",
    "ceph": "cephalosporin",
    "genta": "gentamicin",
    "neo": "neomycin",
    "kana": "kanamycin",
    "strepto": "streptomycin",
    "nitro": "nitrofurantoin",
    "vanco": "vancomycin",
    "primo": "primaquine",
    "chlor": "chloramphenicol",
    "aug": "augmentin",
    "ampi": "ampicillin",
    "azi": "azithromycin",
    "erythro": "erythromycin",
    "fluoro": "fluoroquinolone",
    "oflox": "ofloxacin",
    "nor": "norfloxacin",
    "moxi": "moxifloxacin",
    "gati": "gatifloxacin",
}


def compute_similarity(source_name: str, target_name: str) -> float:
    """
    Compute fuzzy match similarity score between two drug names.
    Used for both NSQ and antibiotic matching.
    
    Args:
        source_name: Drug name from sales/input
        target_name: Drug name from reference/database
        
    Returns:
        Similarity score (0-100)
    """
    s_clean = normalise(source_name)
    t_clean = normalise(target_name)
    
    if not s_clean or not t_clean:
        return 0.0
    
    raw_source = re.sub(r"[^a-z0-9\s]", " ", str(source_name).lower()).strip()
    raw_target = re.sub(r"[^a-z0-9\s]", " ", str(target_name).lower()).strip()
    raw_source = re.sub(r"\s+", " ", raw_source)
    raw_target = re.sub(r"\s+", " ", raw_target)

    if s_clean == t_clean:
        # Perfect score only when raw normalized text is also equal.
        # If equality happens only after dropping strength/form tokens,
        # keep it high but below exact-confirm threshold.
        return 100.0 if raw_source == raw_target else 97.5
    
    token_sort = float(fuzz.token_sort_ratio(s_clean, t_clean))
    partial = float(fuzz.partial_ratio(s_clean, t_clean))
    token_set = float(fuzz.token_set_ratio(s_clean, t_clean))

    # Start from strongest fuzzy signal.
    score = max(token_sort, partial, token_set)

    # Guard against token_set_ratio over-inflation on subset/extra-token cases.
    if token_set == 100.0 and token_sort < 100.0:
        score = max(token_sort, partial, 96.0)

    # Only truly equal normalized names should be treated as exact (100).
    # This keeps near-matches out of NSQ_CONFIRMED.
    if score >= 98.0:
        score = 97.5

    return float(score)


def compute_component_scores(source_name: str, target_name: str) -> dict:
    """
    Compute detailed scoring components for drug name matching.
    Returns individual fuzzy match scores and metadata for detailed analysis.
    
    Args:
        source_name: Drug name from sales data
        target_name: Drug name from reference data
        
    Returns:
        Dict with individual score components:
        {
            "score": overall similarity (0-100),
            "normalized_source": normalized input name,
            "normalized_target": normalized reference name,
            "token_sort": token_sort_ratio score,
            "partial": partial_ratio score,
            "token_set": token_set_ratio score,
            "strength_match": bool,
            "form_match": bool,
            "source_strength": strength string from input,
            "target_strength": strength string from reference,
            "source_form": dosage form from input,
            "target_form": dosage form from reference,
        }
    """
    s_clean = normalise(source_name)
    t_clean = normalise(target_name)
    
    s_strength = extract_strength(source_name)
    t_strength = extract_strength(target_name)
    
    s_form = extract_form(source_name)
    t_form = extract_form(target_name)
    
    if not s_clean or not t_clean:
        return {
            "score": 0.0,
            "normalized_source": s_clean,
            "normalized_target": t_clean,
            "token_sort": 0.0,
            "partial": 0.0,
            "token_set": 0.0,
            "strength_match": False,
            "form_match": False,
            "source_strength": s_strength,
            "target_strength": t_strength,
            "source_form": s_form,
            "target_form": t_form,
        }
    
    token_sort = fuzz.token_sort_ratio(s_clean, t_clean)
    partial = fuzz.partial_ratio(s_clean, t_clean)
    token_set = fuzz.token_set_ratio(s_clean, t_clean)
    
    overall_score = max(token_sort, partial, token_set)
    
    return {
        "score": float(overall_score),
        "normalized_source": s_clean,
        "normalized_target": t_clean,
        "token_sort": float(token_sort),
        "partial": float(partial),
        "token_set": float(token_set),
        "strength_match": s_strength and t_strength and s_strength == t_strength,
        "form_match": s_form and t_form and s_form == t_form,
        "source_strength": s_strength,
        "target_strength": t_strength,
        "source_form": s_form,
        "target_form": t_form,
    }


def expand_abbreviations(drug_name: str) -> str:
    """
    Replace abbreviation tokens in drug name with full names.
    
    Example: "amox 500" → "amoxicillin 500"
    
    Args:
        drug_name: Original drug name string
        
    Returns:
        Drug name with abbreviations expanded
    """
    if not drug_name:
        return drug_name
    
    name_lower = drug_name.lower()
    tokens = name_lower.split()
    expanded_tokens = []
    
    for token in tokens:
        # Remove non-alphanumeric from token for matching
        clean_token = re.sub(r"[^a-z0-9]", "", token)
        
        if clean_token in _ANTIBIOTIC_ABBREVIATIONS:
            expanded_tokens.append(_ANTIBIOTIC_ABBREVIATIONS[clean_token])
        else:
            expanded_tokens.append(token)
    
    return " ".join(expanded_tokens)


def compute_antibiotic_similarity(sales_name: str, reference_name: str) -> float:
    """
    Compute fuzzy match score between sales drug name and reference drug name.
    Uses name-based matching only (no manufacturer or batch number).
    
    Args:
        sales_name: Drug name from sales data
        reference_name: Drug name from antibiotic reference
        
    Returns:
        Similarity score (0-100)
    """
    # Normalize both names
    sales_clean = normalise(sales_name)
    ref_clean = normalise(reference_name)
    
    if not sales_clean or not ref_clean:
        return 0.0
    
    if sales_clean == ref_clean:
        return 100.0
    
    # Use max of multiple fuzzy matching algorithms
    score = max(
        fuzz.token_sort_ratio(sales_clean, ref_clean),
        fuzz.partial_ratio(sales_clean, ref_clean),
        fuzz.token_set_ratio(sales_clean, ref_clean)
    )
    
    return float(score)


def match_antibiotic_sales(sales_data: list, reference_data: list) -> list:
    """
    Match pharmacy sales drug names with antibiotic reference dataset using fuzzy matching.
    
    Workflow:
    1. Aggregate sales by normalized drug name
    2. Expand common abbreviations before matching
    3. Find best match for each aggregated sales drug
    4. Return all matches (no score filtering; backend applies slider)
    
    Args:
        sales_data: List of sales records, each with 'drug_name' and 'quantity_sold'
        reference_data: List of reference records, each with 'reference_name' or 'drug_name'
        
    Returns:
        List of match results in strict format:
        [
            {
                "sales_drug_name": <original name from sales>,
                "reference_drug_name": <matched reference name>,
                "total_quantity_sold": <integer>,
                "similarity_score": <float rounded to 2 decimals>
            },
            ...
        ]
    """
    if not sales_data or not reference_data:
        return []
    
    # Step 1: Aggregate sales by normalized drug name
    # Key: normalized name, Value: {original_name, total_qty}
    aggregated = {}
    
    for record in sales_data:
        drug_name = record.get("drug_name", "")
        quantity = record.get("quantity_sold", 0)
        
        if not drug_name:
            continue
        
        norm_name = normalise(drug_name)
        
        if norm_name not in aggregated:
            aggregated[norm_name] = {
                "original_name": drug_name,
                "total_quantity": quantity
            }
        else:
            aggregated[norm_name]["total_quantity"] += quantity
    
    # Step 2: Extract reference drug names (handle both 'reference_name' and 'drug_name')
    reference_names = []
    for ref in reference_data:
        ref_name = ref.get("reference_name") or ref.get("drug_name", "")
        if ref_name:
            reference_names.append(ref_name)
    
    # Step 3: Match each aggregated sales drug to reference
    results = []
    
    for norm_sales_name, agg_data in aggregated.items():
        original_name = agg_data["original_name"]
        total_qty = agg_data["total_quantity"]
        
        # Expand abbreviations in the normalized name for better matching
        expanded_name = expand_abbreviations(norm_sales_name)
        
        best_match = None
        best_score = 0.0
        
        # Find best match across all reference drugs
        for ref_name in reference_names:
            score = compute_antibiotic_similarity(expanded_name, ref_name)
            
            # Prefer higher score; if tie, prefer lexicographically first reference
            if score > best_score or (score == best_score and (best_match is None or ref_name < best_match)):
                best_score = score
                best_match = ref_name
        
        # Only return if a match was found
        if best_match is not None:
            results.append({
                "sales_drug_name": original_name,
                "reference_drug_name": best_match,
                "total_quantity_sold": int(total_qty),
                "similarity_score": round(best_score, 2)
            })
    
    # Sort results deterministically by sales_drug_name for consistent output
    results.sort(key=lambda x: x["sales_drug_name"])
    
    return results