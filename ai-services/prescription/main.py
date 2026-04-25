from fastapi import FastAPI
from pydantic import BaseModel
import pytesseract
from PIL import Image
import io

app = FastAPI(title="AI Prescription Verification Service")

class OCRRequest(BaseModel):
    image_bytes: bytes

@app.post("/extract-prescription")
async def extract_prescription(request: OCRRequest):
    img = Image.open(io.BytesIO(request.image_bytes))
    text = pytesseract.image_to_string(img)
    
    # NLP logic to extract medicines & salt compositions here
    # Mock return for architecture
    return {
        "status": "success",
        "extracted_text": text,
        "medicines": [
            {"name": "Amoxicillin", "dosage": "500mg"}
        ],
        "is_safe": True
    }
