import os
import json
import base64
import uuid
import urllib.request
from urllib.parse import quote, quote_plus
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from supabase import Client
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.core.db import get_supabase_client
from app.core.prototype_db import get_datastore, PrototypeDataStore
from app.core.logger import logger

router = APIRouter()

# ─── HIGH-SPEED CLINICAL PHARMACOLOGY DICTIONARY ───
COMPOUND_DICTIONARY = {
    "crocin": {"compound": "Paracetamol", "components": ["Paracetamol"], "note": "Crocin contains active chemical compound Paracetamol (Acetaminophen) 650mg/500mg, an antipyretic & analgesic."},
    "dolo": {"compound": "Paracetamol", "components": ["Paracetamol"], "note": "Dolo contains active chemical compound Paracetamol 650mg, an antipyretic & analgesic."},
    "calpol": {"compound": "Paracetamol", "components": ["Paracetamol"], "note": "Calpol contains active chemical compound Paracetamol, an antipyretic & analgesic."},
    "pacimol": {"compound": "Paracetamol", "components": ["Paracetamol"], "note": "Pacimol contains active chemical compound Paracetamol, an antipyretic & analgesic."},
    "augmentin": {
        "compound": "Amoxicillin + Clavulanic Acid",
        "components": ["Amoxicillin", "Clavulanic Acid"],
        "note": "Augmentin contains active chemical compounds Amoxicillin (500mg) + Clavulanic Acid (125mg), a broad-spectrum antibiotic."
    },
    "amoxyclav": {
        "compound": "Amoxicillin + Clavulanic Acid",
        "components": ["Amoxicillin", "Clavulanic Acid"],
        "note": "Amoxyclav contains active chemical compounds Amoxicillin + Clavulanic Acid, a broad-spectrum antibiotic."
    },
    "clavam": {
        "compound": "Amoxicillin + Clavulanic Acid",
        "components": ["Amoxicillin", "Clavulanic Acid"],
        "note": "Clavam contains active chemical compounds Amoxicillin + Clavulanic Acid, a broad-spectrum antibiotic."
    },
    "pan": {"compound": "Pantoprazole", "components": ["Pantoprazole"], "note": "Pan contains active chemical compound Pantoprazole Sodium 40mg, an acid-reducing PPI."},
    "pantocid": {"compound": "Pantoprazole", "components": ["Pantoprazole"], "note": "Pantocid contains active chemical compound Pantoprazole Sodium, an acid-reducing PPI."},
    "pan-d": {
        "compound": "Pantoprazole + Domperidone",
        "components": ["Pantoprazole", "Domperidone"],
        "note": "Pan-D contains active chemical compounds Pantoprazole (40mg) + Domperidone (30mg), for acidity and nausea."
    },
    "pantocid-d": {
        "compound": "Pantoprazole + Domperidone",
        "components": ["Pantoprazole", "Domperidone"],
        "note": "Pantocid-D contains active chemical compounds Pantoprazole + Domperidone, for acidity and nausea."
    },
    "allegra": {"compound": "Fexofenadine", "components": ["Fexofenadine"], "note": "Allegra contains active chemical compound Fexofenadine 120mg/180mg, a non-drowsy antihistamine."},
    "avil": {"compound": "Pheniramine", "components": ["Pheniramine"], "note": "Avil contains active chemical compound Pheniramine Maleate, an anti-allergy antihistamine."},
    "azithral": {"compound": "Azithromycin", "components": ["Azithromycin"], "note": "Azithral contains active chemical compound Azithromycin 500mg, a macrolide antibiotic."},
    "azee": {"compound": "Azithromycin", "components": ["Azithromycin"], "note": "Azee contains active chemical compound Azithromycin 500mg, a macrolide antibiotic."},
    "combiflam": {
        "compound": "Ibuprofen + Paracetamol",
        "components": ["Ibuprofen", "Paracetamol"],
        "note": "Combiflam contains active chemical compounds Ibuprofen (400mg) + Paracetamol (325mg) for pain and inflammation."
    },
    "flexon": {
        "compound": "Ibuprofen + Paracetamol",
        "components": ["Ibuprofen", "Paracetamol"],
        "note": "Flexon contains active chemical compounds Ibuprofen + Paracetamol for pain and inflammation."
    },
    "glycomet": {"compound": "Metformin", "components": ["Metformin"], "note": "Glycomet contains active chemical compound Metformin Hydrochloride 500mg/1000mg for Type 2 Diabetes."},
    "glucophage": {"compound": "Metformin", "components": ["Metformin"], "note": "Glucophage contains active chemical compound Metformin Hydrochloride for blood sugar control."},
    "telma": {"compound": "Telmisartan", "components": ["Telmisartan"], "note": "Telma contains active chemical compound Telmisartan 40mg, an antihypertensive ARB."},
    "omez": {"compound": "Omeprazole", "components": ["Omeprazole"], "note": "Omez contains active chemical compound Omeprazole 20mg, an acid reflux inhibitor."},
    "cetzine": {"compound": "Cetirizine", "components": ["Cetirizine"], "note": "Cetzine contains active chemical compound Cetirizine Dihydrochloride 10mg for allergy relief."},
    "alerid": {"compound": "Cetirizine", "components": ["Cetirizine"], "note": "Alerid contains active chemical compound Cetirizine Dihydrochloride 10mg for allergy relief."},
    "voveran": {"compound": "Diclofenac", "components": ["Diclofenac"], "note": "Voveran contains active chemical compound Diclofenac Sodium for joint and muscle pain relief."},
    "voveran plus": {
        "compound": "Diclofenac + Paracetamol",
        "components": ["Diclofenac", "Paracetamol"],
        "note": "Voveran Plus contains active chemical compounds Diclofenac + Paracetamol for severe musculoskeletal pain."
    },
    "volini": {"compound": "Diclofenac", "components": ["Diclofenac"], "note": "Volini contains active chemical compound Diclofenac for targeted pain relief."},
    "aciloc": {"compound": "Ranitidine", "components": ["Ranitidine"], "note": "Aciloc contains active chemical compound Ranitidine 150mg for stomach acid relief."},
    "ascoril": {
        "compound": "Ambroxol + Salbutamol",
        "components": ["Ambroxol", "Salbutamol"],
        "note": "Ascoril contains active chemical compounds Ambroxol + Salbutamol for chest congestion and cough."
    },
    "ascoril-d": {
        "compound": "Dextromethorphan + Chlorpheniramine",
        "components": ["Dextromethorphan", "Chlorpheniramine"],
        "note": "Ascoril-D contains active chemical compounds Dextromethorphan + Chlorpheniramine for dry cough relief."
    },
    "montair-lc": {
        "compound": "Montelukast + Levocetirizine",
        "components": ["Montelukast", "Levocetirizine"],
        "note": "Montair-LC contains active chemical compounds Montelukast (10mg) + Levocetirizine (5mg) for allergic asthma."
    },
    "ciplox": {"compound": "Ciprofloxacin", "components": ["Ciprofloxacin"], "note": "Ciplox contains active chemical compound Ciprofloxacin Hydrochloride 500mg, an antibiotic."},
    "amlong": {"compound": "Amlodipine", "components": ["Amlodipine"], "note": "Amlong contains active chemical compound Amlodipine Besylate 5mg for high blood pressure."},
    "atorva": {"compound": "Atorvastatin", "components": ["Atorvastatin"], "note": "Atorva contains active chemical compound Atorvastatin Calcium for cholesterol management."},
    "electral": {"compound": "Oral Rehydration Salts", "components": ["Oral Rehydration Salts"], "note": "Electral contains active WHO formula Oral Rehydration Salts (ORS) for hydration."},
    "limcee": {"compound": "Ascorbic Acid", "components": ["Ascorbic Acid"], "note": "Limcee contains active chemical compound Ascorbic Acid (Vitamin C) 500mg for immunity."}
}

