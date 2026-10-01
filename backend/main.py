import os
import dotenv
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError

# Load .env file at startup
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
dotenv.load_dotenv(dotenv_path)

from app.api.routes import auth, medicines, orders, prescriptions, payments, admin, ai
from app.core.logger import logger

app = FastAPI(
    title="MEDORA Backend API",
    description="Scalable backend for Medora Pharmacy Ecosystem",
    version="1.0.0"
)

# CORS config — supports all Vercel and localhost origins with credentials
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "").strip()
if _raw_origins and _raw_origins != "*":
    _allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # When in production with dynamic Vercel preview/production URLs, regex matches any http/https origin safely with credentials
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^https?://.*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(medicines.router, prefix="/api/v1/medicines", tags=["Medicines"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["Orders"])
app.include_router(prescriptions.router, prefix="/api/v1/prescriptions", tags=["Prescriptions"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["Payments"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["AI"])
app.include_router(ai.router, prefix="/api/v1", tags=["AI"]) # supports /api/v1/chat
app.include_router(ai.router, prefix="", tags=["AI"])       # supports /chat

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "medora-backend"}

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    try:
        body = await request.body()
        logger.error(f"Validation Error on {request.method} {request.url}. Body: {body.decode()} - Errors: {exc.errors()}")
    except Exception:
        pass
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global Exception on {request.method} {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": f"Internal error: {str(exc)}", "type": exc.__class__.__name__}
    )
