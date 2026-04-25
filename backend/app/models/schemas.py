from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class MedicineBase(BaseModel):
    brand_name: str
    generic_name: str
    category: str
    avg_price: float
    manufacturer: Optional[str] = None
    high_risk: bool = False

class MedicineResponse(MedicineBase):
    id: str
    created_at: datetime

class OrderCreate(BaseModel):
    user_id: str
    pharmacy_id: str
    prescription_id: Optional[str] = None
    delivery_type: str
    items: List[dict] # { medicine_id, quantity }
    total_amount: float
