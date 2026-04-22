# risk_analyzer.py
# Calculates pharmacy risk level based on match results

def calculate_risk(
    exact_count   : int,
    probable_count: int,
    total_checked : int
) -> tuple[str, float]:
    """
    Determines risk level and risk score for a pharmacy report.

    Risk Logic:
    ┌──────────────────────────────────────────┬────────────┬──────────┐
    │ Condition                                │ Risk Level │ Score    │
    ├──────────────────────────────────────────┼────────────┼──────────┤
    │ Any Exact Match found                    │ High  🔴   │ 75-100   │
    │ Probable Matches >= 3 (no exact)         │ Medium 🟡  │ 50-74    │
    │ Probable Matches 1-2 (no exact)          │ Low  🟠    │ 25-49    │
    │ No matches at all                        │ Clear 🟢   │ 0        │
    └──────────────────────────────────────────┴────────────┴──────────┘
    """
    if total_checked == 0:
        return "Clear", 0.0

    if exact_count >= 1:
        risk_score = min(100.0, 75.0 + (exact_count * 5.0))
        return "High", round(risk_score, 2)

    elif probable_count >= 3:
        risk_score = min(74.0, 50.0 + (probable_count * 4.0))
        return "Medium", round(risk_score, 2)

    elif probable_count >= 1:
        risk_score = min(49.0, 25.0 + (probable_count * 8.0))
        return "Low", round(risk_score, 2)

    else:
        return "Clear", 0.0