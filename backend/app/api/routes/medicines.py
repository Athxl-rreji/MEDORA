from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from app.core.db import get_supabase_client
from app.core.prototype_db import get_datastore, PrototypeDataStore
from app.core.logger import logger

router = APIRouter()

@router.get("/search")
def search_medicines(q: str, db: Client = Depends(get_supabase_client), mock_db: PrototypeDataStore = Depends(get_datastore)):
    try:
        results = db.table("medicines").select("*").ilike("brand_name", f"%{q}%").execute()
        return {
            "query": q,
            "count": len(results.data),
            "results": results.data
        }
    except Exception as e:
        logger.warning(f"Supabase search failed: {e}. Falling back to Prototype DB.")
        results = mock_db.search_medicines(q)
        return {
            "query": q,
            "count": len(results),
            "results": results
        }

@router.get("/{medicine_id}/alternatives")
def get_medicine_alternatives(medicine_id: str, db: Client = Depends(get_supabase_client), mock_db: PrototypeDataStore = Depends(get_datastore)):
    try:
        original = db.table("medicines").select("generic_name").eq("id", medicine_id).single().execute()
        if not original.data:
            return {"original_medicine_id": medicine_id, "cheaper_alternatives": []}
            
        generic = original.data.get("generic_name")
        alternatives = db.table("medicines").select("*").eq("generic_name", generic).neq("id", medicine_id).order("avg_price").execute()
        
        return {
            "original_medicine_id": medicine_id,
            "cheaper_alternatives": alternatives.data
        }
    except Exception as e:
        logger.warning(f"Supabase alternatives req failed: {e}. Falling back...")
        alternatives = mock_db.get_alternative(medicine_id)
        return {
            "original_medicine_id": medicine_id,
            "cheaper_alternatives": alternatives
        }

@router.get("/{medicine_id}/availability")
def get_medicine_availability(medicine_id: str, db: Client = Depends(get_supabase_client), mock_db: PrototypeDataStore = Depends(get_datastore)):
    try:
        availability = db.table("inventory").select("*, pharmacies(*)").eq("medicine_id", medicine_id).gt("quantity", 0).execute()
        return {
            "medicine_id": medicine_id,
            "available_at": availability.data
        }
    except Exception as e:
        logger.warning(f"Supabase availability req failed: {e}. Falling back...")
        availability = mock_db.get_availability(medicine_id)
        return {
            "medicine_id": medicine_id,
            "available_at": availability
        }
