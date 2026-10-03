import re
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from app.core.prototype_db import PrototypeDataStore, get_datastore
from app.core.email_service import send_email_otp, send_partner_request_email
from app.core.logger import logger

router = APIRouter()

class LoginRequest(BaseModel):
    identifier: str # Email
    auth_mode: str = "password" # "password" or "otp"
    password: Optional[str] = None
    otp: Optional[str] = None
    role: Optional[str] = None

class SendOtpRequest(BaseModel):
    identifier: str

class RegisterStartRequest(BaseModel):
    full_name: str
    role: str = "patient" # "patient" | "pharmacy" | "delivery"
    email: str
    phone: str
    password: str
    address: Optional[str] = None

class RegisterRequest(BaseModel):
    full_name: str
    role: str = "patient"
    email: str
    phone: str
    username: Optional[str] = None
    password: str
    address: Optional[str] = None
    pharmacy_license: Optional[str] = None
    vehicle_type: Optional[str] = None
    driving_license: Optional[str] = None

class RegisterVerifyRequest(BaseModel):
    email: str
    otp: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str

class ChangeFirstPasswordRequest(BaseModel):
    identifier: str
    temp_password: str
    new_password: str
    confirm_password: Optional[str] = None

class PartnerRequest(BaseModel):
    partner_type: str # "pharmacy" | "delivery"
    full_name: str
    email: str
    phone: str
    store_name: Optional[str] = None
    license_no: Optional[str] = None
    store_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    vehicle_type: Optional[str] = None
    driving_license: Optional[str] = None
    vehicle_number: Optional[str] = None
    delivery_zone: Optional[str] = None
    shift_preference: Optional[str] = None
    rider_upi_id: Optional[str] = None
    rider_upi_qr: Optional[str] = None
    shop_upi_id: Optional[str] = None
    shop_upi_qr: Optional[str] = None

