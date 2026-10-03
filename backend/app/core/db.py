import os
from supabase import create_client, Client
from dotenv import load_dotenv
from app.core.logger import logger

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://pahrhwcigcrdwvpxyxop.supabase.co")

# Backend always uses service_role key for full access (bypasses RLS)
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY") or
    os.getenv("SUPABASE_KEY") or
    ""
)

_supabase_client: Client | None = None

def get_supabase_client() -> Client | None:
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    if not SUPABASE_URL or not SUPABASE_KEY or len(SUPABASE_KEY) < 50:
        logger.warning("Supabase credentials missing or invalid. Falling back to local SQLite mode.")
        return None

    try:
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info(f"✅ Supabase client connected to {SUPABASE_URL}")
        return _supabase_client
    except Exception as e:
        logger.warning(f"Supabase init failed: {e}. Falling back to local SQLite mode.")
        return None
