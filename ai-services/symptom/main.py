from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import json
import os
import re

app = FastAPI(title="MEDORA AI Symptom Assistant")

# ENABLE CORS FOR FRONTEND Integration!
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SymptomRequest(BaseModel):
    user_id: str
    symptoms: str

class SymptomResponse(BaseModel):
    critical: bool
    message: str
    possible_conditions: List[str]
    suggested_otc_medicines: List[str]
    detected_red_flags: List[str]

DATASETS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'datasets')
TRAINING_FILE = os.path.join(DATASETS_DIR, 'ai_symptom_training.json')
USERS_FILE = os.path.join(DATASETS_DIR, 'users.csv')

symptom_db = []
if os.path.exists(TRAINING_FILE):
    with open(TRAINING_FILE, 'r') as f:
        symptom_db = json.load(f)

def get_user_allergies(user_id: str) -> List[str]:
    allergies = []
    if os.path.exists(USERS_FILE):
        import csv
        with open(USERS_FILE, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row["user_id"] == user_id:
                    alg = row.get("allergies", "None")
                    if alg and alg.lower() != "none":
                        allergies = [a.strip().lower() for a in alg.split(',')]
                    break
    return allergies

@app.post("/analyze", response_model=SymptomResponse)
async def analyze_symptom(request: SymptomRequest):
    user_input = request.symptoms.lower()
    user_allergies = get_user_allergies(request.user_id)
    
    best_match = None
    highest_score = 0
    
    for record in symptom_db:
        score = 0
        all_symptoms = [s.lower() for s in record["symptoms"]] + [r.lower() for r in record["red_flags"]]
        user_words = set(re.findall(r'\w+', user_input.lower()))
        
        for sym in all_symptoms:
            sym_words = set(re.findall(r'\w+', sym))
            if sym_words.issubset(user_words):
                score += 3  # Full phrase match gets higher weight
            elif sym_words.intersection(user_words):
                score += len(sym_words.intersection(user_words))
                
        if score > highest_score:
            highest_score = score
            best_match = record

    if not best_match or highest_score == 0:
        return SymptomResponse(
            critical=False,
            message="I'm sorry, I cannot confidently diagnose this. Please consult a doctor immediately.",
            possible_conditions=[],
            suggested_otc_medicines=[],
            detected_red_flags=[]
        )
        
    detected_flags = []
    user_words = set(re.findall(r'\w+', user_input.lower()))
    for flag in best_match["red_flags"]:
        flag_words = set(re.findall(r'\w+', flag.lower()))
        if flag_words.intersection(user_words):
            detected_flags.append(flag)
            
    is_critical = len(detected_flags) > 0
    
    if is_critical:
        message = f"URGENT: Your symptoms ({', '.join(detected_flags)}) are red flags indicating possible {', '.join(best_match['possible_conditions'])}. Please visit an ER immediately."
        return SymptomResponse(
            critical=True,
            message=message,
            possible_conditions=best_match["possible_conditions"],
            suggested_otc_medicines=[],
            detected_red_flags=detected_flags
        )

    warning = ""
    if user_allergies:
        warning = f"\n⚠️ PROFILE WARNING: Ensure the OTC suggested doesn't conflict with your known allergies: {', '.join(user_allergies)}."

    message = f"This aligns with {best_match['possible_conditions'][0]}." + warning

    return SymptomResponse(
        critical=False,
        message=message,
        possible_conditions=best_match["possible_conditions"],
        suggested_otc_medicines=best_match["suggested_otc_medicines"],
        detected_red_flags=[]
    )
