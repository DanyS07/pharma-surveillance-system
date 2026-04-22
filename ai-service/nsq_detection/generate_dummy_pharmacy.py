# generate_dummy_pharmacy.py
# Simulates exactly what MERN backend sends to AI service
# after MongoDB batch matching for ONE pharmacy's monthly report

import pandas as pd
import random
import json

# ── Load Real NSQ Data ───────────────────────────────────────────────────────
nsq_df = pd.read_csv("nsq_data.csv")
nsq_df.columns = ["drugName", "batchNumber", "manufacturer", "reportMonth"]
nsq_df = nsq_df.dropna(subset=["batchNumber", "drugName"])
nsq_df["batchNumber"]  = nsq_df["batchNumber"].astype(str).str.strip()
nsq_df["drugName"]     = nsq_df["drugName"].astype(str).str.strip()
nsq_df["reportMonth"]  = nsq_df["reportMonth"].astype(str).str.strip()
nsq_df["manufacturer"] = nsq_df["manufacturer"].astype(str).str.strip()

print(f"✅ Loaded {len(nsq_df)} NSQ records")

# ── Drug Name Variation Simulator ────────────────────────────────────────────
def make_variation(drug_name: str, variation_type: str) -> str:
    """
    Simulates how a pharmacy might write a drug name
    differently from the NSQ record.
    """
    if variation_type == "exact":
        return drug_name

    elif variation_type == "abbreviation":
        name = drug_name
        name = name.replace("Tablets",    "Tab")
        name = name.replace("Capsules",   "Cap")
        name = name.replace("Injection",  "Inj")
        name = name.replace("Syrup",      "Syp")
        name = name.replace("Suspension", "Susp")
        name = name.replace("Solution",   "Sol")
        return name

    elif variation_type == "uppercase":
        return drug_name.upper()

    elif variation_type == "lowercase":
        return drug_name.lower()

    elif variation_type == "brand_only":
        # Only keep brand name — drop generic name in brackets
        if "(" in drug_name:
            return drug_name.split("(")[0].strip()
        return drug_name

    elif variation_type == "generic_only":
        # Only keep generic name from inside brackets
        if "(" in drug_name and ")" in drug_name:
            return drug_name.split("(")[1].replace(")", "").strip()
        return drug_name

    elif variation_type == "spelling_error":
        replacements = {
            "Amoxycillin"   : "Amoxicillin",
            "Amoxicillin"   : "Amoxycillin",
            "Paracetamol"   : "Parcetamol",
            "Ciprofloxacin" : "Ciprofloxacine",
            "Metformin"     : "Metfromin",
            "Ranitidine"    : "Ranitidin",
            "Pantoprazole"  : "Pantoprazol",
        }
        for original, replacement in replacements.items():
            if original in drug_name:
                return drug_name.replace(original, replacement)
        return drug_name

    elif variation_type == "wrong_drug":
        # Completely different drug — should be Mismatch
        wrong_drugs = [
            "Vitamin C 500mg Tablets",
            "Zinc Sulphate 20mg Tablets",
            "ORS Powder Sachet",
            "Calcium Carbonate Tablets",
            "Iron Folic Acid Tablets",
        ]
        return random.choice(wrong_drugs)

    return drug_name


# ── Sample NSQ Records ───────────────────────────────────────────────────────
random.seed(42)
sample_nsq = nsq_df.sample(
    n=min(30, len(nsq_df)),
    random_state=42
).reset_index(drop=True)

# ── Variation Distribution ───────────────────────────────────────────────────
variation_types = (
    ["exact"]          * 5  +
    ["abbreviation"]   * 7  +
    ["uppercase"]      * 3  +
    ["lowercase"]      * 3  +
    ["brand_only"]     * 4  +
    ["generic_only"]   * 3  +
    ["spelling_error"] * 3  +
    ["wrong_drug"]     * 2
)
random.shuffle(variation_types)

# ── Build Matched Records ────────────────────────────────────────────────────
records     = []
records_ref = []   # reference copy with variation_type for testing

for i, (_, row) in enumerate(sample_nsq.iterrows()):
    variation = variation_types[i] if i < len(variation_types) else "exact"

    record = {
        "pharmacy_record_id" : f"REC{str(i+1).zfill(4)}",
        "batch_number"       : row["batchNumber"],
        "pharmacy_drug_name" : make_variation(row["drugName"], variation),
        "nsq_drug_name"      : row["drugName"],
        "ban_date"           : row["reportMonth"],
        "manufacturer"       : row["manufacturer"],
    }

    records.append(record)
    records_ref.append({**record, "variation_type": variation})

# ── Build Full Payload ───────────────────────────────────────────────────────
# This is exactly what the MERN backend will POST to /api/nsq/analyse
pharmacy_report = {
    "report_id"    : "RPT-PH001-2024-01",
    "pharmacy_id"  : "PH001",
    "pharmacy_name": "MedPlus Pharmacy",
    "officer_id"   : "OFF001",
    "month"        : "January",
    "year"         : 2024,
    "threshold"    : 80.0,
    "records"      : records,
}

# ── Save Files ───────────────────────────────────────────────────────────────
with open("dummy_pharmacy_report.json", "w") as f:
    json.dump(pharmacy_report, f, indent=2)

pd.DataFrame(records_ref).to_csv("dummy_pharmacy_reference.csv", index=False)

print(f"✅ Generated report with {len(records)} matched records")
print(f"\nVariation breakdown:")
print(pd.DataFrame(records_ref)["variation_type"].value_counts().to_string())
print(f"\nSaved:")
print(f"  dummy_pharmacy_report.json    ← API test payload")
print(f"  dummy_pharmacy_reference.csv  ← your reference")