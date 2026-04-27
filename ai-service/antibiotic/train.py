from detector import load_data, preprocess, train_model

print("Loading data...")
df = load_data()
print(f"Loaded {len(df)} records")

features, _, _ = preprocess(df)
train_model(features)
print("✅ Training complete!")