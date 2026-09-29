from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from app.core.prototype_db import PrototypeDataStore, get_datastore
from app.core.email_service import send_partner_approval_email, send_partner_rejection_email
from app.core.logger import logger

router = APIRouter()

class RejectRequestPayload(BaseModel):
    reason: Optional[str] = "Application credentials could not be verified."

@router.get("/partner-requests")
def list_partner_requests(
    status: Optional[str] = Query(None, description="Filter by status: pending, approved, rejected, all"),
    partner_type: Optional[str] = Query(None, description="Filter by role: pharmacy, delivery, all"),
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Returns all submitted Pharmacy and Rider partner applications.
    """
    requests = mock_db.get_partner_requests(status=status, partner_type=partner_type)
    return {
        "status": "success",
        "count": len(requests),
        "requests": requests
    }

@router.post("/partner-requests/{req_id}/approve")
def approve_partner_request(
    req_id: str,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Approves a partner application, registers their user account, and emails login credentials via Gmail SMTP.
    """
    try:
        result = mock_db.approve_partner_request(req_id)
        req = result["request"]
        user = result["user"]
        temp_password = result["temp_password"]

        # Send approval notification email
        email_sent = send_partner_approval_email(
            recipient_email=req["email"],
            full_name=req["full_name"],
            partner_type=req["partner_type"],
            temp_password=temp_password
        )

        return {
            "status": "success",
            "message": f"Partner request {req_id} approved successfully! Login credentials dispatched to {req['email']}.",
            "request": req,
            "user": user,
            "email_sent": email_sent
        }
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        logger.error(f"Approval error for {req_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to approve partner request: {str(e)}")

@router.post("/partner-requests/{req_id}/reject")
def reject_partner_request(
    req_id: str,
    payload: RejectRequestPayload,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Rejects a partner application with a reason and sends a rejection notification email.
    """
    try:
        req = mock_db.reject_partner_request(req_id, reason=payload.reason)
        
        # Send rejection notification email with full details and stated reason
        email_sent = send_partner_rejection_email(
            recipient_email=req["email"],
            full_name=req["full_name"],
            partner_type=req["partner_type"],
            reason=payload.reason,
            details=req,
            request_id=req_id
        )

        return {
            "status": "success",
            "message": f"Partner request {req_id} rejected. Official rejection notice with reason dispatched to {req['email']}.",
            "request": req,
            "email_sent": email_sent
        }
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        logger.error(f"Rejection error for {req_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reject partner request: {str(e)}")

@router.delete("/partner-requests/{req_id}")
def delete_partner_request(
    req_id: str,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Permanently removes a partner application from the onboarding KYC list.
    """
    try:
        deleted = mock_db.delete_partner_request(req_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Partner request not found.")
        return {
            "status": "success",
            "message": f"Partner request {req_id} removed from onboarding list successfully."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete partner request error for {req_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete partner request: {str(e)}")

# ─── USER ACCOUNTS MANAGEMENT ───
class UserStatusPayload(BaseModel):
    status: str # 'active' | 'deactivated'

@router.get("/users")
def get_admin_users(
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Returns all registered patient, pharmacy, rider, and admin accounts with their active/deactivated status.
    """
    users = mock_db.get_all_users()
    return {
        "status": "success",
        "count": len(users),
        "users": users
    }

@router.put("/users/{user_id}/status")
def update_user_status(
    user_id: str,
    payload: UserStatusPayload,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Toggles a user account between 'active' and 'deactivated'.
    """
    try:
        user = mock_db.set_user_status(user_id, payload.status)
        return {
            "status": "success",
            "message": f"User {user.get('email')} is now {payload.status}.",
            "user": user
        }
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        logger.error(f"Status update error for user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update user status: {str(e)}")

@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    mock_db: PrototypeDataStore = Depends(get_datastore)
):
    """
    Permanently deletes a user account.
    """
    try:
        mock_db.delete_user_account(user_id)
        return {
            "status": "success",
            "message": f"User account {user_id} deleted permanently."
        }
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        logger.error(f"Delete error for user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete user account: {str(e)}")