def resolve_chemical_compound_ai(query: str) -> dict:
    """
    Uses pharmacology database and Google Gemini AI to resolve brand names into active chemical compounds.
    Supports multi-composition drugs (e.g. Augmentin = Amoxicillin + Clavulanic Acid).
    """
    clean_q = query.strip().lower()
    first_word = clean_q.split()[0] if clean_q else ""

    # 1. Fast local dictionary match (longest key first so "pan-d" matches before "pan")
    for k, v in sorted(COMPOUND_DICTIONARY.items(), key=lambda item: len(item[0]), reverse=True):
        if k in clean_q or first_word == k:
            comps = v.get("components")
            if not comps:
                if "+" in v["compound"]:
                    comps = [c.strip() for c in v["compound"].split("+")]
                else:
                    comps = [v["compound"]]
            return {
                "compound_name": v["compound"],
                "is_brand": True,
                "note": v["note"],
                "source": "pharmacology_kb",
                "components": comps
            }

    # 2. Google Gemini AI resolution
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if gemini_key:
        prompt = (
            f"You are a clinical pharmacology database. For the medicine query '{query}', identify:\n"
            "1. The primary generic chemical compound / active pharmaceutical ingredient.\n"
            "2. If it is a combination drug (e.g. Augmentin = Amoxicillin + Clavulanic Acid, Combiflam = Ibuprofen + Paracetamol), list the individual chemical components in a JSON array 'components'.\n"
            "3. Whether this query is a commercial brand name (true/false).\n"
            "4. A concise patient explanation.\n"
            "Return strictly JSON:\n"
            '{"compound_name": "Generic Chemical Name", "is_brand": true, "components": ["Component 1", "Component 2"], "note": "explanation"}'
        )
        try:
            payload = {
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.1, "maxOutputTokens": 200, "responseMimeType": "application/json"}
            }
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=4) as response:
                body = json.loads(response.read().decode("utf-8"))
                candidates = body.get("candidates", [])
                if candidates and "content" in candidates[0]:
                    text = candidates[0]["content"]["parts"][0]["text"].strip()
                    parsed = json.loads(text)
                    if parsed.get("compound_name"):
                        parsed["source"] = "google_gemini_ai"
                        if not parsed.get("components"):
                            cname = parsed.get("compound_name", "")
                            if "+" in cname:
                                parsed["components"] = [c.strip() for c in cname.split("+")]
                            else:
                                parsed["components"] = [cname]
                        return parsed
        except Exception as e:
            logger.warning(f"Gemini compound resolution timeout/fallback for '{query}': {e}")

    # Fallback: check if query itself has combination operators
    if "+" in query:
        comps = [c.strip().title() for c in query.split("+") if c.strip()]
    elif "/" in query:
        comps = [c.strip().title() for c in query.split("/") if c.strip()]
    else:
        comps = [query.title()]

    return {
        "compound_name": query.title(),
        "is_brand": False,
        "note": f"Viewing medicines matching active formulation '{query.title()}'.",
        "source": "direct",
        "components": comps
    }

