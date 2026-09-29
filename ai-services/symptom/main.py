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
    openrouter_key = os.environ.get("OPENROUTER_API_KEY")
    
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
    
    user_allergies = get_user_allergies(request.user_id)
    allergy_clause = f" PATIENT WARNING: Patient has confirmed allergies to: {', '.join(user_allergies)}. NEVER recommend these or cross-reactive drugs." if user_allergies else ""

    system_prompt = (
        "You are MEDORA's AI Clinical Pharmacist, an empathetic and certified healthcare consultation AI. "
        "Strictly adhere to clinical pharmacology and evidence-based medicine:\n\n"
        "PHARMACOLOGICAL FORMULARY RULES (MANDATORY):\n"
        "1. ACIDITY / HEARTBURN / GERD / ACID REFLUX / CHEST BURNING:\n"
        "   - Recommend ONLY: Pantocid 40 (Pantoprazole 40mg - take 1 tablet 30 minutes before meal) and/or Gelusil (Antacid syrup/chewable tablet for rapid neutralization of stomach acid).\n"
        "   - CRITICAL CONTRAINDICATION: NEVER recommend Paracetamol, Dolo 650, Crocin, Combiflam, or NSAIDs for acidity or gastric burning. Clearly state that NSAIDs irritate the gastric mucosa and worsen burning!\n"
        "2. FEVER / HEADACHE / BODY PAIN:\n"
        "   - Recommend: Dolo 650 (Paracetamol 650mg) or Calpol 500 for fever and headache.\n"
        "   - Recommend: Combiflam (Ibuprofen + Paracetamol) for acute muscle or joint pain.\n"
        "3. ALLERGIES / COLD / SNEEZING / RUNNY NOSE:\n"
        "   - Recommend: Allegra 120 (Fexofenadine 120mg non-drowsy) or Cetirizine 10mg.\n"
        "4. DRY COUGH / THROAT IRRITATION:\n"
        "   - Recommend: Ascoril-D syrup.\n"
        "5. DEHYDRATION / DIARRHEA:\n"
        "   - Recommend: ORS Electrolyte sachet dissolved in 1L water.\n"
        f"{allergy_clause}\n\n"
        "OUTPUT FORMAT (STRICT):\n"
        "Write in clean, easy-to-read clinical markdown. Never truncate sentences. Never invent fictional drug components like crocetin. Do not include random button texts.\n\n"
        "**Probable Condition:**\n"
        "[1 concise sentence describing the most likely clinical condition]\n\n"
        "**Recommended OTC Relief:**\n"
        "- **[Exact Medicine Name]**: [Precise dosage, administration timing, and therapeutic action]\n\n"
        "**Clinical Guidance:**\n"
        "- [Lifestyle, dietary, and hydration recommendations]\n"
        "- [Contraindications or warning on what NOT to take]\n\n"
        "Disclaimer: I am an AI clinical assistant, not a doctor. Consult a healthcare professional before taking medications."
    )
    
    reply = None
    if gemini_key:
        import urllib.request
        import json
        
        # Cascade list of available Gemini flash models for optimal speed & reliability
        gemini_models = ["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"]
        
        contents = []
        for m in messages:
            role = "user" if m["role"] == "user" else "model"
            contents.append({"role": role, "parts": [{"text": m["content"]}]})
            
        payload = {
            "contents": contents,
            "systemInstruction": {
                "parts": [{"text": system_prompt}]
            },
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 900
            }
        }

        for model_name in gemini_models:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=6) as res:
                    response_data = json.loads(res.read().decode("utf-8"))
                    cand = response_data.get("candidates", [])
                    if cand and "content" in cand[0] and "parts" in cand[0]["content"]:
                        reply = cand[0]["content"]["parts"][0]["text"]
                        break
            except Exception as e:
                print(f"Gemini model {model_name} attempt failed: {e}")
                continue

    if not reply and openrouter_key:
        try:
            from openai import OpenAI
            client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=openrouter_key,
                default_headers={
                    "HTTP-Referer": "https://github.com/Athxl-rreji/MEDORA",
                    "X-Title": "MEDORA AI Pharmacy"
                }
            )
            openai_messages = [{"role": "system", "content": system_prompt}]
            for m in messages:
                openai_messages.append({"role": m["role"], "content": m["content"]})
            response = client.chat.completions.create(
                model=os.environ.get("OPENROUTER_MODEL", "meta-llama/llama-3-8b-instruct:free"),
                messages=openai_messages,
                timeout=8
            )
            reply = response.choices[0].message.content
        except Exception as e:
            print(f"OpenRouter LLM failure: {e}")

    if not reply and openai_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            openai_messages = [{"role": "system", "content": system_prompt}]
            for m in messages:
                openai_messages.append({"role": m["role"], "content": m["content"]})
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=openai_messages,
                timeout=8
            )
            reply = response.choices[0].message.content
        except Exception as e:
            print(f"OpenAI failure: {e}")

    if reply:
        suggested_medicines = []
        
        # Scope extraction strictly to the **Recommended OTC Relief:** section
        # This prevents warning text (e.g., "Do not take Dolo 650 or Crocin") from ever polluting suggestions!
        otc_match = re.search(r'\*\*Recommended OTC Relief:\*\*(.*?)(?:\*\*Clinical Guidance:\*\*|Disclaimer:|⚠️|$)', reply, re.DOTALL | re.IGNORECASE)
        search_scope = otc_match.group(1).lower() if otc_match else reply.lower()
        
        # Check overall context for gastric burning/acidity
        full_conversation = " ".join([m.get("content", "") for m in messages]).lower()
        is_acidity_context = any(term in full_conversation for term in ["acid", "reflux", "gerd", "heartburn", "chest burn", "burning chest", "stomach burn", "gastric"])
        
        catalog_mappings = [
            ("pantocid 40", "Pantocid 40"),
            ("pantoprazole", "Pantocid 40"),
            ("pantocid", "Pantocid 40"),
            ("gelusil", "Gelusil"),
            ("dolo 650", "Dolo 650"),
            ("dolo", "Dolo 650"),
            ("calpol 500", "Calpol 500"),
            ("calpol", "Calpol 500"),
            ("crocin advance", "Crocin Advance"),
            ("crocin", "Crocin Advance"),
            ("combiflam", "Combiflam"),
            ("allegra 120", "Allegra 120"),
            ("allegra", "Allegra 120"),
            ("cetirizine 10mg", "Cetirizine 10mg"),
            ("cetirizine", "Cetirizine 10mg"),
            ("ascoril-d", "Ascoril-D"),
            ("ascoril", "Ascoril-D"),
            ("ors electrolyte", "ORS Electrolyte"),
            ("ors", "ORS Electrolyte"),
            ("augmentin 625", "Augmentin 625"),
            ("augmentin", "Augmentin 625"),
            ("azithromycin 500", "Azithromycin 500"),
            ("azithromycin", "Azithromycin 500")
        ]
        
        for kw, official_name in catalog_mappings:
            if re.search(r'\b' + re.escape(kw) + r'\b', search_scope):
                # Hard contraindication check
                if is_acidity_context and official_name in ["Dolo 650", "Calpol 500", "Crocin Advance", "Combiflam"]:
                    continue
                if official_name not in suggested_medicines:
                    suggested_medicines.append(official_name)
                    
        session_finished = "disclaimer" in reply.lower() or "i am an ai" in reply.lower() or len(suggested_medicines) > 0
                    
        return ChatResponse(
            content=reply,
            session_finished=session_finished,
            diagnosis="Clinical Assessment" if session_finished else None,
            suggested_medicines=suggested_medicines
        )


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
