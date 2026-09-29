import os
import re
import json
import urllib.request
from typing import List, Optional, Dict
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from app.core.logger import logger
from app.core.prototype_db import PrototypeDataStore, get_datastore

router = APIRouter()

class Message(BaseModel):
    role: str # "user" | "assistant" | "system"
    content: str

class ChatRequest(BaseModel):
    user_id: Optional[str] = "guest"
    messages: List[Message]

class ChatResponse(BaseModel):
    content: str
    session_finished: bool
    diagnosis: Optional[str] = None
    suggested_medicines: List[str] = []
    engine: Optional[str] = "MEDORA Clinical AI"

SYSTEM_PROMPT = (
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
    "5. DEHYDRATION / DIARRHEA / VOMITING:\n"
    "   - Recommend: ORS Electrolyte sachet dissolved in 1L clean drinking water.\n\n"
    "OUTPUT FORMAT (STRICT):\n"
    "Write in clean, easy-to-read clinical markdown. Never truncate sentences. Do not include checkout buttons or unrelated links.\n\n"
    "**Probable Condition:**\n"
    "[1 concise sentence describing the most likely clinical condition]\n\n"
    "**Recommended OTC Relief:**\n"
    "- **[Exact Medicine Name]**: [Precise dosage, administration timing, and therapeutic action]\n\n"
    "**Clinical Guidance:**\n"
    "- [Lifestyle, dietary, and hydration recommendations]\n"
    "- [Contraindications or warning on what NOT to take]\n\n"
    "Disclaimer: I am an AI clinical assistant, not a doctor. Consult a healthcare professional before taking medications."
)

CLINICAL_KB = [
    {
        "keywords": ["acid", "reflux", "gerd", "heartburn", "burning chest", "stomach burn", "gastric", "sour", "belching"],
        "condition": "Gastroesophageal Reflux / Acute Gastric Hyperacidity",
        "otc": [
            ("Pantocid 40", "1 tablet once daily in the morning, 30 minutes before breakfast. Reduces gastric acid secretion."),
            ("Gelusil", "10ml syrup or 1-2 chewable tablets as needed 1 hour after meals for instant acid neutralization.")
        ],
        "guidance": [
            "Avoid spicy, oily, acidic foods, citrus fruits, carbonated drinks, and caffeine.",
            "Do not lie down immediately after eating; keep your head elevated by 6 inches while sleeping.",
            "⚠️ STRICT CONTRAINDICATION: Do NOT take Dolo 650, Crocin, Combiflam, or Aspirin, as NSAIDs damage the stomach lining and exacerbate gastritis."
        ],
        "meds": ["Pantocid 40", "Gelusil"]
    },
    {
        "keywords": ["fever", "temperature", "chills", "high temp", "pyrexia"],
        "condition": "Acute Febrile Illness / Viral Pyrexia",
        "otc": [
            ("Dolo 650", "1 tablet every 6-8 hours as needed (maximum 3 tablets per 24 hours) after meals."),
            ("ORS Electrolyte", "Sip 1 liter of reconstituted ORS throughout the day to replenish electrolytes lost via sweating.")
        ],
        "guidance": [
            "Maintain strict bed rest, wear lightweight clothing, and stay well hydrated.",
            "Apply lukewarm water sponge compresses to forehead and limbs if temperature exceeds 101°F.",
            "⚠️ Seek immediate medical evaluation if fever persists beyond 3 days or is accompanied by stiff neck, shortness of breath, or rash."
        ],
        "meds": ["Dolo 650", "ORS Electrolyte"]
    },
    {
        "keywords": ["headache", "migraine", "head pain", "throbbing head", "forehead"],
        "condition": "Tension Headache / Migraine Cephalea",
        "otc": [
            ("Calpol 500", "1 tablet with a full glass of water. Repeat after 6 hours if pain persists (maximum 4g Paracetamol daily)."),
            ("Combiflam", "1 tablet after a meal if headache is accompanied by neck or muscular tension.")
        ],
        "guidance": [
            "Rest in a quiet, dark room away from bright screens, artificial lighting, and loud noises.",
            "Ensure optimal hydration (drink at least 2 glasses of water immediately).",
            "Apply a cold or warm compress across temples and back of the neck."
        ],
        "meds": ["Calpol 500", "Combiflam"]
    },
    {
        "keywords": ["cold", "sneez", "runny nose", "congestion", "allergy", "allergic", "itchy", "nasal"],
        "condition": "Allergic Rhinitis / Acute Upper Respiratory Rhinovirus",
        "otc": [
            ("Allegra 120", "1 tablet once daily in the morning with water (non-drowsy 2nd generation antihistamine)."),
            ("Cetirizine 10mg", "1 tablet at bedtime if nighttime itching or nasal drip interrupts sleep.")
        ],
        "guidance": [
            "Perform steam inhalation twice daily with a few drops of eucalyptus oil or plain saline vapor.",
            "Stay away from known allergens like dust, pollen, pet dander, and abrupt air-conditioning chills.",
            "Drink warm fluids like herbal tea, warm water, and soups."
        ],
        "meds": ["Allegra 120", "Cetirizine 10mg"]
    },
    {
        "keywords": ["cough", "throat", "sore throat", "dry cough", "phlegm", "hoarse"],
        "condition": "Acute Pharyngitis / Irritant Bronchial Cough",
        "otc": [
            ("Ascoril-D", "5-10ml syrup twice or thrice daily after meals to soothe irritated bronchial passages.")
        ],
        "guidance": [
            "Gargle with warm salt water (1/2 teaspoon salt in 1 cup warm water) 3 times a day.",
            "Sip warm honey-lemon water to lubricate dry mucosal membranes.",
            "Avoid chilled drinks, ice creams, smoke, and outdoor pollutants."
        ],
        "meds": ["Ascoril-D"]
    },
    {
        "keywords": ["loose", "diarrhea", "vomit", "stomach bug", "food poison", "dehydrat", "motion"],
        "condition": "Acute Gastroenteritis / Gastrointestinal Dehydration",
        "otc": [
            ("ORS Electrolyte", "Dissolve 1 full sachet in 1 liter of boiled and cooled drinking water. Drink after every loose stool."),
            ("Pantocid 40", "1 tablet 30 minutes before meal to protect against gastric irritation.")
        ],
        "guidance": [
            "Follow the BRAT diet: Bananas, Rice, Applesauce, and Toast. Avoid dairy, raw salads, and heavy oils.",
            "Continuous hydration is paramount to prevent hypovolemic dehydration.",
            "⚠️ Consult a hospital immediately if blood is visible in stools or urine output drops significantly."
        ],
        "meds": ["ORS Electrolyte", "Pantocid 40"]
    },
    {
        "keywords": ["body pain", "back pain", "muscle", "joint", "sprain", "ache", "cramp"],
        "condition": "Acute Musculoskeletal Strain / Myalgia",
        "otc": [
            ("Combiflam", "1 tablet twice daily strictly after meals to reduce muscular inflammation and pain."),
            ("Dolo 650", "1 tablet as an alternative if sensitive to NSAID analgesics.")
        ],
        "guidance": [
            "Apply hot fomentation or ice packs for 15-minute intervals over the affected muscle.",
            "Avoid strenuous lifting or sudden jerky posture movements.",
            "Ensure gentle stretching and adequate rest."
        ],
        "meds": ["Combiflam", "Dolo 650"]
    }
]

