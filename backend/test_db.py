import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)
try:
    response = supabase.table("medicines").select("*").limit(1).execute()
    print("SUCCESS: medicines table connected. Data:", response.data)
except Exception as e:
    print("FAILED:", str(e))




