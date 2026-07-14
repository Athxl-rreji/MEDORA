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

# Load .env file if present in the ai-services root directory
local_env = os.path.join(os.path.dirname(__file__), '..', '.env')
if os.path.exists(local_env):
    with open(local_env, 'r') as f:
        for line in f:
            if '=' in line and not line.strip().startswith('#'):
                key, val = line.strip().split('=', 1)
                os.environ[key.strip()] = val.strip()


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

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    user_id: str
    messages: List[Message]

class ChatResponse(BaseModel):
    content: str
    session_finished: bool
    diagnosis: Optional[str] = None
    suggested_medicines: List[str] = []

@app.post("/chat", response_model=ChatResponse)
async def chat_diagnose(request: ChatRequest):
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    
    openai_key = os.environ.get("OPENAI_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY")
    
    system_prompt = (
        "You are a professional medical doctor. You are conducting a patient consultation in a chat window. "
        "Follow these rules strictly:\n"
        "1. Be professional, empathetic, and clear.\n"
        "2. Conduct a structured medical interview: ask one diagnostic question at a time. "
        "First, listen to their symptoms. Next, ask about duration. Then, ask about severity/character. "
        "Next, ask about associated symptoms. Next, ask about medical history and allergies.\n"
        "3. Once you have enough context (usually after 4-5 turns), provide a tentative diagnosis and suggest common OTC medicines.\n"
        "4. You MUST include the following disclaimer verbatim in your final diagnosis/suggestion message: "
        "'Disclaimer: I am an AI assistant, not a human medical expert. These are suggestions based on the information provided. "
        "Please consult a qualified medical professional before taking any of these medications.'\n"
        "5. Keep responses relatively concise (1-3 sentences) suitable for a chat bubble, until the final diagnosis."
    )
    
    if openai_key or gemini_key:
        try:
            if gemini_key:
                import urllib.request
                import json
                
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
                
                contents = []
                for m in messages:
                    role = "user" if m["role"] == "user" else "model"
                    contents.append({"role": role, "parts": [{"text": m["content"]}]})
                    
                payload = {
                    "contents": contents,
                    "systemInstruction": {
                        "parts": [{"text": system_prompt}]
                    }
                }
                
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                
                with urllib.request.urlopen(req) as res:
                    response_data = json.loads(res.read().decode("utf-8"))
                    reply = response_data["candidates"][0]["content"]["parts"][0]["text"]
            else:
                import openai
                openai_messages = [{"role": "system", "content": system_prompt}]
                for m in messages:
                    openai_messages.append({"role": m["role"], "content": m["content"]})
                
                if hasattr(openai, "ChatCompletion"):
                    openai.api_key = openai_key
                    response = openai.ChatCompletion.create(
                        model="gpt-3.5-turbo",
                        messages=openai_messages
                    )
                    reply = response.choices[0].message.content
                else:
                    from openai import OpenAI
                    client = OpenAI(api_key=openai_key)
                    response = client.chat.completions.create(
                        model="gpt-3.5-turbo",
                        messages=openai_messages
                    )
                    reply = response.choices[0].message.content
                
            session_finished = "disclaimer" in reply.lower() or "i am an ai" in reply.lower()
            suggested_medicines = []
            
            if session_finished:
                for record in symptom_db:
                    for med in record.get("suggested_otc_medicines", []):
                        if med.lower() in reply.lower() and med not in suggested_medicines:
                            suggested_medicines.append(med)
                if not suggested_medicines:
                    for mname in ["dolo", "crocin", "calpol", "allegra", "ascoril", "avil", "augmentin"]:
                        if mname in reply.lower():
                            suggested_medicines.append(mname.capitalize())
                            
            return ChatResponse(
                content=reply,
                session_finished=session_finished,
                diagnosis="Diagnostic Assessment" if session_finished else None,
                suggested_medicines=suggested_medicines
            )
        except Exception as e:
            pass

    user_msgs = [m for m in messages if m["role"] == "user"]
    num_user_turns = len(user_msgs)
    
    if num_user_turns == 0:
        return ChatResponse(
            content="Hello! I am MEDORA's AI Virtual Doctor. What symptoms are you experiencing today?",
            session_finished=False
        )
    elif num_user_turns == 1:
        return ChatResponse(
            content="I see. How long have you been experiencing these symptoms?",
            session_finished=False
        )
    elif num_user_turns == 2:
        return ChatResponse(
            content="On a scale of 1 to 10, how severe is the discomfort? Is it constant, or does it come and go?",
            session_finished=False
        )
    elif num_user_turns == 3:
        return ChatResponse(
            content="Are you experiencing any other associated symptoms, such as fever, cough, nausea, or dizziness?",
            session_finished=False
        )
    elif num_user_turns == 4:
        return ChatResponse(
            content="Got it. Do you have any existing medical conditions or known allergies to any medicines?",
            session_finished=False
        )
    else:
        first_symptom = user_msgs[0]["content"].lower()
        user_allergies = get_user_allergies(request.user_id)
        
        best_match = None
        highest_score = 0
        
        for record in symptom_db:
            score = 0
            all_symptoms = [s.lower() for s in record["symptoms"]] + [r.lower() for r in record["red_flags"]]
            user_words = set(re.findall(r'\w+', first_symptom))
            
            for sym in all_symptoms:
                sym_words = set(re.findall(r'\w+', sym))
                if sym_words.issubset(user_words):
                    score += 3
                elif sym_words.intersection(user_words):
                    score += len(sym_words.intersection(user_words))
                    
            if score > highest_score:
                highest_score = score
                best_match = record
                
        disclaimer = (
            "\n\n*Disclaimer: I am an AI assistant, not a human medical expert. "
            "These are suggestions based on the information provided. "
            "Please consult a qualified medical professional before taking any of these medications.*"
        )
        
        if not best_match or highest_score == 0:
            return ChatResponse(
                content="Based on our conversation, I cannot make a confident assessment. Please visit a medical clinic or consult a primary care physician." + disclaimer,
                session_finished=True,
                diagnosis="Uncertain Assessment",
                suggested_medicines=[]
            )
            
        detected_flags = []
        user_words = set(re.findall(r'\w+', first_symptom))
        for flag in best_match["red_flags"]:
            flag_words = set(re.findall(r'\w+', flag.lower()))
            if flag_words.intersection(user_words):
                detected_flags.append(flag)
                
        is_critical = len(detected_flags) > 0
        
        if is_critical:
            content = f"⚠️ **CRITICAL WARNING**: Your symptoms ({', '.join(detected_flags)}) are warning signs of a potentially serious condition: **{', '.join(best_match['possible_conditions'])}**.\n\nPlease seek immediate medical attention at an emergency clinic or hospital." + disclaimer
            return ChatResponse(
                content=content,
                session_finished=True,
                diagnosis="Critical Assessment",
                suggested_medicines=[]
            )
            
        allergy_warning = ""
        if user_allergies:
            allergy_warning = f"\n\n*⚠️ Profile Warning: Note that your medical profile lists allergies to: {', '.join(user_allergies)}. Check if these conflict with the suggested OTC drugs.*"
            
        content = (
            f"Based on your symptoms and description, this aligns with **{best_match['possible_conditions'][0]}**.\n\n"
            f"Recommended actions:\n"
            f"- Rest and stay hydrated.\n"
            f"- Consider the following OTC medications: **{', '.join(best_match['suggested_otc_medicines'])}**."
            f"{allergy_warning}"
            f"{disclaimer}"
        )
        
        return ChatResponse(
            content=content,
            session_finished=True,
            diagnosis=best_match['possible_conditions'][0],
            suggested_medicines=best_match["suggested_otc_medicines"]
        )
