# upload_data.py
# Uploads NSQ CSV and pharmacy sales CSV to MongoDB Atlas

import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

# ── Connect to Atlas ─────────────────────────────────────────────────────────
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME   = os.getenv("DB_NAME", "pharmaDB")

print("Connecting to MongoDB Atlas...")
client = MongoClient(MONGO_URI)
db     = client[DB_NAME]
client.admin.command("ping")
print("✅ Connected successfully")

# ── Upload NSQ Data ──────────────────────────────────────────────────────────
print("\nUploading NSQ data...")
nsq_df = pd.read_csv("nsq_data.csv")
nsq_df.columns = ["drugName", "batchNumber", "manufacturer", "reportMonth"]
nsq_df = nsq_df.dropna(subset=["batchNumber", "drugName"])
nsq_df["batchNumber"] = nsq_df["batchNumber"].astype(str).str.strip()
nsq_df["drugName"]    = nsq_df["drugName"].astype(str).str.strip()

nsq_collection = db["nsq_data"]
nsq_collection.delete_many({})   # clear existing data first
nsq_records = nsq_df.to_dict("records")
nsq_collection.insert_many(nsq_records)
print(f"✅ Inserted {len(nsq_records)} NSQ records into 'nsq_data'")

# ── Upload Pharmacy Sales Data ───────────────────────────────────────────────
print("\nUploading pharmacy sales data...")
ph_df = pd.read_csv("MedPlus_Pharmacy_Sales_January_2026.csv")
ph_df["batchNumber"] = ph_df["batch_number"].astype(str).str.strip()
ph_df["drugName"]    = ph_df["drug_name"].astype(str).str.strip()

ph_collection = db["pharmacy_sales"]
ph_collection.delete_many({})    # clear existing data first
ph_records = ph_df.to_dict("records")
ph_collection.insert_many(ph_records)
print(f"✅ Inserted {len(ph_records)} pharmacy sales records into 'pharmacy_sales'")

# ── Verify ───────────────────────────────────────────────────────────────────
print("\n📊 VERIFICATION")
print(f"nsq_data count      : {nsq_collection.count_documents({})}")
print(f"pharmacy_sales count: {ph_collection.count_documents({})}")
print("\n✅ All data uploaded successfully")