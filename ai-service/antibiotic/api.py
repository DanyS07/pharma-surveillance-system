from flask import Flask, request, jsonify
from detector import detect_anomalies, load_data
import pandas as pd

app = Flask(__name__)

@app.route('/', methods=['GET'])
def home():
    return jsonify({"status": "AI Antibiotic Surveillance Service Running ✅"})

# Detect anomalies — accepts GET/POST with JSON or uses local CSV
@app.route('/api/detect-anomalies', methods=['GET', 'POST'])
def detect():
    try:
        body = request.get_json(silent=True)  # ← fixed here

        if body and 'sales' in body:
            df = pd.DataFrame(body['sales'])
        else:
            df = load_data()

        results = detect_anomalies(df)
        return jsonify({
            "success": True,
            "total_anomalies": len(results),
            "anomalies": results
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# Summary of all drugs — avg, max, total quantity sold
@app.route('/api/summary', methods=['GET'])
def summary():
    df = load_data()
    summary = df.groupby('drug_name')['quantity_sold'].agg(
        avg_sold='mean',
        max_sold='max',
        total_sold='sum'
    ).reset_index()
    summary = summary.sort_values('total_sold', ascending=False)
    return jsonify(summary.to_dict(orient='records'))

# Top selling drugs
@app.route('/api/top-drugs', methods=['GET'])
def top_drugs():
    df = load_data()
    top = df.groupby('drug_name')['quantity_sold'].sum().reset_index()
    top = top.sort_values('quantity_sold', ascending=False).head(10)
    return jsonify(top.to_dict(orient='records'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)