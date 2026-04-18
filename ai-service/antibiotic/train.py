from detector import load_data, preprocess, train_model

df = load_data()
features, _, _ = preprocess(df)
train_model(features)
print("Training complete!")