from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import os

load_dotenv()

# ── Lifespan (startup + shutdown) ────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs on startup and shutdown.
    Startup  → connect to MongoDB, confirm connection
    Shutdown → close MongoDB connection cleanly
    """
    # STARTUP
    print("Starting NSQ Detection Service...")
    try:
        from app.database import ping_db, client
        ping_db()
    except Exception as e:
        print(f"Warning: MongoDB not connected: {e}")
        print("Service running without DB - use JSON payload mode")

    yield

    # SHUTDOWN
    print("Shutting down NSQ Detection Service...")
    try:
        from app.database import client
        client.close()
        print("MongoDB connection closed")
    except:
        pass

# ── App Initialisation ───────────────────────────────────────────────────────
app = FastAPI(
    title       = "NSQ Detection Service",
    description = "AI/ML service for detecting Not of Standard Quality drugs",
    version     = "1.0.0",
    lifespan    = lifespan,
    docs_url    = "/docs",
    redoc_url   = "/redoc",
)

# ── CORS Middleware ──────────────────────────────────────────────────────────
# DEVELOPMENT: allow_origins=["*"] allows all origins
# PRODUCTION:  replace "*" with your actual frontend URL
#              e.g. ["http://localhost:3000", "https://yourdomain.com"]
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ALLOWED_ORIGINS,
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── Register Routes ──────────────────────────────────────────────────────────
from app.routes.antibiotic_matching import router as antibiotic_router
from app.routes.nsq_matching import router as nsq_router
app.include_router(antibiotic_router)
app.include_router(nsq_router)

# ── Root Endpoint ─────────────────────────────────────────────────────────────
@app.get("/", tags=["Root"])
async def root():
    return {
        "service"    : "NSQ Detection AI Service",
        "version"    : "1.0.0",
        "status"     : "running",
        "docs"       : "/docs",
        "health"     : "/api/nsq/health",
        "main_endpoint": "POST /api/nsq/validate-nsq",
        "antibiotic_endpoint": "POST /api/antibiotic/match-sales",
    }