def generate_clinical_fallback(user_text: str, all_messages: List[dict]) -> tuple:
    """Intelligently analyzes patient consultation conversation and generates evidence-based clinical output."""
    full_context = " ".join([m.get("content", "") for m in all_messages]).lower()
    
    # Check for greeting or first turn
    words = re.findall(r'\w+', user_text.lower())
    if len(words) <= 2 and any(w in ["hi", "hello", "hey", "doctor", "help"] for w in words):
        return (
            "Hello! I am MEDORA's AI Clinical Pharmacist. "
            "Please describe the symptoms you are experiencing, how long you've had them, "
            "and any relevant medical history or allergies so I can provide safe, evidence-based recommendations.",
            False,
            [],
            "General Consultation"
        )

    # Match against clinical knowledge base
    best_kb = None
    max_matches = 0
    for kb in CLINICAL_KB:
        match_count = sum(1 for kw in kb["keywords"] if kw in full_context)
        if match_count > max_matches:
            max_matches = match_count
            best_kb = kb

    if not best_kb or max_matches == 0:
        # Default supportive response
        return (
            "**Probable Condition:**\n"
            "Non-specific acute symptom presentation requiring clinical observation.\n\n"
            "**Recommended OTC Relief:**\n"
            "- **Dolo 650**: 1 tablet SOS if fever or mild pain is present (take after food).\n"
            "- **ORS Electrolyte**: 1 sachet in 1 liter clean water to maintain optimal hydration.\n\n"
            "**Clinical Guidance:**\n"
            "- Monitor symptom progression over the next 24 to 48 hours.\n"
            "- Maintain generous hydration and rest.\n"
            "- If symptoms worsen or red-flag signs (high fever, severe pain, breathing difficulty) appear, visit a doctor promptly.\n\n"
            "Disclaimer: I am an AI clinical assistant, not a doctor. Consult a healthcare professional before taking medications.",
            True,
            ["Dolo 650", "ORS Electrolyte"],
            "General Health Observation"
        )

    # Format clinical guidance
    otc_text = "\n".join([f"- **{name}**: {desc}" for name, desc in best_kb["otc"]])
    guidance_text = "\n".join([f"- {g}" for g in best_kb["guidance"]])

    reply = (
        f"**Probable Condition:**\n"
        f"{best_kb['condition']}\n\n"
        f"**Recommended OTC Relief:**\n"
        f"{otc_text}\n\n"
        f"**Clinical Guidance:**\n"
        f"{guidance_text}\n\n"
        f"Disclaimer: I am an AI clinical assistant, not a doctor. Consult a healthcare professional before taking medications."
    )

    return (reply, True, best_kb["meds"], best_kb["condition"])


