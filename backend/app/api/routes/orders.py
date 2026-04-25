from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
import uuid
from app.core.db import get_supabase_client
from app.core.prototype_db import get_datastore, PrototypeDataStore
from supabase import Client
from app.core.logger import logger

router = APIRouter()

# Full lifecycle: pending -> accepted -> ready -> out_for_delivery -> delivered
VALID_STATUSES = ["pending", "accepted", "ready", "out_for_delivery", "delivered", "rejected"]

@router.delete("/clear")
def clear_all_orders(mock_db: PrototypeDataStore = Depends(get_datastore)):
    """Dev/test endpoint: wipe all in-memory orders instantly."""
    count = len(mock_db.orders)
    mock_db.orders.clear()
    logger.info(f"Cleared {count} orders from prototype DB")
    return {"status": "success", "cleared": count}

class OrderItem(BaseModel):
    medicine_id: Optional[str] = None
    brand_name: str
    price_mrp: float
    quantity: int = 1

class OrderCreateRequest(BaseModel):
    user_id: str
    pharmacy_id: str = "Vamanjoor Pharmacy, Mangalore"
    items: List[OrderItem]
    delivery_type: str = "15-Min Quick Commerce"
    distance: str = "1.2 km away"

class OrderStatusUpdate(BaseModel):
    status: str


@router.post("/create")
def create_order(
    payload: OrderCreateRequest,
    db: Client = Depends(get_supabase_client),
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    logger.info(f"Creating order for user {payload.user_id} with {len(payload.items)} items")
    try:
        total_amt = sum([item.price_mrp * item.quantity for item in payload.items])
        order_insert = db.table("orders").insert({
            "user_id": payload.user_id,
            "pharmacy_id": payload.pharmacy_id,
            "delivery_type": "delivery",
            "total_amount": total_amt,
            "status": "pending"
        }).execute()
        created_order_uuid = order_insert.data[0]["id"]
        order_items_payload = [{
            "order_id": created_order_uuid,
            "medicine_id": item.medicine_id,
            "quantity": item.quantity,
            "unit_price": item.price_mrp
        } for item in payload.items]
        db.table("order_items").insert(order_items_payload).execute()
        logger.info(f"Successfully created order {created_order_uuid}")
        return {"status": "success", "order": order_insert.data[0]}
    except Exception as e:
        logger.warning(f"Supabase insert failed: {e}. Falling back to Prototype DB.")
        order_id = f"ORD-{uuid.uuid4().hex[:6].upper()}"
        new_order = mock_db.create_order(
            order_id=order_id,
            user_id=payload.user_id,
            items=[item.dict() for item in payload.items],
            type_d=payload.delivery_type,
            distance=payload.distance,
            pharmacy_id=payload.pharmacy_id
        )
        return {"status": "success", "order": new_order}


@router.get("/active")
def get_active_orders(
    status: Optional[str] = Query(None, description="Filter by status"),
    db: Client = Depends(get_supabase_client),
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    logger.info(f"Fetching orders with status filter: {status}")
    try:
        query = db.table("orders").select("*, order_items(*)")
        if status:
            query = query.eq("status", status)
        else:
            # Default: pharmacy sees pending + accepted
            query = query.in_("status", ["pending", "accepted"])
        orders = query.execute()
        formatted_orders = []
        for o in orders.data:
            formatted_orders.append({
                "id": o["id"],
                "user": o["user_id"],
                "type": o.get("delivery_type", "delivery"),
                "distance": "Vamanjoor Pharmacy, Mangalore",
                "status": o["status"],
                "pharmacy_id": o.get("pharmacy_id", "Vamanjoor Pharmacy, Mangalore"),
                "items": [{"brand_name": item.get("medicine_id") or "Unknown", "quantity": item["quantity"]} for item in o.get("order_items", [])]
            })
        return {"status": "success", "orders": formatted_orders}
    except Exception as e:
        logger.warning(f"Supabase fetch failed: {e}. Falling back to Prototype DB.")
        orders = mock_db.get_orders_by_status(status)
        return {"status": "success", "orders": orders}


@router.get("/user/{user_id}")
def get_user_orders(
    user_id: str,
    db: Client = Depends(get_supabase_client),
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    logger.info(f"Fetching orders for user {user_id}")
    try:
        orders = db.table("orders").select("*, order_items(*)").eq("user_id", user_id).order("created_at", desc=True).limit(10).execute()
        formatted = []
        for o in orders.data:
            formatted.append({
                "id": o["id"],
                "user": o["user_id"],
                "status": o["status"],
                "pharmacy_id": o.get("pharmacy_id", "Vamanjoor Pharmacy, Mangalore"),
                "type": o.get("delivery_type", "delivery"),
                "distance": "Vamanjoor Pharmacy, Mangalore",
                "items": [{"brand_name": item.get("medicine_id") or "Item", "quantity": item["quantity"]} for item in o.get("order_items", [])]
            })
        return {"status": "success", "orders": formatted}
    except Exception as e:
        logger.warning(f"Supabase user fetch failed: {e}. Falling back.")
        orders = mock_db.get_user_orders(user_id)
        return {"status": "success", "orders": orders}


@router.put("/{order_id}/status")
def update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    db: Client = Depends(get_supabase_client),
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {VALID_STATUSES}")
    logger.info(f"Updating order {order_id} to status: {payload.status}")
    try:
        updated = db.table("orders").update({"status": payload.status}).eq("id", order_id).execute()
        if not updated.data:
            raise HTTPException(status_code=404, detail="Order not found")
        return {"status": "success", "order": updated.data[0]}
    except Exception as e:
        logger.warning(f"Supabase update failed: {e}. Falling back to Prototype DB.")
        updated = mock_db.update_order_status(order_id, payload.status)
        if not updated:
            raise HTTPException(status_code=404, detail="Order not found")
        return {"status": "success", "order": updated}
