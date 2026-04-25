@echo off
TITLE MEDORA Ecosystem Startup

echo ==========================================
echo Starting MEDORA Ecosystem Microservices
echo ==========================================

echo [1/5] Starting FastAPI Core Backend (Port 8000, all interfaces)...
start "MEDORA Backend API" cmd /k "cd backend && call venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8000"

echo [2/5] Starting FastAPI AI Services (Port 8001)...
start "MEDORA AI Services" cmd /k "cd ai-services && call venv\Scripts\activate && uvicorn symptom.main:app --port 8001"

echo [3/5] Starting Next.js User Frontend (Port 3000)...
start "MEDORA User App" cmd /k "cd frontend-user && npm run dev"

echo [4/5] Starting Next.js Pharmacy Admin (Port 3001)...
start "MEDORA Pharmacy App" cmd /k "cd frontend-pharmacy && npm run dev"

echo [5/5] Starting Next.js Delivery Rider (Port 3002)...
start "MEDORA Rider App" cmd /k "cd frontend-delivery && npm run dev"

echo.
echo All services have been launched in separate secure windows.
echo Close the individual windows or run kill_all.bat to stop them.
pause
