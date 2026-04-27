code = '''import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import LabelEncoder
import joblib
import os

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

def load_antibiotic_reference(ref_path="data/antibiotic_reference_dataset.csv"):
    ref = pd.read_csv(ref_path)
    keywords = set()
    for _, row in ref.iterrows():
        keywords.add(row["standard_name"].lower().strip())
        if pd.notna(row["synonyms"]):
            for s in row["synonyms"].split("|"):
                s = s.lower().strip()
                if len(s) >= 6:
                    keywords.add(s)
        if pd.notna(row["brand_names"]):
            for b in row["brand_names"].split("|"):
                b = b.lower().strip()
                if len(b) >= 6:
                    keywords.add(b)
    return keywords

def filter_antibiotics(df, ref_path="data/antibiotic_reference_dataset.csv"):
    keywords = load_antibiotic_reference(ref_path)

    def is_antibiotic(drug_name):
        name_lower = drug_name.lower()
        for ex in EXCLUDE_KEYWORDS:
            if ex in name_lower:
                return False
        for keyword in keywords:
            if keyword in name_lower:
                return True
        return False

    mask = df["drug_name"].apply(is_antibiotic)
    filtered = df[mask].copy()
    print(f"Found {len(filtered)} antibiotic records out of {len(df)} total")
    return filtered

def load_data(path="data/sample_sales.csv"):
    df = pd.read_csv(path)
    df = filter_antibiotics(df)
    return df

def preprocess(df):
    df = df.copy()
    le_drug = LabelEncoder()
    df["drug_encoded"] = le_drug.fit_transform(df["drug_name"])
    features = df[["drug_encoded", "quantity_sold", "unit_price"]]
    return features, df, le_drug

def train_model(features):
    model = IsolationForest(contamination=0.05, random_state=42)
    model.fit(features)
    os.makedirs("models", exist_ok=True)
    joblib.dump(model, "models/anomaly_model.pkl")
    print("Model trained and saved!")
    return model

def detect_anomalies(df=None, path="data/sample_sales.csv"):
    if df is None:
        df = load_data(path)
    if len(df) == 0:
        print("No antibiotic records found!")
        return []
    features, df_copy, le_drug = preprocess(df)
    if os.path.exists("models/anomaly_model.pkl"):
        model = joblib.load("models/anomaly_model.pkl")
    else:
        model = train_model(features)
    df_copy["anomaly_score"] = model.decision_function(features)
    df_copy["is_anomaly"] = model.predict(features)
    df_copy["is_anomaly"] = df_copy["is_anomaly"].map({1: False, -1: True})
    anomalies = df_copy[df_copy["is_anomaly"] == True][[
        "record_id", "drug_name", "batch_number",
        "quantity_sold", "unit_price", "month", "year", "anomaly_score"
    ]]
    return anomalies.to_dict(orient="records")
'''

with open('detector.py', 'w', encoding='utf-8') as f:
    f.write(code)
print("detector.py fixed successfully!")