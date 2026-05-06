from __future__ import annotations

from datetime import datetime
from typing import Any

import pandas as pd
from bson import ObjectId

from app.database import pharmacy_collection

RISK_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]


def _normalize_text(value: Any) -> str:
    return str(value or "").strip()


def _to_object_id(value: Any) -> ObjectId | Any:
    text = _normalize_text(value)
    if ObjectId.is_valid(text):
        return ObjectId(text)
    return text


def _build_query(pharmacy_ids: list[str] | None = None) -> dict[str, Any]:
    query: dict[str, Any] = {}
    if pharmacy_ids:
        valid_ids = [_to_object_id(value) for value in pharmacy_ids if _normalize_text(value)]
        if valid_ids:
            query["pharmacyId"] = {"$in": valid_ids}
    return query


def _load_sales_frame(pharmacy_ids: list[str] | None = None) -> pd.DataFrame:
    query = _build_query(pharmacy_ids)
    projection = {
        "pharmacyId": 1,
        "saleMonth": 1,
        "saleYear": 1,
        "drugName": 1,
        "quantity": 1,
    }
    rows = list(pharmacy_collection.find(query, projection))
    if not rows:
        return pd.DataFrame(columns=["pharmacy_id", "drug_name", "sale_date", "quantity"])

    dataframe = pd.DataFrame(rows)
    dataframe["pharmacy_id"] = dataframe["pharmacyId"].apply(_normalize_text)
    dataframe["drug_name"] = dataframe["drugName"].apply(_normalize_text)
    dataframe["quantity"] = pd.to_numeric(dataframe["quantity"], errors="coerce").fillna(0.0)
    dataframe["saleMonth"] = pd.to_numeric(dataframe["saleMonth"], errors="coerce")
    dataframe["saleYear"] = pd.to_numeric(dataframe["saleYear"], errors="coerce")
    dataframe["sale_date"] = pd.to_datetime(
        {
            "year": dataframe["saleYear"],
            "month": dataframe["saleMonth"],
            "day": 1,
        },
        errors="coerce",
    )
    dataframe = dataframe.dropna(subset=["sale_date"])
    dataframe = dataframe[(dataframe["pharmacy_id"] != "") & (dataframe["drug_name"] != "")]
    return dataframe[["pharmacy_id", "drug_name", "sale_date", "quantity"]].copy()


def _load_sales_frame_from_payload(sales: list[dict[str, Any]] | None) -> pd.DataFrame:
    if sales is None:
        return pd.DataFrame(columns=["pharmacy_id", "drug_name", "sale_date", "quantity"])

    dataframe = pd.DataFrame(sales)
    if dataframe.empty:
        return pd.DataFrame(columns=["pharmacy_id", "drug_name", "sale_date", "quantity"])

    rename_map = {
        "pharmacyId": "pharmacy_id",
        "pharmacy_id": "pharmacy_id",
        "drugName": "drug_name",
        "drug_name": "drug_name",
        "quantity": "quantity",
        "quantitySold": "quantity",
        "quantity_sold": "quantity",
        "month": "saleMonth",
        "saleMonth": "saleMonth",
        "year": "saleYear",
        "saleYear": "saleYear",
    }
    dataframe = dataframe.rename(columns={key: value for key, value in rename_map.items() if key in dataframe.columns})

    if "pharmacy_id" not in dataframe.columns:
        dataframe["pharmacy_id"] = ""
    if "drug_name" not in dataframe.columns:
        dataframe["drug_name"] = ""
    if "quantity" not in dataframe.columns:
        dataframe["quantity"] = 0
    if "saleMonth" not in dataframe.columns:
        dataframe["saleMonth"] = None
    if "saleYear" not in dataframe.columns:
        dataframe["saleYear"] = None

    dataframe["pharmacy_id"] = dataframe["pharmacy_id"].apply(_normalize_text)
    dataframe["drug_name"] = dataframe["drug_name"].apply(_normalize_text)
    dataframe["quantity"] = pd.to_numeric(dataframe["quantity"], errors="coerce").fillna(0.0)
    dataframe["saleMonth"] = pd.to_numeric(dataframe["saleMonth"], errors="coerce")
    dataframe["saleYear"] = pd.to_numeric(dataframe["saleYear"], errors="coerce")
    dataframe["sale_date"] = pd.to_datetime(
        {
            "year": dataframe["saleYear"],
            "month": dataframe["saleMonth"],
            "day": 1,
        },
        errors="coerce",
    )

    dataframe = dataframe.dropna(subset=["sale_date"])
    dataframe = dataframe[(dataframe["pharmacy_id"] != "") & (dataframe["drug_name"] != "")]
    return dataframe[["pharmacy_id", "drug_name", "sale_date", "quantity"]].copy()


def _infer_cadence(series: pd.Series) -> str:
    if len(series) < 2:
        return "monthly"

    month_deltas = series.index.to_series().sort_values().diff().dropna().dt.days
    if month_deltas.empty:
        return "monthly"

    median_delta = float(month_deltas.median())
    return "monthly" if median_delta >= 28 else "daily"


def _prepare_series(group: pd.DataFrame) -> tuple[pd.Series, str]:
    series = group.sort_values("sale_date").set_index("sale_date")["quantity"]
    cadence = _infer_cadence(series)

    if cadence == "monthly":
        normalized_index = series.index.to_period("M").to_timestamp()
        series = pd.Series(series.values, index=normalized_index)
        series = series.groupby(level=0).sum().sort_index()
        full_index = pd.date_range(series.index.min(), series.index.max(), freq="MS")
    else:
        series = series.groupby(level=0).sum().sort_index()
        full_index = pd.date_range(series.index.min(), series.index.max(), freq="D")

    return series.reindex(full_index, fill_value=0.0).astype(float), cadence


