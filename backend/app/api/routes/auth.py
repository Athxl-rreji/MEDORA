from fastapi import APIRouter, HTTPException, Depends
from supabase import Client
from app.core.db import get_supabase_client
from pydantic import BaseModel

router = APIRouter()

class AuthData(BaseModel):
    email: str
    password: str

@router.post("/login")
def login(data: AuthData, db: Client = Depends(get_supabase_client)):
    try:
        response = db.auth.sign_in_with_password({"email": data.email, "password": data.password})
        return {"token": response.session.access_token, "user": response.user}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/register")
def register(data: AuthData, db: Client = Depends(get_supabase_client)):
    try:
        response = db.auth.sign_up({"email": data.email, "password": data.password})
        return {"status": "created", "user": response.user}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
