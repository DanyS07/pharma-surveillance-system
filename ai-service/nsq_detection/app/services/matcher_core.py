import re
from rapidfuzz import fuzz


DEFAULT_MATCH_THRESHOLD = 80.0
DEFAULT_CONFIRM_THRESHOLD = 98.0

_DOSAGE_FORMS = (
    r"\b(tab|tablet|tablets|cap|capsule|capsules|inj|injection|"
    r"syp|syrup|sol|solution|susp|suspension|cream|oint|ointment|"
    r"drop|drops|gel|powder|sachet|inhaler|vial)\b"
)

_STRENGTH_PATTERN = r"\d+\s*(mg|mcg|ml|g|iu|%)"


def normalise(name: str) -> str:
    if not name:
        return ""

    cleaned = name.lower().strip()
    cleaned = re.sub(_DOSAGE_FORMS, " ", cleaned)
    cleaned = re.sub(_STRENGTH_PATTERN, " ", cleaned)
    cleaned = re.sub(r"[^a-z\s]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def extract_strength(name: str) -> str:
    if not name:
        return ""

    full_matches = [match.group(0).replace(" ", "") for match in re.finditer(_STRENGTH_PATTERN, name.lower())]
    return "|".join(full_matches)


def extract_form(name: str) -> str:
    if not name:
        return ""

    match = re.search(_DOSAGE_FORMS, name.lower())
    return match.group(0) if match else ""


def compute_component_scores(source_name: str, target_name: str) -> dict:
    source_clean = normalise(source_name)
    target_clean = normalise(target_name)

    source_strength = extract_strength(source_name)
    target_strength = extract_strength(target_name)
    source_form = extract_form(source_name)
    target_form = extract_form(target_name)

    if not source_clean or not target_clean:
        return {
            "normalized_source": source_clean,
            "normalized_target": target_clean,
            "token_sort": 0.0,
            "partial": 0.0,
            "token_set": 0.0,
            "score": 0.0,
            "strength_match": False,
            "form_match": False,
            "source_strength": source_strength,
            "target_strength": target_strength,
            "source_form": source_form,
            "target_form": target_form,
        }

    if source_clean == target_clean:
        token_sort = partial = token_set = score = 100.0
    else:
        token_sort = float(fuzz.token_sort_ratio(source_clean, target_clean))
        partial = float(fuzz.partial_ratio(source_clean, target_clean))
        token_set = float(fuzz.token_set_ratio(source_clean, target_clean))
        score = max(token_sort, partial, token_set)

    return {
        "normalized_source": source_clean,
        "normalized_target": target_clean,
        "token_sort": token_sort,
        "partial": partial,
        "token_set": token_set,
        "score": float(score),
        "strength_match": bool(source_strength and target_strength and source_strength == target_strength),
        "form_match": bool(source_form and target_form and source_form == target_form),
        "source_strength": source_strength,
        "target_strength": target_strength,
        "source_form": source_form,
        "target_form": target_form,
    }


def compute_similarity(source_name: str, target_name: str) -> float:
    return compute_component_scores(source_name, target_name)["score"]


def classify(
    score: float,
    threshold: float = DEFAULT_MATCH_THRESHOLD,
    confirm_threshold: float = DEFAULT_CONFIRM_THRESHOLD,
) -> tuple[str, str]:
    if score >= confirm_threshold:
        return "Exact Match", "High"
    if score >= threshold:
        confidence = "High" if score >= 90 else "Medium"
        return "Probable Match", confidence
    return "Mismatch", "Low"
