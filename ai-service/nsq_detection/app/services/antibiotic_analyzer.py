"""
Antibiotic anomaly detection service.
Wraps detector logic using nsq_detection app's database connections.
"""
import sys
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest

from app.database import antibiotic_reference_collection


EXCLUDE_KEYWORDS = [
    "paracetamol", "domperidone", "glimepiride", "ranitidine",
    "propyl alcohol", "diclofenac", "folic acid", "ferrous",
    "linseed", "menthol", "salicylate", "buprenorphine",
    "multivitamin", "vitamin", "calcium", "ibuprofen",
    "metformin", "omeprazole", "pantoprazole", "telmisartan",
    "amlodipine", "losartan", "rosuvastatin", "aspirin",
    "ondansetron", "salbutamol", "montelukast", "levocetirizine",
    "pepsin", "diastase", "carbimazole", "dextromethorphan",
    "hypromellose", "syringe", "cough", "chlorpheniramine"
]


def load_antibiotic_classes():
    """Load antibiotic class mapping from MongoDB."""
    mapping = {}

    for doc in antibiotic_reference_collection.find({}):
        standard = str(doc.get("standard_name", "")).lower().strip()
        drug_class = str(doc.get("antibiotic_class", "")).lower().strip()

        if standard:
            mapping[standard] = drug_class

        for synonym in str(doc.get("synonyms", "")).split("|"):
            synonym = synonym.lower().strip()
            if len(synonym) > 3:
                mapping[synonym] = drug_class

        for brand in str(doc.get("brand_names", "")).split("|"):
            brand = brand.lower().strip()
            if len(brand) > 3:
                mapping[brand] = drug_class

    return mapping


def map_antibiotic_class(df: pd.DataFrame, mapping: dict) -> pd.DataFrame:
    """Map drug names to antibiotic classes."""
    def find_class(name):
        name = str(name).lower()
        for key, value in mapping.items():
            if key in name:
                return value
        return "unknown"

    df = df.copy()
    df["antibiotic_class"] = df["drug_name"].apply(find_class)
    return df


def apply_rules(df: pd.DataFrame):
    """Calculate rule-based risk flags for the pharmacy."""
    flags = []

    last_resort = ["carbapenem", "glycopeptide", "oxazolidinone"]
    lr_df = df[df["antibiotic_class"].isin(last_resort)]

    if not lr_df.empty:
        qty = lr_df["quantity_sold"].sum()
        if qty > 50:
            flags.append(f"R1: last_resort_qty={qty} (HIGH RISK)")
        elif qty > 20:
            flags.append(f"R2: last_resort_qty={qty} (MEDIUM RISK)")

    max_qty = df.groupby("drug_name")["quantity_sold"].sum().max()
    if max_qty > 500:
        flags.append(f"R7: drug_qty={max_qty} (unusually high)")
    elif max_qty > 300:
        flags.append(f"R6: drug_qty={max_qty} (elevated)")

    repeat = df.groupby("drug_name").size().max()
    if repeat > 20:
        flags.append(f"R8: repeat_sales={repeat} (multiple batches)")

    return flags


def apply_drug_rules(drug_class: str, qty: float) -> float:
    """Calculate per-drug risk score."""
    score = 0
    last_resort = ["carbapenem", "glycopeptide", "oxazolidinone"]
    
    if drug_class in last_resort:
        if qty > 50:
            score = 80
        elif qty > 20:
            score = 60
        elif qty > 10:
            score = 40

    return score


def compute_z_score(df: pd.DataFrame):
    """Compute Z-score for quantities."""
    if df.empty or "quantity_sold" not in df.columns:
        return pd.Series(dtype=float)

    values = pd.to_numeric(df["quantity_sold"], errors="coerce").fillna(0)
    if len(values) == 1:
        return pd.Series([0.0], index=df.index)

    mean = values.mean()
    std = values.std(ddof=0) or 1
    z = (values - mean) / std
    return (np.abs(z) / 3 * 100).clip(0, 100)