def _classify_risk(predicted_avg: float, recent_avg: float) -> str:
    if recent_avg <= 0:
        return "MEDIUM" if predicted_avg > 0 else "LOW"
    if predicted_avg > recent_avg * 1.5:
        return "CRITICAL"
    if predicted_avg > recent_avg * 1.2:
        return "HIGH"
    if predicted_avg > recent_avg:
        return "MEDIUM"
    return "LOW"


def _build_forecast(series: pd.Series, cadence: str) -> tuple[list[float], int]:
    forecast_steps = 3 if cadence == "monthly" else 7
    recent = series.tail(min(len(series), forecast_steps)).astype(float)

    if recent.empty:
        return [0.0] * forecast_steps, forecast_steps

    if len(recent) == 1:
        return [float(recent.iloc[-1])] * forecast_steps, forecast_steps

    slope = (float(recent.iloc[-1]) - float(recent.iloc[0])) / max(len(recent) - 1, 1)
    last_value = float(recent.iloc[-1])
    forecast = []
    for step in range(1, forecast_steps + 1):
        forecast.append(max(0.0, last_value + slope * step))
    return forecast, forecast_steps


def _summarize_groups(aggregated: pd.DataFrame, grouping_columns: list[str]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []

    if aggregated.empty:
        return results

    for group_key, group in aggregated.groupby(grouping_columns):
        if not isinstance(group_key, tuple):
            group_key = (group_key,)

        series, cadence = _prepare_series(group)
        minimum_points = 3 if cadence == "monthly" else 7
        if len(series) < minimum_points:
            continue

        forecast_values, forecast_steps = _build_forecast(series, cadence)
        recent_avg = float(series.tail(forecast_steps).mean())
        predicted_avg = float(sum(forecast_values) / len(forecast_values)) if forecast_values else 0.0
        risk_level = _classify_risk(predicted_avg, recent_avg)

        # prepare history and forecast time points for plotting
        if cadence == "monthly":
            history_len = 12
            last_date = series.index.max()
            # monthly forecast dates: add months
            forecast_dates = [(last_date + pd.DateOffset(months=i)).to_pydatetime() for i in range(1, forecast_steps + 1)]
        else:
            history_len = 30
            last_date = series.index.max()
            forecast_dates = [(last_date + pd.Timedelta(days=i)).to_pydatetime() for i in range(1, forecast_steps + 1)]

        history_series = series.tail(history_len)
        history = [
            {"date": d.isoformat(), "value": float(v)}
            for d, v in zip(history_series.index.to_pydatetime(), history_series.values)
        ]

        forecast_points = [
            {"date": d.isoformat(), "value": float(v)}
            for d, v in zip(forecast_dates, forecast_values)
        ]

        row = {column_name: column_value for column_name, column_value in zip(grouping_columns, group_key)}
        row.update(
            {
                "recent_avg": round(recent_avg, 2),
                "predicted_avg": round(predicted_avg, 2),
                "risk_level": risk_level,
                "cadence": "Monthly" if cadence == "monthly" else "Daily",
                "forecast_horizon": forecast_steps,
                "forecast_values": [round(value, 2) for value in forecast_values],
                "history": history,
                "forecast_points": forecast_points,
            }
        )
        results.append(row)

    results.sort(
        key=lambda item: (
            RISK_ORDER.index(item["risk_level"]) if item["risk_level"] in RISK_ORDER else len(RISK_ORDER),
            -item["predicted_avg"],
            str(item.get("pharmacy_id", "")),
            str(item.get("drug_name", "")),
        )
    )
    return results


def run_risk_forecast(
    pharmacy_ids: list[str] | None = None,
    top: int = 20,
    sales: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    dataframe = _load_sales_frame_from_payload(sales) if sales is not None else _load_sales_frame(pharmacy_ids)
    if dataframe.empty:
        return {
            "success": True,
            "generatedAt": datetime.utcnow().isoformat() + "Z",
            "summary": {
                "totalGroups": 0,
                "highRisk": 0,
                "mediumRisk": 0,
                "criticalRisk": 0,
                "lowRisk": 0,
                "monitored": 0,
            },
            "pharmacyResults": [],
            "areaResults": [],
        }

    pharmacy_aggregated = (
        dataframe.groupby(["sale_date", "pharmacy_id", "drug_name"], as_index=False)["quantity"]
        .sum()
        .sort_values(["pharmacy_id", "drug_name", "sale_date"])
    )
    area_aggregated = (
        dataframe.groupby(["sale_date", "drug_name"], as_index=False)["quantity"]
        .sum()
        .sort_values(["drug_name", "sale_date"])
    )

    pharmacy_results = _summarize_groups(pharmacy_aggregated, ["pharmacy_id", "drug_name"])
    area_results = _summarize_groups(area_aggregated, ["drug_name"])

    def _count(risk_level: str, rows: list[dict[str, Any]]) -> int:
        return sum(1 for row in rows if row["risk_level"] == risk_level)

    combined = pharmacy_results + area_results
    summary = {
        "totalGroups": len(pharmacy_results),
        "highRisk": _count("HIGH", pharmacy_results) + _count("HIGH", area_results),
        "mediumRisk": _count("MEDIUM", pharmacy_results) + _count("MEDIUM", area_results),
        "criticalRisk": _count("CRITICAL", pharmacy_results) + _count("CRITICAL", area_results),
        "lowRisk": _count("LOW", pharmacy_results) + _count("LOW", area_results),
        "monitored": sum(1 for row in combined if row["risk_level"] in {"MEDIUM", "HIGH", "CRITICAL"}),
    }

    return {
        "success": True,
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "summary": summary,
        "pharmacyResults": pharmacy_results[:top],
        "areaResults": area_results[:top],
    }