@router.post("/send-otp")
def send_otp(
    payload: SendOtpRequest,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Generates & dispatches a 6-digit OTP code to the given email address.
    """
    if not payload.identifier or not payload.identifier.strip():
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    
    otp_code = mock_db.generate_otp(payload.identifier)
    email_sent = send_email_otp(payload.identifier, otp_code, "Registration Verification")
    
    logger.info(f"Generated secure OTP for identifier: {payload.identifier}")
    return {
        "status": "success",
        "message": f"6-digit OTP code sent successfully to {payload.identifier}",
        "email_sent": email_sent,
        "expires_in_seconds": 300
    }

@router.post("/register/start")
def register_start(
    payload: RegisterStartRequest,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Step 1: Validates form inputs, generates 6-digit OTP, mails to user, and stores pending registration.
    (Does NOT save user to datastore until OTP is verified).
    """
    try:
        otp_code = mock_db.create_pending_registration(
            full_name=payload.full_name,
            role=payload.role,
            email=payload.email,
            phone=payload.phone,
            password=payload.password,
            address=payload.address
        )
        email_sent = send_email_otp(payload.email, otp_code, "Registration Verification")
        
        return {
            "status": "success",
            "message": f"A 6-digit verification code has been sent to {payload.email}. Please check your email inbox to complete registration.",
            "email_sent": email_sent,
            "expires_in_seconds": 300
        }
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration start failed: {str(e)}")

@router.post("/register/verify")
def register_verify(
    payload: RegisterVerifyRequest,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Step 2: Verifies 6-digit OTP code received in email and commits user credentials to permanent datastore.
    """
    try:
        new_user = mock_db.confirm_pending_registration(payload.email, payload.otp)
        return {
            "status": "success",
            "message": "Account registered successfully",
            "user": new_user,
            "token": f"medora_token_{new_user['id']}"
        }
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration verification failed: {str(e)}")

@router.post("/forgot-password")
@router.post("/forgot-password/send-otp")
def forgot_password_send_otp(
    payload: ForgotPasswordRequest,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Generates & dispatches a 6-digit OTP for Password Reset.
    """
    user = mock_db.find_user(payload.email)
    if not user:
        raise HTTPException(status_code=404, detail="No registered user found with this email address.")
    
    otp_code = mock_db.generate_otp(payload.email)
    email_sent = send_email_otp(payload.email, otp_code, "Password Reset")
    
    return {
        "status": "success",
        "message": f"Password reset OTP sent to {payload.email}",
        "email_sent": email_sent,
        "expires_in_seconds": 300
    }

@router.post("/reset-password")
@router.post("/forgot-password/reset")
def reset_password(
    payload: ResetPasswordRequest,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Verifies 6-digit OTP and resets user password.
    """
    is_valid, msg = mock_db.verify_otp(payload.email, payload.otp)
    if not is_valid:
        raise HTTPException(status_code=400, detail=msg)
    
    success = mock_db.update_password(payload.email, payload.new_password)
    if not success:
        raise HTTPException(status_code=404, detail="User account not found.")
    
    return {
        "status": "success",
        "message": "Password reset successfully. You can now sign in with your new password."
    }

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

def is_valid_email_address(email: str) -> bool:
    if not email or not isinstance(email, str):
        return False
    clean = email.strip()
    if not EMAIL_REGEX.match(clean):
        return False
    domain = clean.split('@')[-1].lower()
    if domain in ['test', 'asdf', 'xyz', 'example', 'domain', 'none', 'invalid']:
        return False
    if '.' not in domain:
        return False
    return True

@router.post("/partner-request")
def partner_request(
    payload: PartnerRequest,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Submits a Pharmacy Store or Delivery Rider partner application, validates email format, saves to admin database, and dispatches notification.
    """
    if not is_valid_email_address(payload.email):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid, reachable email address (e.g. name@gmail.com) so you can receive application approval or decision status emails."
        )

    details = {
        "store_name": payload.store_name,
        "license_no": payload.license_no,
        "store_address": payload.store_address,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "vehicle_type": payload.vehicle_type,
        "driving_license": payload.driving_license,
        "vehicle_number": payload.vehicle_number,
        "delivery_zone": payload.delivery_zone,
        "shift_preference": payload.shift_preference,
        "rider_upi_id": payload.rider_upi_id,
        "rider_upi_qr": payload.rider_upi_qr,
        "shop_upi_id": payload.shop_upi_id,
        "shop_upi_qr": payload.shop_upi_qr
    }
    
    new_req = mock_db.create_partner_request(
        partner_type=payload.partner_type,
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        details=details
    )

    email_sent = send_partner_request_email(
        partner_type=payload.partner_type,
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        details=details
    )
    
    return {
        "status": "success",
        "message": f"Your {payload.partner_type.upper()} application (ID: {new_req['id']}) has been submitted successfully for admin review!",
        "request": new_req,
        "email_sent": email_sent
    }

@router.post("/login")
def login(
    payload: LoginRequest,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Authenticates user via Email + Password or Partner login.
    """
    clean_id = payload.identifier.strip().lower()
    if clean_id in mock_db.deleted_users:
        raise HTTPException(
            status_code=404,
            detail="This account has been permanently deleted by the administrator."
        )

    user = mock_db.find_user(payload.identifier)
    
    if payload.auth_mode == "otp":
        if not payload.otp:
            raise HTTPException(status_code=400, detail="6-digit OTP code is required.")
            
        is_valid, msg = mock_db.verify_otp(payload.identifier, payload.otp)
        if not is_valid:
            raise HTTPException(status_code=400, detail=msg)
        
        if user and user.get("status") == "deactivated":
            raise HTTPException(
                status_code=403,
                detail="Your account has been deactivated by the system administrator. Please contact support."
            )

        if not user:
            role = payload.role or "patient"
            user = {
                "id": f"usr_otp_{payload.identifier[:6]}",
                "full_name": f"Verified User ({payload.identifier})",
                "role": role,
                "email": payload.identifier,
                "phone": "+919999999999",
                "username": payload.identifier.split("@")[0]
            }

    else:
        clean_id = payload.identifier.strip().lower()
        if clean_id in ["admin", "admin@medora.com"]:
            user = mock_db.find_user("admin") or mock_db.find_user("admin@medora.com")
            if not user:
                user = {
                    "id": "usr_admin_1",
                    "full_name": "MEDORA System Administrator",
                    "role": "admin",
                    "email": "admin@medora.com",
                    "username": "admin",
                    "password": "admin",
                    "status": "active"
                }
                mock_db.users.append(user)

        if not user:
            raise HTTPException(
                status_code=404, 
                detail="No registered account found matching this email. Please click 'Register / Sign Up' to create an account."
            )

        if user.get("status") == "deactivated":
            raise HTTPException(
                status_code=403,
                detail="Your account has been deactivated by the system administrator. Please contact support."
            )

        is_admin_user = user.get("role") == "admin" or clean_id in ["admin", "admin@medora.com"]
        if is_admin_user:
            if payload.password not in ["admin", "admin123"]:
                raise HTTPException(
                    status_code=401,
                    detail="Incorrect admin password. Please try 'admin'."
                )
        elif user.get("password") and user.get("password") != payload.password:
            raise HTTPException(
                status_code=401, 
                detail="Incorrect password. Please verify your credentials or click 'Forgot Password?' to reset."
            )

    must_change = bool(user.get("must_change_password", False))
    return {
        "status": "success",
        "message": "Authentication successful",
        "must_change_password": must_change,
        "user": {
            "id": user["id"],
            "full_name": user.get("full_name", "MEDORA User"),
            "role": user.get("role", "patient"),
            "email": user.get("email", ""),
            "phone": user.get("phone", ""),
            "username": user.get("username", ""),
            "must_change_password": must_change
        },
        "token": f"medora_token_{user['id']}"
    }

@router.post("/change-first-password")
@router.post("/setup-password")
def change_first_password(
    payload: ChangeFirstPasswordRequest,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Mandatory first-time password setup for newly approved Partner accounts (pharmacies & delivery riders)
    who were issued temporary passwords upon admin onboarding.
    Validates temp password, enforces strong permanent password, updates SQLite, and clears the flag.
    """
    if not payload.identifier or not payload.identifier.strip():
        raise HTTPException(status_code=400, detail="Identifier (email or username) is required.")
    if not payload.temp_password or not payload.temp_password.strip():
        raise HTTPException(status_code=400, detail="Please enter your temporary password.")
    if not payload.new_password or not payload.new_password.strip():
        raise HTTPException(status_code=400, detail="Please enter a new permanent password.")
    if payload.confirm_password and payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="The confirmed password does not match the new password.")

    try:
        updated_user = mock_db.set_first_time_password(
            identifier=payload.identifier.strip(),
            temp_password=payload.temp_password.strip(),
            new_password=payload.new_password.strip()
        )
        return {
            "status": "success",
            "message": "Permanent password successfully configured! You can now access your dashboard.",
            "user": {
                "id": updated_user["id"],
                "full_name": updated_user.get("full_name", "MEDORA Partner"),
                "role": updated_user.get("role", "pharmacy"),
                "email": updated_user.get("email", ""),
                "phone": updated_user.get("phone", ""),
                "username": updated_user.get("username", ""),
                "must_change_password": False
            },
            "token": f"medora_token_{updated_user['id']}"
        }
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        logger.error(f"Error changing first-time password for {payload.identifier}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to configure password: {str(e)}")

@router.post("/register")
def register(
    payload: RegisterRequest,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Registers a new user account.
    """
    try:
        new_user = mock_db.register_user(
            full_name=payload.full_name,
            role=payload.role,
            email=payload.email,
            phone=payload.phone,
            username=payload.username,
            password=payload.password,
            address=payload.address,
            pharmacy_license=payload.pharmacy_license,
            vehicle_type=payload.vehicle_type,
            driving_license=payload.driving_license
        )
        logger.info(f"Registered new account: {new_user['full_name']} ({new_user['role']})")
        return {
            "status": "success",
            "message": "Account registered successfully",
            "user": new_user,
            "token": f"medora_token_{new_user['id']}"
        }
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@router.get("/user-status")
def check_user_status(
    identifier: Optional[str] = Query(None),
    email: Optional[str] = Query(None),
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    target = identifier or email
    if not target:
        raise HTTPException(status_code=400, detail="Missing identifier or email parameter")
    clean_id = target.strip().lower()
    if clean_id in mock_db.deleted_users:
        return {"exists": False, "status": "deleted"}
    user = mock_db.find_user(target)
    if not user:
        return {"exists": False, "status": "deleted"}
    return {
        "exists": True,
        "status": user.get("status", "active"),
        "role": user.get("role", "patient"),
        "email": user.get("email")
    }

