import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import LabelEncoder
import joblib
import os

def load_data(path=r'C:\Users\abhis\Desktop\pharma-surveillance-system\ai-service\antibiotic\data\sample_sales.csv.csv'):
    df = pd.read_csv(path)
    return df

def preprocess(df):
    df = df.copy()

    le_drug = LabelEncoder()
    df['drug_encoded'] = le_drug.fit_transform(df['drug_name'])

    features = df[['drug_encoded', 'quantity_sold', 'unit_price']]
    return features, df, le_drug

def train_model(features):
    model = IsolationForest(contamination=0.05, random_state=42)
    model.fit(features)
    os.makedirs('models', exist_ok=True)
    joblib.dump(model, 'models/anomaly_model.pkl')
    print("✅ Model trained and saved!")
    return model

def detect_anomalies(df=None, path='data/sample_sales.csv'):
    if df is None:
        df = load_data(path)

    features, df_copy, le_drug = preprocess(df)

    if os.path.exists('models/anomaly_model.pkl'):
        model = joblib.load('models/anomaly_model.pkl')
    else:
        model = train_model(features)

    df_copy['anomaly_score'] = model.decision_function(features)
    df_copy['is_anomaly'] = model.predict(features)
    df_copy['is_anomaly'] = df_copy['is_anomaly'].map({1: False, -1: True})

    anomalies = df_copy[df_copy['is_anomaly'] == True][[
        'record_id', 'drug_name', 'batch_number',
        'quantity_sold', 'unit_price', 'month', 'year', 'anomaly_score'
    ]]

    return anomalies.to_dict(orient='records')