@router.post("/chat", response_model=ChatResponse)
async def chat_consultation(request: ChatRequest, mock_db: PrototypeDataStore = Depends(get_datastore)):
    """
    Unified AI Pharmacist & Clinical Symptom Chat Endpoint.
    Uses Google Gemini Flash API with automatic fallback to OpenRouter and Clinical Rule Engine.
    """
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    last_user_msg = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    
    # Check if user has recorded allergies in PrototypeDataStore
    user_allergies = []
    if request.user_id and request.user_id != "guest":
        user = mock_db.find_user(request.user_id)
        if user and user.get("allergies"):
            user_allergies = [a.strip().lower() for a in user["allergies"].split(",") if a.strip()]

    allergy_warning = f" PATIENT WARNING: Confirmed allergies to {', '.join(user_allergies)}. Never recommend these drugs." if user_allergies else ""
    full_system_prompt = SYSTEM_PROMPT + allergy_warning

    reply = None
    ai_engine = None
    
    # 1. Try Google Gemini API
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if gemini_key and len(gemini_key.strip()) > 5:
        gemini_models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-flash-latest", "gemini-1.5-pro"]
        contents = []
        for m in messages:
            role = "user" if m["role"] == "user" else "model"
            contents.append({"role": role, "parts": [{"text": m["content"]}]})

        payload = {
            "contents": contents,
            "systemInstruction": {"parts": [{"text": full_system_prompt}]},
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 900}
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
                    cands = response_data.get("candidates", [])
                    if cands and "content" in cands[0] and "parts" in cands[0]["content"]:
                        reply = cands[0]["content"]["parts"][0]["text"]
                        ai_engine = f"Google {model_name}"
                        logger.info(f"Chatbot consultation answered via {model_name}")
                        break
            except Exception as e:
                logger.warning(f"Gemini {model_name} failed: {e}")
                if "401" in str(e) or "403" in str(e):
                    break
                continue

    # 2. Try OpenRouter if Gemini was not available
    openrouter_key = os.environ.get("OPENROUTER_API_KEY")
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
            openai_messages = [{"role": "system", "content": full_system_prompt}]
            for m in messages:
                openai_messages.append({"role": m["role"], "content": m["content"]})
            
            response = client.chat.completions.create(
                model=os.environ.get("OPENROUTER_MODEL", "google/gemma-4-31b-it:free"),
                messages=openai_messages,
                timeout=7
            )
            reply = response.choices[0].message.content
            ai_engine = "OpenRouter Medical LLM"
        except Exception as e:
            logger.warning(f"OpenRouter chatbot fallback failed: {e}")

    # 3. Seamless Clinical Pharmacology Engine Fallback (guaranteed 100% uptime)
    if not reply:
        reply, session_finished, suggested_meds, diagnosis = generate_clinical_fallback(last_user_msg, messages)
        ai_engine = "MEDORA Clinical AI"
        return ChatResponse(
            content=reply,
            session_finished=session_finished,
            diagnosis=diagnosis,
            suggested_medicines=suggested_meds,
            engine=ai_engine
        )

    # Extract suggested medicines strictly from the Recommended OTC Relief section
    suggested_medicines = []
    otc_match = re.search(r'\*\*Recommended OTC Relief:\*\*(.*?)(?:\*\*Clinical Guidance:\*\*|Disclaimer:|⚠️|$)', reply, re.DOTALL | re.IGNORECASE)
    search_scope = otc_match.group(1).lower() if otc_match else reply.lower()
    
    known_meds = [
        "Pantocid 40", "Gelusil", "Dolo 650", "Calpol 500", "Crocin Advance",
        "Allegra 120", "Cetirizine 10mg", "Ascoril-D", "ORS Electrolyte", "Combiflam"
    ]
    reply_lower = reply.lower()
    is_acidity = any(t in reply_lower for t in ["acid", "reflux", "gerd", "heartburn", "chest burn", "burning"])

    for m in known_meds:
        first_word = m.lower().split()[0]
        if first_word in search_scope and m not in suggested_medicines:
            if is_acidity and first_word in ["dolo", "crocin", "calpol", "combiflam"]:
                continue
            suggested_medicines.append(m)

    # Extract tentative diagnosis if present
    diag_match = re.search(r'\*\*Probable Condition:\*\*\s*(.+?)(?:\n\n|\*\*|$)', reply, re.DOTALL | re.IGNORECASE)
    diagnosis = diag_match.group(1).strip() if diag_match else None
    session_finished = len(suggested_medicines) > 0 or "**recommended otc relief:**" in reply.lower()

    return ChatResponse(
        content=reply,
        session_finished=session_finished,
        diagnosis=diagnosis,
        suggested_medicines=suggested_medicines,
        engine=ai_engine or "MEDORA Clinical AI"
    )
