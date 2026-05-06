from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017").strip()
DB_NAME = os.getenv("DB_NAME", "pharma_surveillance")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

# Collections used by the unified scoring engine.
nsq_reference_collection = db["nsq_reference"]
antibiotic_reference_collection = db["antibiotic_reference"]
pharmacy_collection = db["pharmacy_sales"]

# Backward-compatible handles for the existing payload-based routes.
nsq_collection = db["nsq_drugs"]
antibiotic_collection = db["antibiotic_master"]


def ping_db():
    try:
        client.admin.command("ping")
        print("MongoDB connected successfully")
    except Exception as e:
        print(f"MongoDB connection failed: {e}")
        raise
