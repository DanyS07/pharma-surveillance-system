from __future__ import annotations

import argparse
import json
import re
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd
from statsmodels.tsa.arima.model import ARIMA

REQUIRED_COLUMNS = {"date", "pharmacy_id", "drug_name", "quantity"}
REFERENCE_DATASET_COLUMNS = {
    "standard_name",
    "brand_names",
    "antibiotic_class",
    "drug_group",
    "common_forms",
    "common_strengths",
    "synonyms",
}
COLUMN_ALIASES = {
    "date": "date",
    "sale_date": "date",
    "transaction_date": "date",
    "timestamp": "date",
    "pharmacy_id": "pharmacy_id",
    "pharmacy": "pharmacy_id",
    "pharmacyid": "pharmacy_id",
    "pharmacy_code": "pharmacy_id",
    "drug_name": "drug_name",
    "drug": "drug_name",
    "medicine": "drug_name",
    "medicine_name": "drug_name",
    "product": "drug_name",
    "quantity": "quantity",
    "qty": "quantity",
    "units": "quantity",
    "units_sold": "quantity",
    "quantity_sold": "quantity",
    "sales_quantity": "quantity",
}
JSON_RECORD_COLLECTION_KEYS = (
    "records",
    "sales",
    "transactions",
    "items",
    "data",
    "results",
    "payload",
)
SUPPORTED_FREQUENCIES = {
    "daily": {"freq": "D", "label": "Daily", "default_steps": 7, "min_points": 14},
    "monthly": {"freq": "MS", "label": "Monthly", "default_steps": 3, "min_points": 3},
}
CADENCE_OPTIONS = {
    "auto": "Auto-detect",
    "daily": "Daily",
    "monthly": "Monthly",
}


@dataclass(frozen=True)
class ForecastMetadata:
    model_type: str
    recent_avg: float
    predicted_avg: float
    risk_level: str
    cadence: str
    forecast_steps: int


def normalize_field_name(name: Any) -> str:
    normalized = re.sub(r"[\s\-/\.]+", "_", str(name).strip().lower())
    normalized = re.sub(r"_+", "_", normalized)
    return normalized.strip("_")


def resolve_column_alias(column_name: Any) -> str:
    normalized_name = normalize_field_name(column_name)
    if normalized_name in COLUMN_ALIASES:
        return COLUMN_ALIASES[normalized_name]

    parts = [part for part in normalized_name.split("_") if part]
    suffixes = ["_".join(parts[index:]) for index in range(len(parts))]
    for suffix in suffixes:
        if suffix in COLUMN_ALIASES:
            return COLUMN_ALIASES[suffix]

    part_set = set(parts)
    if "date" in part_set or "timestamp" in part_set:
        return "date"
    if "pharmacy" in part_set and ({"id", "code"} & part_set):
        return "pharmacy_id"
    if {"drug", "medicine", "product"} & part_set and "name" in part_set:
        return "drug_name"
    if {"drug", "medicine", "product"} & part_set and len(part_set) == 1:
        return "drug_name"
    if {"quantity", "qty", "units"} & part_set:
        return "quantity"
    return normalized_name


def _extract_record_list(payload: Any) -> list[dict[str, Any]] | None:
    if isinstance(payload, list):
        if payload and all(isinstance(item, dict) for item in payload):
            return payload
        return None

    if isinstance(payload, dict):
        for key in JSON_RECORD_COLLECTION_KEYS:
            candidate = payload.get(key)
            extracted = _extract_record_list(candidate)
            if extracted is not None:
                return extracted

        for value in payload.values():
            extracted = _extract_record_list(value)
            if extracted is not None:
                return extracted

        return [payload]

    return None


def dataframe_from_json_payload(payload: Any) -> pd.DataFrame:
    records = _extract_record_list(payload)
    if records is None:
        raise ValueError(
            "JSON input must be a record object, a list of record objects, or an envelope containing one."
        )

    dataframe = pd.json_normalize(records, sep="_")
    if dataframe.empty:
        raise ValueError("JSON input did not contain any usable records.")
    return dataframe