def classify(score: float):
    """Classify anomaly risk level."""
    if score >= 75:
        return "HIGH", "Immediate investigation required"
    if score >= 50:
        return "MEDIUM", "Review within 48 hours"
    if score >= 25:
        return "LOW", "Monitor next month"
    return "NORMAL", "No action needed"


def _to_frame(sales_data):
    """Convert sales data to DataFrame."""
    df = pd.DataFrame(sales_data or [])
    if df.empty:
        return df

    rename_map = {
        "drugName": "drug_name",
        "drug_name": "drug_name",
        "quantity": "quantity_sold",
        "quantitySold": "quantity_sold",
        "quantity_sold": "quantity_sold",
        "saleMonth": "month",
        "sale_year": "year",
        "saleYear": "year",
        "month": "month",
        "year": "year",
        "batchNumber": "batch_number",
        "batch_number": "batch_number",
        "unitPrice": "unit_price",
        "unit_price": "unit_price",
        "pharmacyId": "pharmacy_id",
        "pharmacy_id": "pharmacy_id",
    }
    df = df.rename(columns={key: value for key, value in rename_map.items() if key in df.columns})

    if "drug_name" not in df.columns:
        df["drug_name"] = df.get("drugName", "")

    if "quantity_sold" not in df.columns:
        df["quantity_sold"] = 0
    if "month" not in df.columns:
        df["month"] = None
    if "year" not in df.columns:
        df["year"] = None
    if "batch_number" not in df.columns:
        df["batch_number"] = ""
    if "unit_price" not in df.columns:
        df["unit_price"] = 0

    df["quantity_sold"] = pd.to_numeric(df["quantity_sold"], errors="coerce").fillna(0)
    df["unit_price"] = pd.to_numeric(df["unit_price"], errors="coerce").fillna(0)
    return df


def score_sales_rows(sales_data, role="pharmacy"):
    """Score all antibiotic rows and return per-row risk metrics."""
    if not sales_data:
        return []

    df = _to_frame(sales_data)
    if df.empty:
        return []

    class_map = load_antibiotic_classes()
    df = map_antibiotic_class(df, class_map)

    # Aggregate by drug/month/year
    group_cols = ["drug_name", "month", "year"]
    agg = df.groupby(group_cols, dropna=False).agg(
        total_qty=("quantity_sold", "sum"),
        batch_number=("batch_number", "first"),
        unit_price=("unit_price", "first"),
        antibiotic_class=("antibiotic_class", "first"),
    ).reset_index()

    if agg.empty:
        return []

    # Isolation Forest
    features = agg[["total_qty"]]
    iso = IsolationForest(n_estimators=100, contamination=0.1, random_state=42)
    iso.fit(features)

    raw_scores = iso.decision_function(features)
    agg["isolation_score"] = ((-raw_scores + 0.5) * 100).clip(0, 100)

    # Pharmacy-level flags
    pharmacy_flags = apply_rules(df)

    # Per-drug rules
    agg["drug_rule_score"] = agg.apply(
        lambda row: apply_drug_rules(row["antibiotic_class"], row["total_qty"]),
        axis=1
    )

    # Z-score (admin only)
    if role == "admin":
        agg["z_score"] = compute_z_score(agg.rename(columns={"total_qty": "quantity_sold"})[["quantity_sold"]])
    else:
        agg["z_score"] = 0

    # Final score
    agg["final_score"] = (
        agg["drug_rule_score"] * 0.35 +
        agg["isolation_score"] * 0.45 +
        agg["z_score"] * 0.20
    )

    agg["classification"], agg["action"] = zip(*agg["final_score"].apply(classify))

    # Keep a dedicated anomaly_score field for UI/API consistency.
    # Isolation score reflects model outlier strength directly.
    agg["anomaly_score"] = agg["isolation_score"]
    agg["pharmacy_flags"] = "|".join(pharmacy_flags)

    return agg.to_dict(orient="records")


def detect_anomalies(sales_data, role="pharmacy"):
    """Detect antibiotic anomalies using Isolation Forest + rules."""
    scored_rows = score_sales_rows(sales_data, role=role)
    return [row for row in scored_rows if row.get("classification") != "NORMAL"]
