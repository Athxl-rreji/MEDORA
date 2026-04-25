import requests

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

resp = requests.post("http://127.0.0.1:8000/api/v1/orders/create", json=payload)
print(resp.status_code)
print(resp.text)
