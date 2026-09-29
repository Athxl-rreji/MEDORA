import os
from supabase import create_client, Client
from dotenv import load_dotenv

from app.core.logger import logger

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

def get_supabase_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY or "your-project" in SUPABASE_URL or "your-anon-key" in SUPABASE_KEY or "your-service-role" in SUPABASE_KEY:
        logger.warning("Supabase credentials not configured or placeholder values are present. Falling back to Prototype DB mode.")
        return None
    try:
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        logger.warning(f"Failed to initialize Supabase client: {e}. Falling back to Prototype DB mode.")
        return None
