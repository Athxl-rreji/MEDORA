import json
from pydantic import BaseModel, ValidationError
from typing import List, Optional

class OrderItem(BaseModel):
    medicine_id: Optional[str] = None
    brand_name: str
    price_mrp: float
    quantity: int = 1

class OrderCreateRequest(BaseModel):
    user_id: str
    pharmacy_id: Optional[str] = None
    items: List[OrderItem]
    delivery_type: str = "15-Min Quick Commerce"
    distance: str = "1.2 km away"

payload = {
    "user_id": "USR003",
    "items": [{
        "medicine_id": "MED002",
        "brand_name": "Dolo",
        "price_mrp": 30.0,
        "quantity": 1
    }],
    "delivery_type": "15-Min Quick Commerce",
    "distance": "2.5 km away"
}

try:
    OrderCreateRequest(**payload)
    print("SUCCESS")
except ValidationError as e:
    print("FAILED", e.errors())
