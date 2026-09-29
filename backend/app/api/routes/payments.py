import os
import uuid
import hmac
import hashlib
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.core.logger import logger
from app.core.prototype_db import get_datastore, PrototypeDataStore

router = APIRouter()

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_medora_sandbox_key")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "medora_sandbox_secret")

class CreatePaymentIntentRequest(BaseModel):
    user_id: str
    amount: float
    currency: str = "INR"
    payment_method: str = "upi"  # upi, cod
    notes: Optional[dict] = None

class VerifyPaymentRequest(BaseModel):
    order_id: Optional[str] = None
    payment_id: str
    razorpay_order_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    payment_method: str = "upi"

@router.get("/methods")
def get_payment_methods():
    """Retrieve supported payment methods for checkout. Strictly limited to Store UPI and Cash on Delivery."""
    return {
        "status": "success",
        "methods": [
            {
                "id": "upi",
                "name": "Instant Store UPI / Soundbox QR",
                "description": "Google Pay, PhonePe, Paytm, BHIM with Store QR Sync",
                "icon": "⚡",
                "badge": "Instant Zero-Fee",
                "enabled": True
            },
            {
                "id": "cod",
                "name": "Cash on Delivery (COD)",
                "description": "Pay cash or UPI scan to rider at doorstep",
                "icon": "💵",
                "badge": "Pay at Doorstep",
                "enabled": True
            }
        ]
    }

@router.post("/create-intent")
def create_payment_intent(payload: CreatePaymentIntentRequest):
    """
    Creates a payment intent / order for checkout.
    If Razorpay credentials are present in env, generates a real Razorpay Order ID.
    Otherwise, generates a MEDORA sandbox transaction intent.
    """
    logger.info(f"Creating payment intent of INR {payload.amount} ({payload.currency}) for user {payload.user_id} via {payload.payment_method}")
    
    intent_id = f"pay_intent_{uuid.uuid4().hex[:12]}"
    
    if payload.payment_method not in ("upi", "cod"):
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported payment method '{payload.payment_method}'. Only 'upi' and 'cod' are accepted on MEDORA."
        )

    # Check if using Cash on Delivery
    if payload.payment_method == "cod":
        return {
            "status": "success",
            "payment_intent_id": intent_id,
            "amount": payload.amount,
            "currency": payload.currency,
            "payment_method": "cod",
            "requires_interactive_auth": False,
            "gateway_order_id": f"COD_{uuid.uuid4().hex[:8].upper()}",
            "key_id": "COD_MODE"
        }

    # If Razorpay keys are configured and valid
    if os.getenv("RAZORPAY_KEY_ID") and os.getenv("RAZORPAY_KEY_SECRET"):
        try:
            import razorpay
            client = razorpay.Client(auth=(os.getenv("RAZORPAY_KEY_ID"), os.getenv("RAZORPAY_KEY_SECRET")))
            razor_order = client.order.create({
                "amount": int(payload.amount * 100),  # Amount in paise
                "currency": payload.currency,
                "receipt": intent_id,
                "notes": payload.notes or {}
            })
            return {
                "status": "success",
                "payment_intent_id": intent_id,
                "amount": payload.amount,
                "currency": payload.currency,
                "payment_method": payload.payment_method,
                "requires_interactive_auth": True,
                "gateway_order_id": razor_order["id"],
                "key_id": os.getenv("RAZORPAY_KEY_ID")
            }
        except Exception as e:
            logger.warning(f"Razorpay integration fallback to Sandbox: {e}")

    # Default Sandbox Gateway Intent
    return {
        "status": "success",
        "payment_intent_id": intent_id,
        "amount": payload.amount,
        "currency": payload.currency,
        "payment_method": payload.payment_method,
        "requires_interactive_auth": True,
        "gateway_order_id": f"rzp_sandbox_{uuid.uuid4().hex[:10]}",
        "key_id": RAZORPAY_KEY_ID
    }

@router.post("/verify")
def verify_payment(
    payload: VerifyPaymentRequest,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Verifies payment completion.
    Supports real Razorpay HMAC-SHA256 signature verification or Sandbox auto-verification.
    Updates existing order's payment status to 'paid' if order_id is supplied.
    """
    logger.info(f"Verifying payment {payload.payment_id} for method {payload.payment_method}")
    
    is_valid = True
    
    # If Razorpay signature provided
    if payload.razorpay_order_id and payload.razorpay_signature and os.getenv("RAZORPAY_KEY_SECRET"):
        try:
            try:
                import razorpay
                client = razorpay.Client(auth=(os.getenv("RAZORPAY_KEY_ID"), os.getenv("RAZORPAY_KEY_SECRET")))
                client.utility.verify_payment_signature({
                    'razorpay_order_id': payload.razorpay_order_id,
                    'razorpay_payment_id': payload.payment_id,
                    'razorpay_signature': payload.razorpay_signature
                })
                is_valid = True
            except Exception as rzp_err:
                logger.warning(f"Razorpay SDK verification exception, testing HMAC manual calculation: {rzp_err}")
                msg = f"{payload.razorpay_order_id}|{payload.payment_id}"
                generated_signature = hmac.new(
                    os.getenv("RAZORPAY_KEY_SECRET").encode(),
                    msg.encode(),
                    hashlib.sha256
                ).hexdigest()
                is_valid = hmac.compare_digest(generated_signature, payload.razorpay_signature)
        except Exception as e:
            logger.error(f"Error calculating HMAC signature: {e}")
            is_valid = False

    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    # Update order payment status in prototype DB if order_id is provided
    if payload.order_id:
        for order in mock_db.orders:
            if order.get("id") == payload.order_id:
                order["payment_status"] = "paid"
                order["payment_id"] = payload.payment_id
                logger.info(f"Updated order {payload.order_id} payment_status to 'paid'")
                break

    return {
        "status": "success",
        "verified": True,
        "payment_id": payload.payment_id,
        "payment_status": "paid",
        "message": "Payment verified and order confirmed successfully!"
    }
