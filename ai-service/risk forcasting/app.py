from pathlib import Path
import json

import pandas as pd
import streamlit as st

from forecasting import CADENCE_OPTIONS, dataframe_from_json_payload, run_forecast_pipeline
from visuals import plot_forecast

SAMPLE_DATA_PATH = Path("synthetic_pharmacy_sales.xlsx")
RISK_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]


@st.cache_data
def load_uploaded_data(uploaded_file) -> pd.DataFrame:
    if uploaded_file.name.endswith(".xlsx"):
        return pd.read_excel(uploaded_file)
    if uploaded_file.name.endswith(".json"):
        return dataframe_from_json_payload(json.load(uploaded_file))
    return pd.read_csv(uploaded_file)


@st.cache_data
def load_sample_data() -> pd.DataFrame:
    return pd.read_excel(SAMPLE_DATA_PATH)


def render_results(results: pd.DataFrame, forecasts: dict) -> None:
    if results.empty:
        st.warning("No pharmacy-drug groups had enough history to generate a forecast.")
        return

    ordered_results = results.copy()
    ordered_results["risk_level"] = pd.Categorical(
        ordered_results["risk_level"], categories=RISK_ORDER, ordered=True
    )
    ordered_results = ordered_results.sort_values(
        ["risk_level", "pharmacy_id", "drug_name"]
    ).reset_index(drop=True)

    critical_count = int((ordered_results["risk_level"] == "CRITICAL").sum())
    high_count = int((ordered_results["risk_level"] == "HIGH").sum())
    monitored_count = int(
        ordered_results["risk_level"].isin(["MEDIUM", "HIGH", "CRITICAL"]).sum()
    )
    cadence_summary = ", ".join(sorted(ordered_results["cadence"].unique()))

    metric_columns = st.columns(3)
    metric_columns[0].metric("Forecasted combinations", len(ordered_results))
    metric_columns[1].metric("High/Critical alerts", critical_count + high_count)
    metric_columns[2].metric("Combinations to monitor", monitored_count)
    st.caption(f"Detected forecasting cadence: {cadence_summary}")

    st.subheader("Risk Assessment Results")
    st.dataframe(ordered_results, width="stretch")

    st.subheader("Forecast Visualization")
    pharmacies = sorted(ordered_results["pharmacy_id"].unique())
    selected_pharmacy = st.selectbox("Select Pharmacy", pharmacies)
    selected_drugs = sorted(
        ordered_results.loc[
        ordered_results["pharmacy_id"] == selected_pharmacy, "drug_name"
        ].unique()
    )
    selected_drug = st.selectbox("Select Drug", selected_drugs)
    st.pyplot(
        plot_forecast(
            forecasts,
            (selected_pharmacy, selected_drug),
            f"{selected_pharmacy} - {selected_drug}",
        )
    )

    high_risk = ordered_results[ordered_results["risk_level"].isin(["HIGH", "CRITICAL"])]
    st.subheader("High Risk Alerts")
    if high_risk.empty:
        st.success("No HIGH or CRITICAL risk combinations were detected.")
    else:
        st.dataframe(high_risk, width="stretch")


def render_area_results(results: pd.DataFrame, forecasts: dict) -> None:
    if results.empty:
        st.warning("No medicine groups had enough history to generate an area-level forecast.")
        return

    ordered_results = results.copy()
    ordered_results["risk_level"] = pd.Categorical(
        ordered_results["risk_level"], categories=RISK_ORDER, ordered=True
    )
    ordered_results = ordered_results.sort_values(["risk_level", "drug_name"]).reset_index(
        drop=True
    )

    critical_count = int((ordered_results["risk_level"] == "CRITICAL").sum())
    high_count = int((ordered_results["risk_level"] == "HIGH").sum())
    monitored_count = int(
        ordered_results["risk_level"].isin(["MEDIUM", "HIGH", "CRITICAL"]).sum()
    )
    cadence_summary = ", ".join(sorted(ordered_results["cadence"].unique()))

    metric_columns = st.columns(3)
    metric_columns[0].metric("Medicines forecasted", len(ordered_results))
    metric_columns[1].metric("High/Critical medicine alerts", critical_count + high_count)
    metric_columns[2].metric("Medicines to monitor", monitored_count)
    st.caption(f"Detected forecasting cadence: {cadence_summary}")

    st.subheader("Area-Level Medicine Summary")
    st.dataframe(ordered_results, width="stretch")

    st.subheader("Area-Level Forecast Visualization")
    selected_drug = st.selectbox("Select Medicine", sorted(ordered_results["drug_name"].unique()))
    st.pyplot(plot_forecast(forecasts, (selected_drug,), f"All Pharmacies - {selected_drug}"))

    high_risk = ordered_results[ordered_results["risk_level"].isin(["HIGH", "CRITICAL"])]
    st.subheader("Area-Level High Risk Alerts")
    if high_risk.empty:
        st.success("No HIGH or CRITICAL area-level medicine alerts were detected.")
    else:
        st.dataframe(high_risk, width="stretch")


st.set_page_config(page_title="Pharma Surveillance System", layout="wide")
st.title("Pharma Surveillance System")
st.write(
    "Forecast medicine demand at both pharmacy level and all-pharmacies-combined area level from uploaded sales data."
)

uploaded_file = st.file_uploader("Upload sales data (.xlsx, .csv, or .json)", type=["xlsx", "csv", "json"])
use_sample_data = st.toggle("Use bundled sample dataset", value=uploaded_file is None)
cadence_override = st.selectbox(
    "Forecast cadence",
    options=list(CADENCE_OPTIONS.keys()),
    format_func=lambda option: CADENCE_OPTIONS[option],
    help="Use Auto-detect for normal behavior, or force Daily/Monthly when your dataset cadence is ambiguous.",
)

try:
    if uploaded_file is not None:
        source_label = f"Uploaded file: {uploaded_file.name}"
        raw_df = load_uploaded_data(uploaded_file)
    elif use_sample_data:
        source_label = f"Bundled sample: {SAMPLE_DATA_PATH.name}"
        raw_df = load_sample_data()
    else:
        raw_df = None

    if raw_df is None:
        st.info("Upload a dataset or enable the bundled sample dataset to begin.")
    else:
        st.caption(source_label)
        st.subheader("Uploaded Data Preview")
        st.dataframe(raw_df.head(20), width="stretch")
        if cadence_override == "auto":
            st.caption("Forecast cadence mode: Auto-detect")
        else:
            st.caption(f"Forecast cadence mode: Forced {CADENCE_OPTIONS[cadence_override]}")

        with st.spinner("Running forecasting and risk detection..."):
            pharmacy_results, pharmacy_forecasts, area_results, area_forecasts = run_forecast_pipeline(
                raw_df, cadence_override=cadence_override
            )

        pharmacy_tab, area_tab = st.tabs(
            ["Per-Pharmacy Analysis", "All Pharmacies Combined Analysis"]
        )
        with pharmacy_tab:
            render_results(pharmacy_results, pharmacy_forecasts)
        with area_tab:
            render_area_results(area_results, area_forecasts)
except Exception as exc:
    st.error(f"Unable to process this dataset: {exc}")
    st.stop()
