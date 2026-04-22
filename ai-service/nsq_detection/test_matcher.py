# test_matcher.py
# Tests the full AI pipeline using dummy pharmacy report
# No MongoDB or API needed — pure logic test

import json
import pandas as pd
from app.services.drug_matcher import compute_similarity, classify
from app.services.risk_analyzer import calculate_risk

# ── Load Dummy Report ────────────────────────────────────────────────────────
with open("dummy_pharmacy_report.json", "r") as f:
    report = json.load(f)

# Load reference to see variation types
ref_df = pd.read_csv("dummy_pharmacy_reference.csv")

print("=" * 75)
print("       NSQ DETECTION — FULL PIPELINE TEST")
print("=" * 75)
print(f"Report ID    : {report['report_id']}")
print(f"Pharmacy     : {report['pharmacy_name']} ({report['pharmacy_id']})")
print(f"Officer      : {report['officer_id']}")
print(f"Period       : {report['month']} {report['year']}")
print(f"Total Records: {len(report['records'])}")
print(f"Threshold    : {report['threshold']}%")
print("=" * 75)

# ── Run Matching ─────────────────────────────────────────────────────────────
THRESHOLD    = report["threshold"]
results      = []
flagged      = []
exact_count  = 0
probable_count = 0
mismatch_count = 0

for i, record in enumerate(report["records"]):
    score                      = compute_similarity(
                                     record["pharmacy_drug_name"],
                                     record["nsq_drug_name"]
                                 )
    classification, confidence = classify(score, THRESHOLD)

    # Get variation type from reference file for display
    variation = ref_df.loc[
        ref_df["pharmacy_record_id"] == record["pharmacy_record_id"],
        "variation_type"
    ].values
    variation = variation[0] if len(variation) > 0 else "unknown"

    result = {
        "pharmacy_record_id"  : record["pharmacy_record_id"],
        "batch_number"        : record["batch_number"],
        "pharmacy_drug_name"  : record["pharmacy_drug_name"],
        "nsq_drug_name"       : record["nsq_drug_name"],
        "manufacturer"        : record["manufacturer"],
        "ban_date"            : record["ban_date"],
        "similarity_score"    : round(score, 2),
        "match_classification": classification,
        "confidence"          : confidence,
        "variation_type"      : variation,
    }
    results.append(result)

    if classification == "Exact Match":
        exact_count += 1
        flagged.append(result)
    elif classification == "Probable Match":
        probable_count += 1
        flagged.append(result)
    else:
        mismatch_count += 1

# Sort flagged by score descending
flagged.sort(key=lambda x: x["similarity_score"], reverse=True)

# ── Risk Calculation ─────────────────────────────────────────────────────────
risk_level, risk_score = calculate_risk(
    exact_count,
    probable_count,
    len(report["records"])
)

# ── Print Flagged Drugs ──────────────────────────────────────────────────────
print(f"\n🚨 FLAGGED DRUGS ({len(flagged)} found)")
print("-" * 75)

if not flagged:
    print("No flagged drugs found.")
else:
    for r in flagged:
        print(f"ID           : {r['pharmacy_record_id']}")
        print(f"Batch No     : {r['batch_number']}")
        print(f"Pharmacy Drug: {r['pharmacy_drug_name']}")
        print(f"NSQ Drug     : {r['nsq_drug_name']}")
        print(f"Manufacturer : {r['manufacturer'][:60]}...")
        print(f"Ban Date     : {r['ban_date']}")
        print(f"Score        : {r['similarity_score']}%")
        print(f"Result       : {r['match_classification']} ({r['confidence']} confidence)")
        print(f"Variation    : {r['variation_type']}")
        print("-" * 75)

# ── Summary ──────────────────────────────────────────────────────────────────
print(f"\n📊 SUMMARY")
print("=" * 75)
print(f"Total Checked    : {len(results)}")
print(f"Flagged Count    : {len(flagged)}")
print(f"Exact Matches    : {exact_count}")
print(f"Probable Matches : {probable_count}")
print(f"Mismatches       : {mismatch_count}")
print(f"\n🏥 PHARMACY RISK ASSESSMENT")
print(f"Risk Level       : {risk_level}")
print(f"Risk Score       : {risk_score}/100")

# ── Accuracy by Variation Type ───────────────────────────────────────────────
print(f"\n📋 DETECTION RATE BY VARIATION TYPE")
print("=" * 75)
results_df = pd.DataFrame(results)
for variation in results_df["variation_type"].unique():
    group   = results_df[results_df["variation_type"] == variation]
    detected = len(group[group["match_classification"] != "Mismatch"])
    total    = len(group)
    status   = "✅" if detected == total else "⚠️ "
    print(f"{status} {variation:<20} → {detected}/{total} detected")

# ── Save Results ─────────────────────────────────────────────────────────────
results_df.to_csv("test_results.csv", index=False)
print(f"\n✅ Full results saved to test_results.csv")
print("=" * 75)