class InventorySyncRequest(BaseModel):
    pharmacy_id: str = "PHARM_003"
    medicine_name: str
    generic: Optional[str] = None
    quantity: int
    expiry: Optional[str] = None
    manufacturer: Optional[str] = None

class CompoundQuizSyncRequest(BaseModel):
    pharmacy_id: str
    selections: Dict[str, bool]

class MissingResponsePayload(BaseModel):
    request_id: str
    pharmacy_id: str
    action: str # "in_stock" | "ignore" | "dismiss"
    quantity: Optional[int] = 50
    price: Optional[str] = "85.00"

@router.post("/inventory/sync")
def sync_inventory_endpoint(
    payload: InventorySyncRequest,
    db: Client = Depends(get_supabase_client),
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    logger.info(f"Syncing stock inventory for pharmacy {payload.pharmacy_id}: {payload.medicine_name} (+{payload.quantity})")
    try:
        med_res = db.table("medicines").select("id").ilike("brand_name", f"%{payload.medicine_name}%").execute()
        med_id = None
        if med_res.data:
            med_id = med_res.data[0]["id"]
        else:
            if payload.generic:
                gen_res = db.table("medicines").select("id").ilike("generic_name", f"%{payload.generic}%").execute()
                if gen_res.data:
                    med_id = gen_res.data[0]["id"]
                    
        if not med_id:
            raise ValueError("Medicine not found in primary store")
            
        inv_res = db.table("inventory").select("*").eq("pharmacy_id", payload.pharmacy_id).eq("medicine_id", med_id).execute()
        if inv_res.data:
            existing = inv_res.data[0]
            new_qty = existing["quantity"] + payload.quantity
            update_res = db.table("inventory").update({
                "quantity": new_qty,
                "expiry_date": payload.expiry or existing["expiry_date"]
            }).eq("id", existing["id"]).execute()
            return {"status": "success", "inventory": update_res.data[0]}
        else:
            insert_res = db.table("inventory").insert({
                "pharmacy_id": payload.pharmacy_id,
                "medicine_id": med_id,
                "quantity": payload.quantity,
                "expiry_date": payload.expiry or "2029-12-31"
            }).execute()
            return {"status": "success", "inventory": insert_res.data[0]}
            
    except Exception as e:
        logger.warning(f"Supabase inventory sync failed: {e}. Falling back to Prototype DB.")
        res = mock_db.sync_inventory(
            pharmacy_id=payload.pharmacy_id,
            medicine_name=payload.medicine_name,
            generic=payload.generic,
            quantity=payload.quantity,
            expiry=payload.expiry,
            manufacturer=payload.manufacturer
        )
        return {"status": "success", "synced": res}


@router.get("/instamart/boot-catalog")
def get_instamart_boot_catalog(
    lat: float = 19.0760,
    lng: float = 72.8777,
    perimeter_km: float = 10.0,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    On app bootup, sends/retrieves high-demand & fast-moving medicines searched by people,
    with real-time stock across connected local pharmacies, perimeter status, and fastest delivery indicators.
    """
    catalog = mock_db.get_instamart_popular_catalog(user_lat=lat, user_lng=lng, max_distance_km=perimeter_km)
    network = mock_db.get_pharmacy_network(user_lat=lat, user_lng=lng, max_distance_km=perimeter_km)
    return {
        "status": "success",
        "service": "MEDORA Instamart Quick Commerce Engine",
        "user_coordinates": {"lat": lat, "lng": lng},
        "perimeter_km": perimeter_km,
        "connected_pharmacies": network,
        "popular_medicines_count": len(catalog),
        "items": catalog
    }

@router.get("/instamart/pharmacy-network")
def get_pharmacy_network_endpoint(
    lat: float = 19.0760,
    lng: float = 72.8777,
    perimeter_km: float = 10.0,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Returns all registered local partner pharmacies, their distance from user,
    delivery speed (10-15 mins), and live catalog inventory counts.
    """
    network = mock_db.get_pharmacy_network(user_lat=lat, user_lng=lng, max_distance_km=perimeter_km)
    return {
        "status": "success",
        "user_coordinates": {"lat": lat, "lng": lng},
        "perimeter_km": perimeter_km,
        "pharmacies": network
    }

@router.get("/search")
def search_medicines(
    q: str, 
    lat: float = 19.0760,
    lng: float = 72.8777,
    perimeter_km: float = 10.0,
    db: Client = Depends(get_supabase_client), 
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Searches medicines and queries local pharmacy nodes in real-time.
    Uses Google Gemini AI to resolve brand names to active chemical compounds,
    identifying identical chemical formulation across different trade brands.
    If no pharmacy has stock, broadcasts a missing medicine alert to all pharmacies.
    """
    compound_info = resolve_chemical_compound_ai(q)
    resolved_compound = compound_info.get("compound_name", q)
    ai_note = compound_info.get("note", "")
    is_brand = compound_info.get("is_brand", False)

    # 1. Search by brand name
    try:
        results = db.table("medicines").select("*").ilike("brand_name", f"%{q}%").execute()
        raw_items = results.data
    except Exception:
        raw_items = mock_db.search_medicines(q)

    # 2. If query is a brand name or resolved compound is different, also search by chemical compound
    compound_items = []
    if resolved_compound and resolved_compound.lower() != q.lower():
        try:
            c_res = db.table("medicines").select("*").ilike("generic_name", f"%{resolved_compound}%").execute()
            compound_items = c_res.data
        except Exception:
            compound_items = mock_db.search_medicines(resolved_compound)

    # Combine & deduplicate by medicine_id
    seen_ids = set()
    combined_items = []

    for med in raw_items:
        mid = med.get("medicine_id") or med.get("id")
        if mid not in seen_ids:
            seen_ids.add(mid)
            combined_items.append(med)

    for med in compound_items:
        mid = med.get("medicine_id") or med.get("id")
        if mid not in seen_ids:
            seen_ids.add(mid)
            med["is_compound_match"] = True
            med["resolved_compound"] = resolved_compound
            med["compound_badge"] = f"✨ Same Medicine (Chemical Compound: {resolved_compound})"
            med["compound_note"] = f"Same active chemical compound ({resolved_compound}) under a different brand name."
            combined_items.append(med)

    # Enrich search results with Instamart local store inventory and delivery time
    enriched = []
    total_stock_all_stores = 0

    for med in combined_items:
        mid = med.get("medicine_id") or med.get("id")
        stock_info = mock_db.get_medicine_local_stock(mid, user_lat=lat, user_lng=lng, max_distance_km=perimeter_km)
        total_stock_all_stores += stock_info.get("total_available", 0)

        # Tag compound equivalence note
        if not med.get("compound_badge") and (is_brand or resolved_compound.lower() in med.get("generic_name", "").lower()):
            med["resolved_compound"] = resolved_compound
            med["compound_badge"] = f"✨ Same Medicine (Chemical Compound: {resolved_compound})"
            med["compound_note"] = ai_note or f"Contains the active chemical compound {resolved_compound}."

        enriched.append({
            **med,
            "instamart": stock_info
        })

    # Multi-Composition (Combination Drug) Split Handling:
    # If the searched drug has 2 or more active chemical compounds (e.g. Amoxicillin + Clavulanic Acid, Ibuprofen + Paracetamol)
    # create individual composition tabs so the user can choose from either or both compositions.
    components = compound_info.get("components") or []
    if not components and ("+" in resolved_compound or "/" in resolved_compound):
        components = [c.strip() for c in resolved_compound.replace("/", "+").split("+") if c.strip()]

    multi_composition_split = None
    if len(components) >= 2:
        comp_tabs = []
        for idx, comp in enumerate(components):
            comp_meds_raw = mock_db.search_medicines(comp)
            comp_meds = []
            for cm in comp_meds_raw:
                cm_id = cm.get("medicine_id") or cm.get("id")
                cm_stock = mock_db.get_medicine_local_stock(cm_id, user_lat=lat, user_lng=lng, max_distance_km=perimeter_km)
                comp_meds.append({
                    **cm,
                    "instamart": cm_stock,
                    "component_tag": f"Part {idx+1}: {comp}",
                    "compound_badge": f"💊 Active Component: {comp}"
                })
            comp_tabs.append({
                "index": idx,
                "name": comp,
                "label": f"Composition {idx+1}: {comp}",
                "count": len(comp_meds),
                "medicines": comp_meds
            })

        multi_composition_split = {
            "has_multi_composition": True,
            "brand_searched": q.title(),
            "combined_name": resolved_compound,
            "is_combined_in_stock": total_stock_all_stores > 0,
            "components_count": len(components),
            "note": f"'{q.title()}' contains {len(components)} active chemical compounds ({' + '.join(components)}). If the combined tablet is unavailable or you prefer individual formulations, select either component tab below or add both to your cart in 1-click.",
            "tabs": comp_tabs
        }

    # If zero stock available across ALL connected partner pharmacies (or no matches found):
    # Automatically broadcast missing medicine alert to pharmacies!
    missing_broadcasted = False
    if total_stock_all_stores == 0 or len(enriched) == 0:
        missing_req = mock_db.log_missing_medicine(
            query=q,
            medicine_name=q.title(),
            compound_name=resolved_compound,
            user_lat=lat,
            user_lng=lng
        )
        missing_broadcasted = True
        logger.info(f"Missing medicine alert broadcasted for {q} (ID: {missing_req['id']})")

    return {
        "query": q,
        "resolved_compound": resolved_compound,
        "is_brand": is_brand,
        "ai_note": ai_note,
        "perimeter_km": perimeter_km,
        "count": len(enriched),
        "total_stock_across_stores": total_stock_all_stores,
        "missing_alert_broadcasted": missing_broadcasted,
        "multi_composition_split": multi_composition_split,
        "results": enriched
    }

@router.get("/{medicine_id}/local-stores")
def get_medicine_local_stores(
    medicine_id: str,
    lat: float = 19.0760,
    lng: float = 72.8777,
    perimeter_km: float = 10.0,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Returns breakdown of local pharmacies that have this medicine in stock,
    with distance, delivery speed, and available quantities.
    """
    stock_info = mock_db.get_medicine_local_stock(medicine_id, user_lat=lat, user_lng=lng, max_distance_km=perimeter_km)
    return {
        "medicine_id": medicine_id,
        "perimeter_km": perimeter_km,
        **stock_info
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

# ─── ESSENTIAL CHEMICAL COMPOUNDS & PHARMACY QUIZ ENDPOINTS ───
@router.get("/essential-compounds")
def get_essential_compounds(mock_db: PrototypeDataStore = Depends(get_datastore)):
    """
    Returns curated list of top essential chemical compounds (generic molecules) for the pharmacy onboarding quiz.
    """
    compounds = mock_db.get_essential_compounds()
    return {
        "status": "success",
        "count": len(compounds),
        "compounds": compounds
    }

@router.post("/pharmacy/compound-quiz-sync")
def sync_pharmacy_compound_quiz(
    payload: CompoundQuizSyncRequest,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Saves pharmacy quiz answers to real store inventory.
    """
    return mock_db.bulk_sync_compound_inventory(payload.pharmacy_id, payload.selections)

# ─── MISSING MEDICINE BROADCAST & PHARMACY NOTIFICATION FEED ENDPOINTS ───
@router.get("/missing/pharmacy-feed")
def get_missing_feed(
    pharmacy_id: str = "PHARM_001",
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Returns real-time urgent missing medicine inquiry popups and ignored items for notification dropdown.
    """
    feed = mock_db.get_missing_medicine_feed(pharmacy_id)
    return {
        "status": "success",
        **feed
    }

@router.post("/missing/respond")
def respond_to_missing_inquiry(
    payload: MissingResponsePayload,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Records pharmacy response:
    - 'in_stock': Marks in stock and updates inventory
    - 'ignore': Moves to header notification dropdown
    - 'dismiss': Permanently clears from dropdown
    """
    try:
        return mock_db.respond_to_missing_medicine(
            request_id=payload.request_id,
            pharmacy_id=payload.pharmacy_id,
            action=payload.action,
            quantity=payload.quantity or 50,
            price=payload.price or "85.00"
        )
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── FULL DATABASE CATALOG & PHARMACY BULK INVENTORY TOGGLE ───
class PharmacyBulkStockUpdatePayload(BaseModel):
    pharmacy_id: str = "PHARM_001"
    updates: Dict[str, Dict[str, Any]]

@router.get("/all")
def get_all_medicines_catalog(
    pharmacy_id: str = "PHARM_001",
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Returns the complete catalog of medicines in the database,
    annotated with live stock availability and quantity for the requesting pharmacy.
    """
    catalog = mock_db.get_pharmacy_full_catalog(pharmacy_id=pharmacy_id)
    return {
        "status": "success",
        "pharmacy_id": pharmacy_id,
        "total_medicines": len(catalog),
        "medicines": catalog
    }

@router.post("/pharmacy/inventory-bulk-toggle")
def bulk_update_pharmacy_inventory_endpoint(
    payload: PharmacyBulkStockUpdatePayload,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Applies bulk stock updates (in_stock and quantity) across database medicines for a pharmacy.
    """
    try:
        return mock_db.bulk_update_pharmacy_inventory(payload.pharmacy_id, payload.updates)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── BATCH STRIP PHOTO OCR VIA GOOGLE GEMINI VISION ───
class BatchCommitItem(BaseModel):
    medicine_name: str
    generic_name: Optional[str] = None
    quantity: int = 50
    expiry_date: Optional[str] = "2028-12-31"
    price_mrp: Optional[str] = "75.00"
    manufacturer: Optional[str] = "MEDORA Verified Labs"
    batch_number: Optional[str] = None

class BatchCommitPayload(BaseModel):
    pharmacy_id: str = "PHARM_001"
    items: List[BatchCommitItem]

@router.post("/inventory/ocr-batch-gemini")
async def ocr_batch_gemini_endpoint(
    files: List[UploadFile] = File(...),
    pharmacy_id: str = Query("PHARM_001"),
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Multimodal Batch Strip OCR & Clinical Analysis Pipeline using Google Gemini Vision.
    Processes multiple medicine packaging/blister strip photos concurrently,
    extracting brand names, generic compositions, expiries, batch numbers, and suggested quantities.
    """
    gemini_key = os.environ.get("GEMINI_API_KEY")
    results = []
    
    for idx, f in enumerate(files):
        try:
            raw_bytes = await f.read()
            if not raw_bytes:
                continue
            
            content_type = f.content_type or "image/jpeg"
            b64_image = base64.b64encode(raw_bytes).decode("utf-8")
            thumbnail = f"data:{content_type};base64,{b64_image}"
            
            item_data = None
            engine = "Local Heuristic OCR"
            
            if gemini_key:
                system_prompt = (
                    "You are MEDORA's AI Pharmacy Vision Expert. "
                    "Analyze this medicine strip or packaging photo carefully. "
                    "Extract:\n"
                    "1. medicine_name: Standard Commercial Brand / Trade Name (e.g. Augmentin 625 Duo, Pan-D, Dolo 650, Combiflam, Telma 40, Azithral 500, Calpol 500)\n"
                    "2. generic_name: Active Chemical Composition / Molecule (e.g. Amoxicillin + Clavulanic Acid, Pantoprazole + Domperidone, Paracetamol, Ibuprofen + Paracetamol)\n"
                    "3. strength: Dosage / strength (e.g. 625mg, 500mg, 40mg+30mg)\n"
                    "4. expiry_date: Expiration date in YYYY-MM-DD or MM/YYYY format\n"
                    "5. batch_number: Manufacturing lot or batch number if visible (or null)\n"
                    "6. manufacturer: Pharma company name (e.g. Cipla, Sun Pharma, Alkem, GSK, Abbott, Mankind)\n"
                    "7. price_mrp: Estimated retail MRP in INR (e.g. '85.00')\n"
                    "8. suggested_quantity: Recommended initial stock units (e.g. 50)\n\n"
                    "Return STRICTLY a JSON object with keys: medicine_name, generic_name, strength, expiry_date, batch_number, manufacturer, price_mrp, suggested_quantity."
                )
                
                payload = {
                    "contents": [
                        {
                            "role": "user",
                            "parts": [
                                {"text": system_prompt},
                                {
                                    "inlineData": {
                                        "mimeType": content_type,
                                        "data": b64_image
                                    }
                                }
                            ]
                        }
                    ],
                    "generationConfig": {
                        "temperature": 0.1,
                        "maxOutputTokens": 400,
                        "responseMimeType": "application/json"
                    }
                }
                
                gemini_models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]
                for model_name in gemini_models:
                    try:
                        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                        req = urllib.request.Request(
                            url,
                            data=json.dumps(payload).encode("utf-8"),
                            headers={"Content-Type": "application/json"},
                            method="POST"
                        )
                        with urllib.request.urlopen(req, timeout=10) as response:
                            body = json.loads(response.read().decode("utf-8"))
                            candidates = body.get("candidates", [])
                            if candidates and "content" in candidates[0]:
                                text = candidates[0]["content"]["parts"][0]["text"].strip()
                                parsed = json.loads(text)
                                if parsed.get("medicine_name"):
                                    item_data = parsed
                                    engine = f"Google {model_name}"
                                    break
                    except Exception as gemini_err:
                        logger.warning(f"Gemini {model_name} strip OCR error for {f.filename}: {gemini_err}")
                        continue
            
            # Fallback if Gemini unavailable or not returned
            if not item_data:
                clean_fname = os.path.splitext(f.filename)[0].replace("_", " ").replace("-", " ").title()
                comp_info = resolve_chemical_compound_ai(clean_fname)
                item_data = {
                    "medicine_name": clean_fname or f"Scanned Medicine #{idx+1}",
                    "generic_name": comp_info.get("compound_name", "Paracetamol 500mg"),
                    "strength": "500mg",
                    "expiry_date": "2028-12-31",
                    "batch_number": f"MED-{uuid.uuid4().hex[:6].upper()}",
                    "manufacturer": "MEDORA Verified Labs",
                    "price_mrp": "75.00",
                    "suggested_quantity": 50
                }
            
            results.append({
                "id": f"strip_{uuid.uuid4().hex[:8]}",
                "filename": f.filename,
                "thumbnail": thumbnail,
                "medicine_name": item_data.get("medicine_name") or f.filename,
                "generic_name": item_data.get("generic_name") or "Standard Formulation",
                "strength": item_data.get("strength") or "Standard",
                "expiry_date": item_data.get("expiry_date") or "2028-12-31",
                "batch_number": item_data.get("batch_number") or f"LOT-{idx+101}",
                "manufacturer": item_data.get("manufacturer") or "Generic Pharma",
                "price_mrp": str(item_data.get("price_mrp") or "75.00"),
                "quantity": int(item_data.get("suggested_quantity") or 50),
                "engine": engine,
                "status": "ready"
            })
        except Exception as e:
            logger.error(f"Error processing strip {f.filename}: {e}")
            results.append({
                "id": f"strip_err_{idx}",
                "filename": f.filename,
                "thumbnail": "",
                "medicine_name": f.filename,
                "generic_name": "Unknown",
                "strength": "N/A",
                "expiry_date": "2028-12-31",
                "batch_number": "N/A",
                "manufacturer": "N/A",
                "price_mrp": "50.00",
                "quantity": 50,
                "engine": "Error Fallback",
                "status": "error"
            })
            
    return {
        "status": "success",
        "total_uploaded": len(files),
        "total_extracted": len(results),
        "items": results
    }

@router.post("/inventory/batch-commit")
def commit_batch_inventory_endpoint(
    payload: BatchCommitPayload,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Commits an entire batch of reviewed strip OCR medicines into the pharmacy inventory in 1-click.
    """
    added_count = 0
    for item in payload.items:
        try:
            mock_db.sync_inventory(
                pharmacy_id=payload.pharmacy_id,
                medicine_name=item.medicine_name,
                generic=item.generic_name or item.medicine_name,
                quantity=item.quantity,
                expiry=item.expiry_date or "2028-12-31",
                manufacturer=item.manufacturer or "MEDORA Verified Labs"
            )
            added_count += 1
        except Exception as e:
            logger.warning(f"Error syncing {item.medicine_name}: {e}")
            
    return {
        "status": "success",
        "message": f"Successfully added {added_count} medicines to store inventory!",
        "added_count": added_count
    }

# ─── LIVE UPI POS MACHINE SCANNER & STORE QR BROADCAST ───
class LiveTerminalQrPayload(BaseModel):
    pharmacy_id: str = "PHARM_001"
    live_upi_qr: str # Base64 captured photo or data URL
    terminal_label: Optional[str] = "Counter POS Soundbox"
    expires_in_minutes: Optional[int] = 30

class UpdateStoreUpiPayload(BaseModel):
    pharmacy_id: str = "PHARM_001"
    shop_upi_id: str
    pharmacy_name: Optional[str] = None
    shop_upi_qr: Optional[str] = None
    terminal_label: Optional[str] = None

@router.post("/pharmacy/live-terminal-qr")
def upload_live_terminal_qr(
    payload: LiveTerminalQrPayload,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Pharmacy captures live photo of UPI POS machine / soundbox display and broadcasts it in real-time to customers in checkout.
    """
    pharm_id = payload.pharmacy_id or "PHARM_001"
    if pharm_id not in mock_db.pharmacy_metadata:
        mock_db.pharmacy_metadata[pharm_id] = {
            "id": pharm_id,
            "name": "Vamanjoor Express Pharmacy",
            "shop_upi_id": "vamanjoor.pharmacy@upi"
        }
    
    is_clearing = not payload.live_upi_qr or payload.live_upi_qr.strip() in ("", "clear", "reset")
    mock_db.pharmacy_metadata[pharm_id]["live_terminal_qr"] = None if is_clearing else payload.live_upi_qr
    mock_db.pharmacy_metadata[pharm_id]["live_terminal_qr_time"] = None if is_clearing else datetime.now().isoformat()
    if payload.terminal_label:
        mock_db.pharmacy_metadata[pharm_id]["terminal_label"] = payload.terminal_label

    logger.info(f"Pharmacy {pharm_id} {'cleared' if is_clearing else 'broadcasted'} live terminal QR snapshot")
    return {
        "status": "success",
        "message": "Live terminal QR cleared. Reverted to store permanent QR." if is_clearing else "Live UPI POS machine photo broadcasted successfully! Customers will see this live display before confirming their order.",
        "pharmacy_id": pharm_id,
        "live_terminal_qr": None if is_clearing else payload.live_upi_qr,
        "timestamp": datetime.now().isoformat()
    }

@router.post("/pharmacy/update-upi")
def update_pharmacy_upi(
    payload: UpdateStoreUpiPayload,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Update the store's verified permanent UPI ID (VPA), permanent QR sticker, and POS terminal label.
    Automatically generates a high-resolution NPCI standard UPI QR if a custom sticker is not provided.
    """
    pharm_id = payload.pharmacy_id or "PHARM_001"
    clean_upi_id = payload.shop_upi_id.strip()
    if not clean_upi_id or "@" not in clean_upi_id:
        raise HTTPException(status_code=400, detail="Invalid UPI ID. Must be in the format username@bank (e.g. store@okaxis).")

    if pharm_id not in mock_db.pharmacy_metadata:
        mock_db.pharmacy_metadata[pharm_id] = {
            "id": pharm_id,
            "name": payload.pharmacy_name or "Vamanjoor Express Pharmacy",
            "shop_upi_id": clean_upi_id
        }

    pharm = mock_db.pharmacy_metadata[pharm_id]
    if payload.pharmacy_name:
        pharm["name"] = payload.pharmacy_name
    pharm["shop_upi_id"] = clean_upi_id
    if payload.terminal_label:
        pharm["terminal_label"] = payload.terminal_label

    store_name = pharm.get("name", "Express Pharmacy")
    
    # Auto-generate dynamic standard QR URL if not custom image uploaded
    if payload.shop_upi_qr and payload.shop_upi_qr.strip():
        pharm["shop_upi_qr"] = payload.shop_upi_qr
    else:
        upi_pay_url = f"upi://pay?pa={clean_upi_id}&pn={quote(store_name)}&cu=INR"
        pharm["shop_upi_qr"] = f"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={quote_plus(upi_pay_url)}"

    pharm["updated_at"] = datetime.now().isoformat()
    logger.info(f"Updated store UPI settings for {pharm_id}: VPA={clean_upi_id}, Terminal={pharm.get('terminal_label')}")

    return {
        "status": "success",
        "message": f"Store UPI settings synchronized successfully for {store_name}!",
        "pharmacy_id": pharm_id,
        "pharmacy_name": store_name,
        "shop_upi_id": clean_upi_id,
        "shop_upi_qr": pharm["shop_upi_qr"],
        "terminal_label": pharm.get("terminal_label", "Counter POS Soundbox"),
        "timestamp": datetime.now().isoformat()
    }

@router.get("/pharmacy/live-terminal-qr")
def get_live_terminal_qr(
    pharmacy_id: str = "PHARM_001",
    amount: Optional[float] = None,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Customers in checkout retrieve the dispatching store's live POS terminal photo if active,
    or the store's verified permanent UPI QR code.
    If amount is provided, dynamically generates an exact amount-encoded UPI Intent URL and QR code.
    """
    pharm = mock_db.pharmacy_metadata.get(pharmacy_id)
    if not pharm:
        if mock_db.pharmacy_metadata:
            pharm = next(iter(mock_db.pharmacy_metadata.values()))
            pharmacy_id = pharm.get("id", "PHARM_001")
        else:
            pharm = {
                "id": "PHARM_001",
                "name": "Vamanjoor Express Pharmacy",
                "shop_upi_id": "vamanjoor.pharmacy@upi"
            }

    live_qr = pharm.get("live_terminal_qr")
    shop_upi_id = pharm.get("shop_upi_id", "vamanjoor.pharmacy@upi")
    pharm_name = pharm.get("name", "Express Pharmacy")
    shop_qr = pharm.get("shop_upi_qr")

    # Generate standard amount-encoded dynamic UPI intent
    order_ref = f"MEDORA-{uuid.uuid4().hex[:6].upper()}"
    if amount and amount > 0:
        dynamic_upi_intent = f"upi://pay?pa={shop_upi_id}&pn={quote(pharm_name)}&am={amount:.2f}&cu=INR&tn={order_ref}"
        dynamic_upi_qr = f"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={quote_plus(dynamic_upi_intent)}"
    else:
        dynamic_upi_intent = f"upi://pay?pa={shop_upi_id}&pn={quote(pharm_name)}&cu=INR&tn=MEDORA-Order"
        dynamic_upi_qr = shop_qr or f"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={quote_plus(dynamic_upi_intent)}"

    if not shop_qr:
        shop_qr = dynamic_upi_qr

    return {
        "status": "success",
        "pharmacy_id": pharmacy_id,
        "pharmacy_name": pharm_name,
        "shop_upi_id": shop_upi_id,
        "shop_upi_qr": shop_qr,
        "dynamic_upi_qr": dynamic_upi_qr,
        "upi_intent": dynamic_upi_intent,
        "amount": amount,
        "live_upi_qr": live_qr,
        "live_terminal_qr_time": pharm.get("live_terminal_qr_time"),
        "terminal_label": pharm.get("terminal_label", "Counter POS Soundbox"),
        "has_live_scanner_qr": bool(live_qr),
        "synced_at": datetime.now().isoformat()
    }




