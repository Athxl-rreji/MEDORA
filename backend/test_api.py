from fastapi.testclient import TestClient
from main import app
import json

client = TestClient(app)

def test_routes():
    print("Testing /api/v1/orders/create...")
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

    # Don't send pharmacy_id
    response = client.post("/api/v1/orders/create", json=payload)
    print(response.status_code)
    print(response.json())

if __name__ == "__main__":
    test_routes()
