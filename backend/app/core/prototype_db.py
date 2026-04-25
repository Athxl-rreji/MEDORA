import csv
import json
import os
from typing import List, Dict, Optional
from app.core.logger import logger

DATASETS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'datasets')

class PrototypeDataStore:
    def __init__(self):
        self.medicines: Dict[str, dict] = {}
        self.inventory: List[dict] = []
        self.symptoms: List[dict] = []
        self.orders: List[dict] = []
        self.load_data()

    def load_data(self):
        med_path = os.path.join(DATASETS_DIR, 'core_medicines.csv')
        if os.path.exists(med_path):
            with open(med_path, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    self.medicines[row["medicine_id"]] = row
            logger.info(f"Loaded {len(self.medicines)} medicines from {med_path}")
        else:
            logger.error(f"Failed to load medicines: file not found at {med_path}")

        inv_path = os.path.join(DATASETS_DIR, 'pharmacy_inventory.csv')
        if os.path.exists(inv_path):
            with open(inv_path, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    self.inventory.append(row)
            logger.info(f"Loaded {len(self.inventory)} inventory records from {inv_path}")
        else:
            logger.error(f"Failed to load inventory: file not found at {inv_path}")

        sym_path = os.path.join(DATASETS_DIR, 'ai_symptom_training.json')
        if os.path.exists(sym_path):
            with open(sym_path, mode='r', encoding='utf-8') as f:
                self.symptoms = json.load(f)
            logger.info(f"Loaded {len(self.symptoms)} symptom records from {sym_path}")
        else:
            logger.error(f"Failed to load symptoms: file not found at {sym_path}")

    def search_medicines(self, query: str) -> List[dict]:
        query = query.lower()
        results = []
        for med in self.medicines.values():
            if query in med["brand_name"].lower() or query in med["generic_name"].lower():
                results.append(med)
        return results

    def get_alternative(self, medicine_id: str) -> List[dict]:
        med = self.medicines.get(medicine_id)
        if not med: return []
        generic = med["generic_name"].lower()
        alternatives = [
            alt for alt in self.medicines.values()
            if alt["medicine_id"] != medicine_id and alt["generic_name"].lower() == generic
        ]
        alternatives.sort(key=lambda x: float(x["price_mrp"]))
        return alternatives

    def get_availability(self, medicine_id: str) -> List[dict]:
        return [inv for inv in self.inventory if inv["medicine_id"] == medicine_id and int(inv["quantity_available"]) > 0]

    def create_order(self, order_id: str, user_id: str, items: List[dict], type_d: str, distance: str, pharmacy_id: str = "Vamanjoor Pharmacy, Mangalore"):
        logger.info(f"DB: Saving order {order_id} for user {user_id}")
        new_order = {
            "id": order_id,
            "user": user_id,
            "items": items,
            "type": type_d,
            "distance": distance,
            "pharmacy_id": pharmacy_id,
            "status": "pending"
        }
        self.orders.append(new_order)
        return new_order

    def get_orders_by_status(self, status: Optional[str] = None) -> List[dict]:
        if status:
            return [o for o in self.orders if o.get("status") == status]
        # Default: return pending + accepted (pharmacy view)
        return [o for o in self.orders if o.get("status") in ["pending", "accepted"]]

    def get_active_orders(self) -> List[dict]:
        return self.get_orders_by_status("pending")

    def get_user_orders(self, user_id: str) -> List[dict]:
        return [o for o in self.orders if o.get("user") == user_id]

    def update_order_status(self, order_id: str, new_status: str):
        for o in self.orders:
            if o["id"] == order_id:
                o["status"] = new_status
                return o
        return None

global_datastore = None

def get_datastore() -> PrototypeDataStore:
    global global_datastore
    if not global_datastore:
        global_datastore = PrototypeDataStore()
    return global_datastore
