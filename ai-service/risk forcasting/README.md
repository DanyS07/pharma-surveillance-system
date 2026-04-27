# Pharma Surveillance System

Pharma sales surveillance project with two runnable entrypoints:

- A Streamlit dashboard for interactive uploads and visualization
- A command-line forecasting runner for quick batch validation

## What it does

- Upload pharmacy sales data or use the bundled sample dataset
- Accept API-style JSON payloads and flatten them into forecast-ready records
- Validate and clean incoming records before forecasting
- Forecast 7 days ahead for each pharmacy-drug combination
- Combine all pharmacies in the dataset to produce area-level medicine forecasts
- Fall back to a recent-average forecast if ARIMA fails on a series
- Classify risk levels as `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`
- Visualize historical demand against the forecast

## Expected input schema

The uploaded file or normalized JSON records must contain these columns:

- `date`
- `pharmacy_id`
- `drug_name`
- `quantity`

## Project entrypoints

### 1. Launch the dashboard

```bash
python main.py
```

This starts the Streamlit UI defined in `app.py`.

### 2. Run the forecasting pipeline from the command line

```bash
python forecasting.py
```

Optional examples:

```bash
python forecasting.py synthetic_pharmacy_sales.xlsx --cadence auto --top 5
python forecasting.py your_data.csv --cadence monthly
python forecasting.py your_payload.json --cadence auto
```

## JSON input support

JSON inputs can be:

- a flat list of record objects
- a single record object
- an envelope containing records under keys like `records`, `sales`, `transactions`, `items`, or `data`

Nested objects are flattened automatically. Common incoming field names are mapped into the required schema, including:

- `transaction.date`, `sale_date`, `timestamp` -> `date`
- `pharmacy.id`, `pharmacy.code`, `pharmacy_id` -> `pharmacy_id`
- `drug.name`, `medicine_name`, `product` -> `drug_name`
- `metrics.quantity`, `qty`, `units_sold` -> `quantity`

## Local development

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Use `synthetic_pharmacy_sales.xlsx` for a quick smoke test.

## Docker deployment

Build the image:

```bash
docker build -t pharma-surveillance .
```

Run the container:

```bash
docker run --rm -p 8501:8501 pharma-surveillance
```

Open `http://localhost:8501`.

## Streamlit Cloud deployment

1. Push this project to a Git repository.
2. In Streamlit Community Cloud, create a new app from that repository.
3. Set the entrypoint to `app.py`.
4. Deploy using the included `requirements.txt` and `runtime.txt`.

## Deployment notes

- The app is configured for headless execution in `.streamlit/config.toml`.
- Python dependencies are pinned for reproducible installs.
- The Docker image exposes port `8501` and includes a health check.
- Invalid rows are dropped during cleaning, and malformed uploads return a user-visible error instead of crashing the app.
