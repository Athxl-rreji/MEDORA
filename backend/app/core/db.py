import os
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv
from app.core.logger import logger

# Explicitly load .env from the backend directory and workspace root
_backend_env = Path(__file__).resolve().parent.parent.parent / ".env"
if _backend_env.exists():
    load_dotenv(dotenv_path=_backend_env)
load_dotenv()

# Real Supabase credentials for pahrhwcigcrdwvpxyxop
DEFAULT_SUPABASE_URL = "https://pahrhwcigcrdwvpxyxop.supabase.co"
DEFAULT_SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhaHJod2NpZ2NyZHd2cHh5eG9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAyNDcyNCwiZXhwIjoyMDkyNjAwNzI0fQ.1uyMbiK8l1HRgWtEzz-gbZgt_hs93RzmeFt2AglVYas"
DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhaHJod2NpZ2NyZHd2cHh5eG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjQ3MjQsImV4cCI6MjA5MjYwMDcyNH0.0ygjeHbUOsSMyDlX6ShWEFukrZ0FRtllB2h_WqIADJ0"

SUPABASE_URL = os.getenv("SUPABASE_URL") or DEFAULT_SUPABASE_URL

# Candidate keys from environment
_env_key = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY") or
    os.getenv("SUPABASE_KEY") or
    os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or
    ""
).strip()

# If environment key is missing or is an invalid short placeholder (e.g. sb_publishable), use valid default
if not _env_key or len(_env_key) < 50 or _env_key.startswith("sb_"):
    SUPABASE_KEY = DEFAULT_SUPABASE_SERVICE_ROLE_KEY
else:
    SUPABASE_KEY = _env_key

_supabase_client: Client | None = None

def get_supabase_client() -> Client | None:
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.warning("Supabase credentials missing or invalid. Falling back to local SQLite mode.")
        return None

    try:
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info(f"✅ Supabase client connected to {SUPABASE_URL}")
        return _supabase_client
    except Exception as e:
        logger.warning(f"Supabase init failed: {e}. Falling back to local SQLite mode.")
        return None
