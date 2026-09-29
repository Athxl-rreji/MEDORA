@echo off
TITLE MEDORA Ecosystem Startup

echo ===================================================
echo   Starting MEDORA Ecosystem Microservices
echo ===================================================

echo [1/5] Starting FastAPI Core Backend (Port 8000)...
start "MEDORA Service - Backend API" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate.bat && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/5] Starting FastAPI AI Services (Port 8001)...
start "MEDORA Service - AI Services" cmd /k "cd /d "%~dp0ai-services" && call venv\Scripts\activate.bat && python -m uvicorn symptom.main:app --port 8001 --reload"

echo [3/5] Starting Patient Web Portal (Port 3000)...
start "MEDORA Service - User Web App" cmd /k "cd /d "%~dp0frontend-user" && npm run dev"

echo [4/5] Starting Pharmacy Dashboard (Port 3001)...
start "MEDORA Service - Pharmacy Web App" cmd /k "cd /d "%~dp0frontend-pharmacy" && npm run dev"

echo [5/5] Starting Delivery Rider App (Port 3002)...
start "MEDORA Service - Delivery Web App" cmd /k "cd /d "%~dp0frontend-delivery" && npm run dev"

echo.
echo ===================================================
echo   All MEDORA microservices launched successfully!
echo   -------------------------------------------------
echo   - Core Backend API:   http://localhost:8000
echo   - AI Services:        http://localhost:8001
echo   - Patient Portal:     http://localhost:3000
echo   - Pharmacy Dashboard: http://localhost:3001
echo   - Delivery Rider App: http://localhost:3002
echo ===================================================
echo Run kill_all.bat to stop all services.
echo.
pause