def coalesce_duplicate_columns(df: pd.DataFrame) -> pd.DataFrame:
    if not df.columns.duplicated().any():
        return df

    consolidated: dict[str, pd.Series] = {}
    for column_name in dict.fromkeys(df.columns):
        column_frame = df.loc[:, df.columns == column_name]
        if isinstance(column_frame, pd.Series):
            consolidated[column_name] = column_frame
        else:
            consolidated[column_name] = column_frame.bfill(axis=1).iloc[:, 0]
    return pd.DataFrame(consolidated)


def sort_results_frame(results_df: pd.DataFrame, grouping_columns: list[str]) -> pd.DataFrame:
    if results_df.empty:
        return results_df

    ordered = results_df.copy()
    ordered["risk_level"] = pd.Categorical(
        ordered["risk_level"],
        categories=["CRITICAL", "HIGH", "MEDIUM", "LOW"],
        ordered=True,
    )
    ordered = ordered.sort_values(
        ["risk_level", *grouping_columns],
        ascending=[True, *([True] * len(grouping_columns))],
    ).reset_index(drop=True)
    ordered["risk_level"] = ordered["risk_level"].astype(str)
    return ordered


def transform_dataset(df: pd.DataFrame) -> pd.DataFrame:
    transformed = df.copy()

    normalized_names = {
        column: normalize_field_name(column)
        for column in transformed.columns
    }

    quantity_source = next(
        (
            column
            for column, normalized in normalized_names.items()
            if normalized == "quantity_sold"
        ),
        None,
    )
    if quantity_source is not None and "quantity" not in transformed.columns:
        transformed = transformed.rename(columns={quantity_source: "quantity"})

    normalized_names = {
        column: normalize_field_name(column)
        for column in transformed.columns
    }

    month_column = next(
        (column for column, normalized in normalized_names.items() if normalized == "month"),
        None,
    )
    year_column = next(
        (column for column, normalized in normalized_names.items() if normalized == "year"),
        None,
    )
    if month_column is not None and year_column is not None and "date" not in transformed.columns:
        transformed["date"] = pd.to_datetime(
            transformed[year_column].astype(str)
            + "-"
            + transformed[month_column].astype(str)
            + "-01",
            errors="coerce",
        )

    if "pharmacy_id" not in transformed.columns:
        transformed["pharmacy_id"] = "PH001"

    return transformed


def classify_risk(predicted_avg: float, recent_avg: float) -> str:
    if recent_avg <= 0:
        return "MEDIUM" if predicted_avg > 0 else "LOW"
    if predicted_avg > recent_avg * 1.5:
        return "CRITICAL"
    if predicted_avg > recent_avg * 1.2:
        return "HIGH"
    if predicted_avg > recent_avg:
        return "MEDIUM"
    return "LOW"


def validate_input_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    transformed = transform_dataset(df)

    normalized_columns = {}
    for column in transformed.columns:
        normalized_columns[column] = resolve_column_alias(column)

    cleaned = transformed.rename(columns=normalized_columns).copy()
    cleaned = coalesce_duplicate_columns(cleaned)
    missing_columns = REQUIRED_COLUMNS.difference(cleaned.columns)
    if missing_columns:
        normalized_input_columns = set(normalized_columns.values())
        if REFERENCE_DATASET_COLUMNS.issubset(normalized_input_columns):
            raise ValueError(
                "This file looks like an antibiotic reference catalog, not pharmacy sales data. "
                "Forecasting needs transaction-style columns such as date, pharmacy_id, drug_name, "
                "and quantity."
            )
        missing_list = ", ".join(sorted(missing_columns))
        available_list = ", ".join(map(str, df.columns))
        raise ValueError(
            f"Missing required columns: {missing_list}. Found columns: {available_list}"
        )

    cleaned["date"] = pd.to_datetime(cleaned["date"], errors="coerce")
    cleaned["quantity"] = pd.to_numeric(cleaned["quantity"], errors="coerce")
    cleaned["pharmacy_id"] = cleaned["pharmacy_id"].astype(str).str.strip()
    cleaned["drug_name"] = cleaned["drug_name"].astype(str).str.strip()

    cleaned = cleaned.dropna(subset=["date", "quantity"])
    cleaned = cleaned[
        (cleaned["pharmacy_id"] != "")
        & (cleaned["drug_name"] != "")
        & (cleaned["quantity"] >= 0)
    ]

    if cleaned.empty:
        raise ValueError("No valid rows remain after cleaning the uploaded data.")

    return cleaned


