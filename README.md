# MEDORA - AI-Powered Pharmacy Ecosystem

A scalable, hybrid monorepo for a next-generation pharmacy ecosystem, featuring a modular architecture that integrates AI services, delivery logistics, and quick-commerce compatibility.

## 📁 Full Folder Structure

```
.
├── ai-services/                # Independent Python AI modules
│   ├── prescription/           # OCR & verification models
│   ├── recommendation/         # Generic alternative matchers
│   └── symptom/                # RAG-based symptom analysis
├── backend/                    # FastAPI core backend
│   ├── app/
│   │   ├── api/routes/         # API Endpoint controllers
│   │   ├── core/               # Config, security, globals
│   │   ├── models/             # Pydantic/SQLAlchemy models
│   │   └── services/           # Business logic layer
│   ├── main.py                 # FastAPI application entry
│   └── requirements.txt        # Backend dependencies
├── database/                   # Supabase database configurations
│   └── schema.sql              # Core initial schema
├── frontend-pharmacy/          # Next.js Pharmacy Dashboard
│   ├── src/app/
│   └── package.json
├── frontend-user/              # Next.js User Web App
│   ├── src/app/
│   └── package.json
├── mobile-delivery/            # React Native Delivery App
│   ├── src/
│   └── package.json
├── mobile-user/                # React Native User App
│   ├── src/
│   └── package.json
└── shared/                     # Shared config, TS types
    ├── types/
    └── utils/
```

## 🚀 Running the Modules Locally

**Prerequisites:** Node.js (v18+), Python (3.10+), Docker (optional). Ensure `.env` is setup in each service.

1. **Backend API (FastAPI)**
   ```sh
   cd backend
   python -m venv venv
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

2. **AI Services**
   ```sh
   cd ai-services
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   uvicorn symptom.main:app --reload --port 8001
   # (Run other services on diff ports incrementally)
   ```

3. **Frontend: User Web (Next.js)**
   ```sh
   cd frontend-user
   npm install
   npm run dev  # runs on localhost:3000
   ```

4. **Frontend: Pharmacy Dashboard (Next.js)**
   ```sh
   cd frontend-pharmacy
   npm install
   npm run dev  # runs on localhost:3001
   ```

5. **Mobile: User / Delivery (React Native/Expo)**
   ```sh
   cd mobile-user # or mobile-delivery
   npm install
   npm start # Follow expo instructions to load in simulator or phone
   ```

## 🌐 Complete API Endpoints List

**Auth (`/api/v1/auth`)**
* `POST /login` - Supabase token exchange
* `POST /register` - Register user/pharmacy

**Medicines (`/api/v1/medicines`)**
* `GET /search?q={query}` - Search & rank DB
* `GET /{id}/alternatives` - Calls Recommendation AI

**Prescriptions (`/api/v1/prescriptions`)**
* `POST /upload` - Store in Supabase, triggers OCR AI
* `GET /{id}` - Review uploaded prescription status

**Orders (`/api/v1/orders`)**
* `POST /create` - Create new order (Pickup/Delivery)
* `GET /{id}` - Track order status realtime (Supabase realtime fallback)
* `POST /{id}/accept` - Pharmacy accepts order
* `POST /{id}/assign-delivery` - Dispatch delivery agent

**Internal AI Services (Microservices via RPC/HTTP)**
* `POST /ai/verify-prescription`
* `POST /ai/symptom-check`
* `GET /ai/forecast-inventory`

