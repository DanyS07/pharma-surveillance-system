import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import LabelEncoder
import joblib
import os

def load_data(path='data/sample_sales.csv'):
    df = pd.read_csv(path)
    df['date'] = pd.to_datetime(df['date'])
    return df

def preprocess(df):
    le_ab = LabelEncoder()
    le_region = LabelEncoder()
    le_pharma = LabelEncoder()

    df = df.copy()
    df['ab_encoded'] = le_ab.fit_transform(df['antibiotic_name'])
    df['region_encoded'] = le_region.fit_transform(df['region'])
    df['pharma_encoded'] = le_pharma.fit_transform(df['pharmacy_id'])

    features = df[['ab_encoded', 'region_encoded', 'pharma_encoded', 'units_sold', 'month']]
    return features, df, le_ab

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

    features, df_copy, le_ab = preprocess(df)

    # Load model if exists, else train
    if os.path.exists('models/anomaly_model.pkl'):
        model = joblib.load('models/anomaly_model.pkl')
    else:
        model = train_model(features)

    df_copy['anomaly_score'] = model.decision_function(features)
    df_copy['is_anomaly'] = model.predict(features)
    df_copy['is_anomaly'] = df_copy['is_anomaly'].map({1: False, -1: True})

    anomalies = df_copy[df_copy['is_anomaly'] == True][[
        'date', 'antibiotic_name', 'region', 'pharmacy_id', 'units_sold', 'anomaly_score'
    ]]

    return anomalies.to_dict(orient='records')
