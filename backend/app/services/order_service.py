from app.core.db import get_supabase_client

class OrderService:
    @staticmethod
    def create_order(payload: dict):
        supabase = get_supabase_client()
        
        # 1. Insert order
        order_data = {
            "user_id": payload["user_id"],
            "pharmacy_id": payload["pharmacy_id"],
            "prescription_id": payload.get("prescription_id"),
            "delivery_type": payload["delivery_type"],
            "total_amount": payload["total_amount"],
            "status": "pending"
        }
        
        if not supabase:
            return None
        response = supabase.table('orders').insert(order_data).execute()
        order = response.data[0] if response.data else None
        
        if order:
            # 2. Insert order items
            items_data = [
                {
                    "order_id": order["id"],
                    "medicine_id": item["medicine_id"],
                    "quantity": item["quantity"],
                    "unit_price": item["unit_price"]
                }
                for item in payload["items"]
            ]
            supabase.table('order_items').insert(items_data).execute()
            
        return order