def infer_cadence(series: pd.Series) -> str:
    if len(series) < 2:
        return "daily"

    day_deltas = series.index.to_series().sort_values().diff().dropna().dt.days
    if day_deltas.empty:
        return "daily"

    median_delta = float(day_deltas.median())
    if median_delta >= 28:
        return "monthly"
    return "daily"


def prepare_series(group: pd.DataFrame, cadence_override: str = "auto") -> tuple[pd.Series, str]:
    series = group.sort_values("date").set_index("date")["quantity"]
    cadence = cadence_override if cadence_override in SUPPORTED_FREQUENCIES else infer_cadence(series)
    freq = SUPPORTED_FREQUENCIES[cadence]["freq"]

    if cadence == "monthly":
        normalized_index = series.index.to_period("M").to_timestamp()
        series = pd.Series(series.values, index=normalized_index)
        series = series.groupby(level=0).sum().sort_index()
    else:
        series = series.groupby(level=0).sum().sort_index()

    full_index = pd.date_range(series.index.min(), series.index.max(), freq=freq)
    return series.reindex(full_index, fill_value=0.0).astype(float), cadence


def build_forecast(series: pd.Series, cadence: str) -> tuple[pd.Series, str, int]:
    frequency_config = SUPPORTED_FREQUENCIES[cadence]
    forecast_steps = frequency_config["default_steps"]
    forecast_index = pd.date_range(
        series.index.max(),
        periods=forecast_steps + 1,
        freq=frequency_config["freq"],
    )[1:]

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            fitted_model = ARIMA(series, order=(1, 1, 1)).fit()
        forecast_values = fitted_model.forecast(steps=forecast_steps)
        forecast = pd.Series(forecast_values.values, index=forecast_index)
        return forecast, "ARIMA(1,1,1)", forecast_steps
    except Exception:
        fallback_value = float(series.tail(forecast_steps).mean())
        fallback_forecast = pd.Series(
            [fallback_value] * forecast_steps,
            index=forecast_index,
            dtype=float,
        )
        return fallback_forecast, "RecentAvgFallback", forecast_steps


def _run_grouped_forecast(
    aggregated: pd.DataFrame,
    grouping_columns: list[str],
    cadence_override: str = "auto",
) -> tuple[pd.DataFrame, dict]:
    results = []
    forecasts = {}

    for group_key, group in aggregated.groupby(grouping_columns):
        if not isinstance(group_key, tuple):
            group_key = (group_key,)

        series, cadence = prepare_series(group, cadence_override=cadence_override)
        min_points = SUPPORTED_FREQUENCIES[cadence]["min_points"]

        if len(series) < min_points:
            continue

        forecast, model_type, forecast_steps = build_forecast(series, cadence)
        recent_avg = float(series.tail(forecast_steps).mean())
        predicted_avg = float(forecast.mean())
        risk_level = classify_risk(predicted_avg, recent_avg)
        metadata = ForecastMetadata(
            model_type=model_type,
            recent_avg=recent_avg,
            predicted_avg=predicted_avg,
            risk_level=risk_level,
            cadence=SUPPORTED_FREQUENCIES[cadence]["label"],
            forecast_steps=forecast_steps,
        )

        result_row = {
            column_name: column_value
            for column_name, column_value in zip(grouping_columns, group_key)
        }
        result_row.update(
            {
                "recent_avg": round(metadata.recent_avg, 2),
                "predicted_avg": round(metadata.predicted_avg, 2),
                "risk_level": metadata.risk_level,
                "model_type": metadata.model_type,
                "cadence": metadata.cadence,
                "forecast_horizon": metadata.forecast_steps,
            }
        )
        results.append(result_row)

        forecasts[group_key] = {
            "history": series,
            "forecast": forecast,
            "metadata": metadata,
        }

    results_df = pd.DataFrame(results)
    return sort_results_frame(results_df, grouping_columns), forecasts


