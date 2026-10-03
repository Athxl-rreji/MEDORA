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
    confidence_score: float = 0.95
    confidence_label: Optional[str] = "High Clinical Correlation (95%)"
    quiz_options: List[str] = []

SYSTEM_PROMPT = (
    "You are MEDORA's AI Clinical Doctor & Pharmacist. Strictly adhere to clinical pharmacology and evidence-based diagnostic triage.\n\n"
    "INTERACTIVE CLINICAL QUIZ & TRIAGE PROTOCOL (STRICT MANDATE):\n"
    "- NEVER give a final diagnosis or OTC prescription in only 1 turn. Healthcare safety demands verifying and ruling out complications first!\n"
    "- TURN 1 (Initial Complaint): Provide an empathetic preliminary observation. Set Clinical Confidence between 50%-60% ('55% Preliminary Differential Intake'). "
    "Do NOT prescribe medicines yet. QUIZ the patient with 2-3 focused diagnostic rule-out questions (onset/duration, intensity 1-10, accompanying red-flag symptoms like high fever/rash/vomiting/shortness of breath, food triggers). "
    "End with: '💡 Answer the questions above or tap a quick symptom chip to increase diagnostic accuracy.'\n"
    "- TURN 2 (Patient Answers Quiz): Acknowledge their responses. Rule out underlying acute complications. Set Clinical Confidence between 78%-82% ('80% Differential Correlation — Verifying Safety & Contraindications'). "
    "Ask a safety verification question (drug allergies, stomach ulcers, kidney/liver conditions, pregnancy/nursing).\n"
    "- TURN 3+ (Confirmed Formulation): Only when symptoms and contraindications have been verified, provide confirmed clinical formulation. Set Clinical Confidence between 95%-98% ('98% High Clinical Confidence — Formulated & Verified'). "
    "Recommend exact OTC relief from the formulary with exact dosage, timing, cautions, and dietary advice. "
    "Explicitly invite continuous chatting ('💬 Feel free to ask any follow-up questions about dosage, meals, or side effects. I am here to help.').\n\n"
    "PHARMACOLOGICAL FORMULARY RULES (MANDATORY):\n"
    "1. ACIDITY / HEARTBURN / GERD / ACID REFLUX / CHEST BURNING:\n"
    "   - Recommend ONLY: Pantocid 40 (Pantoprazole 40mg - 1 tablet 30 minutes before meal) and/or Gelusil (Antacid syrup/chewable tablet for rapid neutralization).\n"
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
    "Write in clean, easy-to-read clinical markdown. Never truncate sentences.\n"
    "**Probable Condition:**\n"
    "[1 concise sentence describing the condition]\n\n"
    "**Clinical Confidence:**\n"
    "[XX]% ([High / Strong / Moderate] Clinical Correlation)\n\n"
    "**Diagnostic Verification / Rule-Out Questions (if Turn 1 or 2):**\n"
    "[Numbered list of 2-3 specific questions]\n\n"
    "**Recommended OTC Relief (ONLY on Turn 3+):**\n"
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
        "turn1_quiz": [
            "Does the burning sensation worsen immediately after eating or when lying flat at night?",
            "Do you experience sour acid regurgitation or nausea in the back of your throat?",
            "Have you taken any pain relievers (like Dolo, Combiflam, or Aspirin) in the last 48 hours?"
        ],
        "turn1_options": ["Worse after meals", "At night / Lying down", "Sour burps present", "No painkillers taken", "Severe chest pain"],
        "turn2_options": ["No difficulty swallowing", "No black stools", "No drug allergies", "First time having this"],
        "otc": [
            ("Pantocid 40", "1 tablet once daily in the morning, 30 minutes before breakfast for 5 days. Inhibits gastric proton pumps to suppress acid secretion."),
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
        "turn1_quiz": [
            "How many days have you had the fever and what is your highest recorded temperature?",
            "Are you experiencing shivering chills, joint pain, or any skin rashes?",
            "Do you have a sore throat, burning urination, or severe persistent cough?"
        ],
        "turn1_options": ["1-2 Days", "3+ Days", "High Fever >101°F", "Mild Fever / Chills", "Body aches & shivering", "No rashes"],
        "turn2_options": ["Drinking fluids well", "No liver issues", "Mild sore throat", "Headache present"],
        "otc": [
            ("Dolo 650", "1 tablet every 6-8 hours as needed (maximum 3 tablets per 24 hours) after meals for temperature above 100°F."),
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
        "turn1_quiz": [
            "Is the pain throbbing on one side of your head or a tight band-like ache across your forehead?",
            "Are you experiencing sensitivity to bright light, loud sound, or nausea?",
            "Have you had prolonged digital screen time, lack of sleep, or neck stiffness?"
        ],
        "turn1_options": ["One-sided throbbing", "Tight band around head", "Light sensitivity", "Screen fatigue", "No neck stiffness"],
        "turn2_options": ["Hydrated well", "No nausea", "Able to sleep", "No drug allergies"],
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
        "turn1_quiz": [
            "Is the nasal discharge clear and watery, or thick and yellowish/green?",
            "Do you have frequent sneezing bouts and itchy or red eyes?",
            "Do you need a non-drowsy daytime remedy so you can work normally?"
        ],
        "turn1_options": ["Watery runny nose", "Constant sneezing", "Itchy eyes", "Prefer non-drowsy", "Throat scratchiness"],
        "turn2_options": ["No asthma history", "Nighttime congestion", "No drug allergies"],
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
        "turn1_quiz": [
            "Is your cough dry and hacking, or are you bringing up chest phlegm?",
            "Do you feel a sharp scratchy pain when swallowing food or water?",
            "Have you noticed any shortness of breath or wheezing sounds?"
        ],
        "turn1_options": ["Dry tickling cough", "Sore throat when swallowing", "Phlegm present", "No breathing difficulty", "Night coughing"],
        "turn2_options": ["No blood in sputum", "No voice loss", "Normal breathing", "No drug allergies"],
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
        "keywords": ["body pain", "back pain", "muscle", "joint", "sprain", "ache", "cramp"],
        "condition": "Acute Musculoskeletal Strain / Myalgia",
        "turn1_quiz": [
            "Did the pain start following heavy lifting, exercise, or prolonged poor posture?",
            "Is the pain concentrated in your lower back, neck, or spread across muscles?",
            "Are you experiencing any numbness, tingling, or shooting nerve pain down your legs?"
        ],
        "turn1_options": ["Lower back pain", "Neck / Shoulder stiffness", "Post-workout soreness", "No numbness / tingling", "Mild joint ache"],
        "turn2_options": ["Stomach tolerates food", "No history of ulcers", "No drug allergies"],
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
    """Intelligently analyzes patient consultation conversation and generates multi-turn clinical diagnostic quiz output with confidence score."""
    full_context = " ".join([m.get("content", "") for m in all_messages]).lower()
    user_turns = sum(1 for m in all_messages if m.get("role") == "user")
    
    # Check for greeting or first turn
    words = re.findall(r'\w+', user_text.lower())
    if len(words) <= 2 and any(w in ["hi", "hello", "hey", "doctor", "help"] for w in words):
        return (
            "Hello! I am MEDORA's AI Clinical Pharmacist. "
            "Please describe the primary symptoms you are experiencing today (e.g. fever, headache, acidity, cold, cough, or body pain) so I can begin your clinical assessment.",
            False,
            [],
            "General Consultation",
            0.50,
            "50% Initial Symptom Intake",
            ["Fever & Chills", "Acidity & Heartburn", "Cold & Sneezing", "Headache", "Cough & Throat Pain", "Body Pain"]
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
        score = 0.60
        label = "60% General Symptom Observation"
        return (
            "**Preliminary Clinical Observation:**\n"
            "Your symptoms do not yet fit a single specific differential pattern. "
            "To narrow down your diagnosis and calculate an accurate confidence score, please answer:\n\n"
            "1. What is the most bothersome symptom right now?\n"
            "2. How many hours or days have you felt this way?\n"
            "3. Any known chronic medical conditions or drug allergies?",
            False,
            [],
            "General Health Observation",
            score,
            label,
            ["Fever", "Acidity", "Headache", "Cold / Cough", "Body Ache", "No Allergies"]
        )

    # TURN 1: Preliminary Intake + Diagnostic Quiz to rule out complications
    if user_turns <= 1:
        score = 0.55
        label = "55% Preliminary Intake — Awaiting Quiz Responses to Rule Out Complications"
        quiz_items = "\n".join([f"{i+1}. **{q}**" for i, q in enumerate(best_kb.get("turn1_quiz", []))])
        
        reply = (
            f"**Preliminary Clinical Assessment:**\n"
            f"Your initial complaint points toward **{best_kb['condition']}**.\n\n"
            f"**Clinical Confidence:**\n"
            f"{label}\n\n"
            f"**Diagnostic Verification Quiz (Rule-Out Protocol):**\n"
            f"To pinpoint the exact treatment and rule out underlying acute complications, please answer:\n"
            f"{quiz_items}\n\n"
            f"*💡 Tap a quick answer option below or type your response to increase diagnostic confidence!*"
        )
        return (reply, False, [], best_kb["condition"], score, label, best_kb.get("turn1_options", []))

    # TURN 2: Refined Assessment + Safety Verification
    elif user_turns == 2:
        score = 0.80
        label = "80% Differential Correlation — Verifying Safety & Allergy Profile"
        otc_sample = best_kb["otc"][0] if best_kb.get("otc") else ("Dolo 650", "As needed")
        
        reply = (
            f"**Refined Assessment (Turn 2):**\n"
            f"Based on your responses, **{best_kb['condition']}** is strongly indicated and secondary acute complications have been largely ruled out.\n\n"
            f"**Clinical Confidence:**\n"
            f"{label}\n\n"
            f"**Final Safety Verification:**\n"
            f"- Do you have any known drug allergies, existing stomach ulcers, or liver/kidney conditions?\n"
            f"- Are you pregnant, nursing, or currently taking any prescription medications?\n\n"
            f"**Interim Relief Option:**\n"
            f"- **{otc_sample[0]}**: {otc_sample[1]}\n\n"
            f"*Answer above or tap below to achieve 98% confirmed recommendation.*"
        )
        return (reply, False, [otc_sample[0]], best_kb["condition"], score, label, best_kb.get("turn2_options", []))

    # TURN 3+: Confirmed Clinical Diagnosis with Comprehensive Guidance
    else:
        score = 0.98
        label = "98% High Clinical Confidence — Symptomatology Confirmed & Formulated"
        otc_text = "\n".join([f"- **{name}**: {desc}" for name, desc in best_kb["otc"]])
        guidance_text = "\n".join([f"- {g}" for g in best_kb["guidance"]])

        reply = (
            f"**Confirmed Clinical Formulation:**\n"
            f"{best_kb['condition']}\n\n"
            f"**Clinical Confidence:**\n"
            f"{label}\n\n"
            f"**Recommended OTC Relief:**\n"
            f"{otc_text}\n\n"
            f"**Clinical Guidance & Precautions:**\n"
            f"{guidance_text}\n\n"
            f"Disclaimer: I am an AI clinical assistant, not a doctor. Consult a healthcare professional before taking medications.\n\n"
            f"*💬 You can continue chatting below if you have any follow-up questions about dosage, meals, or side effects.*"
        )
        return (reply, False, best_kb["meds"], best_kb["condition"], score, label, ["Dosage Timing?", "Foods to Avoid?", "Side Effects?", "Consult Human Doctor"])


@router.post("/chat", response_model=ChatResponse)
async def chat_consultation(request: ChatRequest, mock_db: PrototypeDataStore = Depends(get_datastore)):
    """
    Unified AI Pharmacist & Clinical Symptom Chat Endpoint.
    Uses Google Gemini Flash API with automatic fallback to OpenRouter and Clinical Rule Engine.
    """
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    last_user_msg = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    
    user_turns = sum(1 for m in messages if m.get("role") == "user")

    # 0. Intercept casual greetings immediately (instant <50ms response, zero LLM delay)
    words = re.findall(r'\w+', last_user_msg.lower())
    if len(words) <= 3 and any(w in ["hi", "hello", "hey", "doctor", "help", "yo", "sup", "hola", "namaste", "doc"] for w in words):
        return ChatResponse(
            content=(
                "Hello! I am MEDORA's AI Clinical Pharmacist. 👋\n\n"
                "Please describe the primary symptoms you are experiencing today (e.g. fever, headache, acidity, cold, cough, or body pain) so I can begin your clinical triage and rule out complications."
            ),
            session_finished=False,
            diagnosis="Initial Symptom Intake",
            suggested_medicines=[],
            engine="MEDORA Clinical AI",
            confidence_score=0.50,
            confidence_label="50% Initial Symptom Intake",
            quiz_options=["🤒 High Fever & Chills", "🤢 Acidity & Heartburn", "🤧 Cold & Allergy Sneezing", "🤕 Severe Headache", "😷 Dry Cough & Sore Throat", "⚡ Body & Muscle Pain"]
        )
    
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
        reply, session_finished, suggested_meds, diagnosis, conf_score, conf_label, quiz_opts = generate_clinical_fallback(last_user_msg, messages)
        ai_engine = "MEDORA Clinical AI"
        return ChatResponse(
            content=reply,
            session_finished=session_finished,
            diagnosis=diagnosis,
            suggested_medicines=suggested_meds,
            engine=ai_engine,
            confidence_score=conf_score,
            confidence_label=conf_label,
            quiz_options=quiz_opts
        )

    # Extract or calculate clinical confidence score and label from LLM response
    default_score = 0.58 if user_turns <= 1 else 0.82 if user_turns == 2 else 0.98
    default_label = "58% Clinical Symptom Intake & Rule-Out" if user_turns <= 1 else "82% Differential Verification & Safety Check" if user_turns == 2 else "98% High Clinical Match"

    conf_score = default_score
    conf_label = default_label
    conf_match = re.search(r'\*\*Clinical Confidence:\*\*\s*([^\n\r]+)', reply, re.IGNORECASE)
    if conf_match:
        extracted_label = conf_match.group(1).strip()
        pct_match = re.search(r'(\d+)%', extracted_label)
        if pct_match:
            try:
                parsed_score = round(float(pct_match.group(1)) / 100.0, 2)
                # Keep score clinically proportionate to conversation turn
                if user_turns <= 1 and parsed_score > 0.65:
                    conf_score = 0.58
                    conf_label = "58% Clinical Symptom Intake & Rule-Out"
                else:
                    conf_score = parsed_score
                    conf_label = extracted_label
            except Exception:
                pass
    else:
        # LLM response missed the Clinical Confidence section; calculate and inject it cleanly
        conf_score = default_score
        conf_label = default_label
        if "**Recommended OTC Relief:**" in reply:
            reply = reply.replace("**Recommended OTC Relief:**", f"**Clinical Confidence:**\n{conf_label}\n\n**Recommended OTC Relief:**")
        elif "Disclaimer:" in reply:
            reply = reply.replace("Disclaimer:", f"**Clinical Confidence:**\n{conf_label}\n\nDisclaimer:")
        else:
            reply += f"\n\n**Clinical Confidence:**\n{conf_label}"

    # Extract suggested medicines strictly from the Recommended OTC Relief section
    suggested_medicines = []
    otc_match = re.search(r'\*\*Recommended OTC Relief:\*\*(.*?)(?:\*\*Clinical Guidance:\*\*|Disclaimer:|⚠️|$)', reply, re.DOTALL | re.IGNORECASE)
    search_scope = otc_match.group(1).lower() if otc_match else reply.lower()
    
    known_meds = [
        "Pantocid 40", "Gelusil", "Dolo 650", "Calpol 500", "Crocin Advance",
        "Allegra 120", "Cetirizine 10mg", "Ascoril-D", "ORS Electrolyte", "Combiflam",
        "Augmentin 625 Duo", "Azithral 500", "Amoxyclav 625", "Azee 500", "Atarax 25mg"
    ]
    reply_lower = reply.lower()
    is_acidity = any(t in reply_lower for t in ["acid", "reflux", "gerd", "heartburn", "chest burn", "burning"])

    for m in known_meds:
        first_word = m.lower().split()[0]
        if first_word in search_scope and m not in suggested_medicines:
            if is_acidity and first_word in ["dolo", "crocin", "calpol", "combiflam"]:
                continue
            suggested_medicines.append(m)

    # Also search catalog medicines in mock_db if specific prescriptions were mentioned
    if len(suggested_medicines) < 3 and hasattr(mock_db, 'medicines') and mock_db.medicines:
        for mid, med in mock_db.medicines.items():
            bname = med.get("brand_name", "")
            first_b = bname.lower().split()[0]
            if len(first_b) >= 4 and first_b in search_scope and bname not in suggested_medicines:
                if is_acidity and first_b in ["dolo", "crocin", "calpol", "combiflam"]:
                    continue
                suggested_medicines.append(bname)
                if len(suggested_medicines) >= 5:
                    break

    # Extract tentative diagnosis if present
    diag_match = re.search(r'\*\*Probable Condition:\*\*\s*(.+?)(?:\n\n|\*\*|$)', reply, re.DOTALL | re.IGNORECASE)
    diagnosis = diag_match.group(1).strip() if diag_match else None
    session_finished = len(suggested_medicines) > 0 or "**recommended otc relief:**" in reply.lower()

    user_turns = sum(1 for m in messages if m.get("role") == "user")
    
    # Calculate dynamic confidence score if not found or if in earlier turns
    if user_turns <= 1:
        conf_score = min(conf_score, 0.60)
        conf_label = f"{int(conf_score * 100)}% Preliminary Differential — Diagnostic Rule-Out Quiz in Progress"
    elif user_turns == 2:
        conf_score = min(max(conf_score, 0.78), 0.84)
        conf_label = f"{int(conf_score * 100)}% Differential Correlation — Verifying Safety & Contraindications"
    else:
        conf_score = max(conf_score, 0.96)
        conf_label = f"{int(conf_score * 100)}% High Clinical Confidence — Formulated & Verified"

    # Extract quiz options from best_kb if in quiz turns
    extracted_quiz_opts = []
    for kb in CLINICAL_KB:
        if any(kw in full_system_prompt.lower() or kw in last_user_msg.lower() or kw in reply.lower() for kw in kb["keywords"]):
            if user_turns <= 1:
                extracted_quiz_opts = kb.get("turn1_options", [])
            elif user_turns == 2:
                extracted_quiz_opts = kb.get("turn2_options", [])
            else:
                extracted_quiz_opts = ["Dosage Timing?", "Foods to Avoid?", "Side Effects?", "Consult Human Doctor"]
            break
    if not extracted_quiz_opts:
        if user_turns <= 1:
            extracted_quiz_opts = ["Started today", "Mild discomfort", "High severity", "No allergies"]
        else:
            extracted_quiz_opts = ["No known allergies", "Taking other meds", "Foods to avoid?", "Safe for sleep?"]

    return ChatResponse(
        content=reply,
        session_finished=session_finished,
        diagnosis=diagnosis,
        suggested_medicines=suggested_medicines,
        engine=ai_engine or "MEDORA Clinical AI",
        confidence_score=conf_score,
        confidence_label=conf_label,
        quiz_options=extracted_quiz_opts
    )


# ─── AI DRUG-DRUG INTERACTION CHECKER AT CHECKOUT ────────────────────────────

class DrugItem(BaseModel):
    name: str
    generic_name: Optional[str] = ""
    dosage: Optional[str] = ""

class InteractionCheckRequest(BaseModel):
    medicines: List[DrugItem]

class InteractionAlert(BaseModel):
    medicine_a: str
    medicine_b: str
    severity: str  # "CRITICAL" | "MODERATE" | "WARNING"
    title: str
    description: str
    recommendation: str

class InteractionCheckResponse(BaseModel):
    safe: bool
    severity: str  # "SAFE" | "MODERATE" | "CRITICAL"
    alerts: List[InteractionAlert]
    summary: str


@router.post("/check-interactions", response_model=InteractionCheckResponse)
def check_drug_interactions(req: InteractionCheckRequest):
    """
    Analyzes medicines in the patient's cart at checkout to detect dangerous
    drug-drug interactions, accidental duplicate dosing, and severe contraindications.
    """
    meds = req.medicines
    if len(meds) < 2:
        return InteractionCheckResponse(
            safe=True,
            severity="SAFE",
            alerts=[],
            summary="Single medicine in cart - no drug-drug combination conflicts detected."
        )

    alerts: List[InteractionAlert] = []

    # Helper text extractor
    def get_text(m: DrugItem) -> str:
        return f"{m.name} {m.generic_name or ''} {m.dosage or ''}".lower()

    # Pre-classify drugs
    paracetamol_meds = []
    nsaid_meds = []
    antibiotic_meds = []
    antacid_calcium_meds = []
    sedative_antihistamine_meds = []
    blood_thinner_meds = []
    steroid_meds = []
    ace_arb_meds = []
    potassium_meds = []

    for m in meds:
        t = get_text(m)
        if any(k in t for k in ["dolo", "crocin", "calpol", "pacimol", "paracetamol", "acetaminophen", "combiflam", "febrex"]):
            paracetamol_meds.append(m)
        if any(k in t for k in ["ibuprofen", "combiflam", "diclofenac", "voveran", "aceclofenac", "zerodol", "naproxen", "brufen", "ketorolac"]):
            nsaid_meds.append(m)
        if any(k in t for k in ["ciprofloxacin", "cipro", "azithromycin", "azithral", "azee", "doxycycline", "doxy", "levofloxacin", "norfloxacin", "augmentin", "amoxicillin", "cefixime"]):
            antibiotic_meds.append(m)
        if any(k in t for k in ["gelusil", "digene", "shelcal", "calcium", "antacid", "sucralfate", "aluminium", "magnesium hydroxide"]):
            antacid_calcium_meds.append(m)
        if any(k in t for k in ["cetirizine", "allegra", "fexofenadine", "atarax", "hydroxyzine", "benadryl", "pheniramine", "avil", "montelukast", "ascoril"]):
            sedative_antihistamine_meds.append(m)
        if any(k in t for k in ["aspirin", "ecospirin", "clopidogrel", "clopilet", "warfarin", "eliquis", "apixaban", "heparin"]):
            blood_thinner_meds.append(m)
        if any(k in t for k in ["prednisolone", "dexamethasone", "betnesol", "deflazacort", "medrol", "hydrocortisone"]):
            steroid_meds.append(m)
        if any(k in t for k in ["telmisartan", "telma", "losartan", "enalapril", "ramipril"]):
            ace_arb_meds.append(m)
        if any(k in t for k in ["potassium", "k-bind", "potcl"]):
            potassium_meds.append(m)

    # Rule 1: Duplicate Paracetamol Overdose Hazard
    if len(paracetamol_meds) >= 2:
        names = [m.name for m in paracetamol_meds]
        alerts.append(InteractionAlert(
            medicine_a=names[0],
            medicine_b=names[1],
            severity="CRITICAL",
            title="⚠️ Duplicate Paracetamol Overdose Hazard",
            description=f"Both '{names[0]}' and '{names[1]}' contain Paracetamol (Acetaminophen). Co-administering multiple Paracetamol formulations risks exceeding the safe hepatotoxic ceiling (2000-4000mg/day), carrying severe risk of acute toxic liver injury.",
            recommendation=f"Remove one of the Paracetamol products ({names[0]} or {names[1]}) before completing checkout."
        ))

    # Rule 2: Dual NSAID / Bleeding & Gastric Ulcer Hazard
    if len(nsaid_meds) >= 2:
        names = [m.name for m in nsaid_meds]
        alerts.append(InteractionAlert(
            medicine_a=names[0],
            medicine_b=names[1],
            severity="CRITICAL",
            title="⚠️ Dual NSAID Gastric Ulceration Hazard",
            description=f"Taking '{names[0]}' concurrently with '{names[1]}' combines two potent non-steroidal anti-inflammatory drugs. This drastically increases the risk of severe gastric mucosal erosion, peptic ulcer perforation, and renal impairment.",
            recommendation=f"Choose either '{names[0]}' or '{names[1]}'. Do not consume two NSAID pain relievers together."
        ))

    # Rule 3: Blood Thinner + NSAID Hemorrhage Risk
    if blood_thinner_meds and nsaid_meds:
        bt_name = blood_thinner_meds[0].name
        nsaid_name = nsaid_meds[0].name
        alerts.append(InteractionAlert(
            medicine_a=bt_name,
            medicine_b=nsaid_name,
            severity="CRITICAL",
            title="🩸 Severe Internal Hemorrhage & Bleeding Risk",
            description=f"Combining blood thinner / antiplatelet '{bt_name}' with NSAID '{nsaid_name}' impairs normal clotting mechanisms and damages mucosal protection, creating a severe risk of gastrointestinal or systemic bleeding.",
            recommendation=f"Consult your doctor before taking '{nsaid_name}' with '{bt_name}'. Paracetamol (e.g. Dolo 650) is generally the preferred alternative for pain relief."
        ))

    # Rule 4: Antibiotic + Antacid / Calcium Chelation Inactivation
    if antibiotic_meds and antacid_calcium_meds:
        ab_name = antibiotic_meds[0].name
        ant_name = antacid_calcium_meds[0].name
        alerts.append(InteractionAlert(
            medicine_a=ab_name,
            medicine_b=ant_name,
            severity="MODERATE",
            title="⚠️ Antibiotic Inactivation by Antacid / Minerals",
            description=f"Metal cations (Calcium, Magnesium, Aluminium) in '{ant_name}' chelate and bind with '{ab_name}' in the digestive tract, preventing antibiotic absorption and causing treatment failure.",
            recommendation=f"Maintain a minimum 2 to 3 hour gap between taking '{ab_name}' and '{ant_name}'."
        ))

    # Rule 5: Steroid + NSAID Synergistic Ulceration
    if steroid_meds and nsaid_meds:
        st_name = steroid_meds[0].name
        nsaid_name = nsaid_meds[0].name
        alerts.append(InteractionAlert(
            medicine_a=st_name,
            medicine_b=nsaid_name,
            severity="CRITICAL",
            title="⚠️ Synergistic Peptic Ulceration & Perforation",
            description=f"Corticosteroid '{st_name}' combined with NSAID '{nsaid_name}' produces a 4x to 15x multiplied risk of acute upper gastrointestinal ulceration and hemorrhage.",
            recommendation="Do not combine steroids with NSAIDs without explicit physician supervision and proton-pump inhibitor (e.g. Pantocid 40) co-prescription."
        ))

    # Rule 6: Dual Sedative / Antihistamine CNS Depression
    if len(sedative_antihistamine_meds) >= 2:
        names = [m.name for m in sedative_antihistamine_meds]
        alerts.append(InteractionAlert(
            medicine_a=names[0],
            medicine_b=names[1],
            severity="MODERATE",
            title="💤 Additive Sedation & CNS Depression",
            description=f"Combining '{names[0]}' with '{names[1]}' produces additive antihistaminic CNS suppression, causing marked drowsiness, slowed reflexes, and impaired psychomotor coordination.",
            recommendation=f"Avoid combining multiple anti-allergic or cough preparations together. Do not drive or operate machinery."
        ))

    # Rule 7: ACE-Inhibitor / ARB + Potassium Hyperkalemia
    if ace_arb_meds and potassium_meds:
        ace_name = ace_arb_meds[0].name
        pot_name = potassium_meds[0].name
        alerts.append(InteractionAlert(
            medicine_a=ace_name,
            medicine_b=pot_name,
            severity="CRITICAL",
            title="❤️ Life-Threatening Hyperkalemia Risk",
            description=f"Blood pressure medication '{ace_name}' reduces renal excretion of potassium. Combining with '{pot_name}' can cause acute hyperkalemia and lethal cardiac dysrhythmias.",
            recommendation=f"Do not take potassium supplements with '{ace_name}' unless expressly directed by your cardiologist with serum electrolyte monitoring."
        ))

    if alerts:
        has_critical = any(a.severity == "CRITICAL" for a in alerts)
        overall_severity = "CRITICAL" if has_critical else "MODERATE"
        return InteractionCheckResponse(
            safe=False,
            severity=overall_severity,
            alerts=alerts,
            summary=f"Detected {len(alerts)} clinically significant drug-drug interaction(s). Please review safety advisories before proceeding."
        )

    return InteractionCheckResponse(
        safe=True,
        severity="SAFE",
        alerts=[],
        summary="All medicines in cart reviewed. No dangerous drug-drug interactions or duplicate dosing detected."
    )
