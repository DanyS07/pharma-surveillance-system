from typing import Iterable
import re

from bson import ObjectId
from rapidfuzz import fuzz

from app.database import (
    antibiotic_reference_collection,
    pharmacy_collection,
)
from app.services.matcher_core import normalise


CANDIDATE_FLOOR = 50.0
MIN_ALIAS_LENGTH = 6
ANTIBIOTIC_FUZZY_FLOOR = 92.0
ANTIBIOTIC_EXCLUDE_KEYWORDS = {
    "paracetamol",
    "acetaminophen",
    "diclofenac",
    "folic acid",
    "ferrous",
    "linseed",
    "methyl salicylate",
    "salicylate",
    "menthol",
    "calcium",
    "vitamin",
    "ibuprofen",
    "metformin",
    "omeprazole",
    "pantoprazole",
    "telmisartan",
    "amlodipine",
    "losartan",
    "rosuvastatin",
    "aspirin",
    "ondansetron",
    "salbutamol",
    "levocetirizine",
    "ranitidine",
    "tramadol",
    "bupropion",
    "chlordiazepoxide",
    "amitriptyline",
    "cotton",
    "gauze",
}


def _first_value(document: dict, keys: Iterable[str]) -> str:
    for key in keys:
        value = document.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def _number_value(document: dict, keys: Iterable[str]):
    value = _first_value(document, keys)
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _pharmacy_id_filter(pharmacy_ids: list[str] | None) -> dict:
    if not pharmacy_ids:
        return {}

    object_ids = []
    string_ids = []
    for pharmacy_id in pharmacy_ids:
        value = str(pharmacy_id).strip()
        if not value:
            continue
        string_ids.append(value)
        try:
            object_ids.append(ObjectId(value))
        except Exception:
            pass

    allowed_values = object_ids + string_ids
    if not allowed_values:
        return {}

    return {
        "$or": [
            {"pharmacyId": {"$in": allowed_values}},
            {"pharmacy_id": {"$in": string_ids}},
        ]
    }


def _match_type(score: float, category: str) -> str:
    if score == 100:
        return "ANTIBIOTIC_CONFIRMED"
    if score >= 80:
        return "PROBABLE_MATCH"
    return "CANDIDATE"


def _contains_phrase(source_normalized: str, reference_normalized: str) -> bool:
    if not source_normalized or not reference_normalized:
        return False
    pattern = rf"(^|\s){re.escape(reference_normalized)}(\s|$)"
    return re.search(pattern, source_normalized) is not None


def _is_excluded_antibiotic_source(source_normalized: str) -> bool:
    return any(_contains_phrase(source_normalized, normalise(keyword)) for keyword in ANTIBIOTIC_EXCLUDE_KEYWORDS)


def _split_aliases(value: str) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in str(value).split("|") if part.strip()]


def _load_reference_names() -> list[dict]:
    cursor = antibiotic_reference_collection.find({}, {
        "name": 1,
        "drugName": 1,
        "drug_name": 1,
        "standard_name": 1,
        "brand_names": 1,
        "synonyms": 1,
    }).batch_size(1000)

    references = []
    for document in cursor:
        name = _first_value(document, ("name", "drugName", "drug_name", "standard_name"))
        aliases = _split_aliases(document.get("brand_names", "")) + _split_aliases(document.get("synonyms", ""))

        for match_name in [name, *aliases]:
            normalized = normalise(match_name)
            if not match_name or not normalized:
                continue
            if match_name != name and len(normalized) < MIN_ALIAS_LENGTH:
                continue
            references.append({
                "id": str(document.get("_id", "")),
                "name": name,
                "match_name": match_name,
                "normalized": normalized,
            })
    return references


def _score_pair(source_name: str, source_normalized: str, reference: dict) -> float:
    if source_normalized == reference["normalized"]:
        return 100.0

    if _contains_phrase(source_normalized, reference["normalized"]):
        return 100.0
    token_sort = float(fuzz.token_sort_ratio(source_normalized, reference["normalized"]))
    token_set = float(fuzz.token_set_ratio(source_normalized, reference["normalized"]))
    score = max(token_sort, token_set)
    return score if score >= ANTIBIOTIC_FUZZY_FLOOR else 0.0


def score_antibiotic_candidates(
    max_sales: int | None = None,
    pharmacy_ids: list[str] | None = None,
) -> list[dict]:
    references = _load_reference_names()
    if not references:
        return []

    projection = {
        "pharmacyId": 1,
        "pharmacy_id": 1,
        "pharmacyRecordId": 1,
        "record_id": 1,
        "drug_name": 1,
        "drugName": 1,
        "batch_number": 1,
        "batchNumber": 1,
        "quantity_sold": 1,
        "quantity": 1,
        "unit_price": 1,
        "unitPrice": 1,
        "month": 1,
        "saleMonth": 1,
        "year": 1,
        "saleYear": 1,
    }
    cursor = pharmacy_collection.find(_pharmacy_id_filter(pharmacy_ids), projection).batch_size(1000)
    if max_sales:
        cursor = cursor.limit(max_sales)

    candidates = []
    for sale in cursor:
        drug_name = _first_value(sale, ("drug_name", "drugName"))
        pharmacy_id = _first_value(sale, ("pharmacyId", "pharmacy_id"))
        normalized_drug_name = normalise(drug_name)
        if not drug_name or not normalized_drug_name:
            continue
        if _is_excluded_antibiotic_source(normalized_drug_name):
            continue

        best_candidate = None
        for reference in references:
            score = _score_pair(drug_name, normalized_drug_name, reference)
            if best_candidate is None or score > best_candidate["similarity_score"]:
                best_candidate = {
                "sale_id": str(sale.get("_id", "")),
                "pharmacy_id": pharmacy_id,
                "record_id": _first_value(sale, ("record_id", "pharmacyRecordId")) or str(sale.get("_id", "")),
                "drug_name": drug_name,
                "batch_number": _first_value(sale, ("batch_number", "batchNumber")),
                "quantity_sold": _number_value(sale, ("quantity_sold", "quantity")),
                "unit_price": _number_value(sale, ("unit_price", "unitPrice")),
                "month": _number_value(sale, ("month", "saleMonth")),
                "year": _number_value(sale, ("year", "saleYear")),
                "matched_name": reference["name"],
                "matched_alias": reference["match_name"],
                "similarity_score": round(score, 2),
                "match_type": _match_type(round(score, 2), "ANTIBIOTIC"),
                "category": "ANTIBIOTIC",
                }

        if best_candidate and best_candidate["similarity_score"] >= CANDIDATE_FLOOR:
            candidates.append(best_candidate)

    candidates.sort(key=lambda item: item["similarity_score"], reverse=True)
    return candidates