def run_forecast_pipeline(df: pd.DataFrame, cadence_override: str = "auto") -> tuple[pd.DataFrame, dict]:
    cleaned = validate_input_dataframe(df)
    aggregated = (
        cleaned.groupby(["date", "pharmacy_id", "drug_name"], as_index=False)["quantity"]
        .sum()
        .sort_values(["pharmacy_id", "drug_name", "date"])
    )

    pharmacy_results, pharmacy_forecasts = _run_grouped_forecast(
        aggregated,
        grouping_columns=["pharmacy_id", "drug_name"],
        cadence_override=cadence_override,
    )

    area_aggregated = (
        cleaned.groupby(["date", "drug_name"], as_index=False)["quantity"]
        .sum()
        .sort_values(["drug_name", "date"])
    )
    area_results, area_forecasts = _run_grouped_forecast(
        area_aggregated,
        grouping_columns=["drug_name"],
        cadence_override=cadence_override,
    )
    if not area_results.empty:
        area_results.insert(0, "scope", "All Pharmacies Combined")

    return pharmacy_results, pharmacy_forecasts, area_results, area_forecasts


def run_forecast_pipeline_from_json(
    payload: Any, cadence_override: str = "auto"
) -> tuple[pd.DataFrame, dict, pd.DataFrame, dict]:
    dataset = dataframe_from_json_payload(payload)
    return run_forecast_pipeline(dataset, cadence_override=cadence_override)


def load_input_dataset(file_path: str | Path) -> pd.DataFrame:
    path = Path(file_path)
    suffix = path.suffix.lower()
    if suffix == ".xlsx":
        return pd.read_excel(path)
    if suffix == ".csv":
        return pd.read_csv(path)
    if suffix == ".json":
        with path.open("r", encoding="utf-8") as file:
            payload = json.load(file)
        return dataframe_from_json_payload(payload)
    raise ValueError(f"Unsupported file type '{path.suffix}'. Use .xlsx, .csv, or .json input.")


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
        "Run the pharmacy surveillance forecasting pipeline on a local dataset "
        "and print the resulting risk summary."
        )
    )
    parser.add_argument(
        "input_file",
        nargs="?",
        default="synthetic_pharmacy_sales.xlsx",
        help="Path to the input dataset (.xlsx, .csv, or .json). Defaults to the bundled sample file.",
    )
    parser.add_argument(
        "--cadence",
        choices=list(CADENCE_OPTIONS.keys()),
        default="auto",
        help="Forecast cadence mode. Defaults to auto-detect.",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=10,
        help="Number of rows to print from the forecast summary. Defaults to 10.",
    )
    return parser


def main() -> int:
    parser = build_cli_parser()
    args = parser.parse_args()

    dataset = load_input_dataset(args.input_file)
    results, _, area_results, _ = run_forecast_pipeline(
        dataset, cadence_override=args.cadence
    )

    if results.empty:
        print("No pharmacy-drug groups had enough history to generate a forecast.")
        return 0

    print("Per-pharmacy forecast summary")
    print(results.head(args.top).to_string(index=False))
    print()
    print(f"Generated forecasts for {len(results)} pharmacy-drug combinations.")
    if not area_results.empty:
        print()
        print("All-pharmacy combined medicine summary")
        print(area_results.head(args.top).to_string(index=False))
        print()
        print(
            f"Generated area-level forecasts for {len(area_results)} medicines across all pharmacies."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
