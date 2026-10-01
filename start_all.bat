@echo off
TITLE MEDORA Ecosystem Startup
SETLOCAL EnableDelayedExpansion
SET "ROOT_DIR=%~dp0"

:: Detect local network IPv4 address for multi-device access (Mac, iPhone, Android)
SET "LAN_IP=127.0.0.1"
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    if "!LAN_IP!"=="127.0.0.1" (
        for /f "tokens=1" %%b in ("%%a") do set "LAN_IP=%%b"
    )
)

echo ===================================================================
echo               MEDORA HEALTHCARE PLATFORM - ONE-CLICK LAUNCHER
echo ===================================================================
echo Root Directory: %ROOT_DIR%
echo Detected Network IP: %LAN_IP%
echo.

:: 1. Launch FastAPI Core Backend on Port 8000
echo [1/5] Launching FastAPI Core Backend (0.0.0.0:8000)...
start "MEDORA Service - Backend API" cmd /k "title MEDORA Service - Backend API && cd /d "%ROOT_DIR%backend" && call "%ROOT_DIR%backend\venv\Scripts\activate.bat" && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: 2. Launch AI Services on Port 8001
echo [2/5] Launching FastAPI AI Services (0.0.0.0:8001)...
start "MEDORA Service - AI Services" cmd /k "title MEDORA Service - AI Services && cd /d "%ROOT_DIR%ai-services" && call "%ROOT_DIR%ai-services\venv\Scripts\activate.bat" && python -m uvicorn symptom.main:app --host 0.0.0.0 --port 8001 --reload"

:: 3. Launch Patient & Master Admin Web App on Port 3000
echo [3/5] Launching Patient & Admin Portal (0.0.0.0:3000)...
start "MEDORA Service - User Web App" cmd /k "title MEDORA Service - User Web App && cd /d "%ROOT_DIR%frontend-user" && npm run dev"

:: 4. Launch Pharmacy Dashboard on Port 3001
echo [4/5] Launching Pharmacy Terminal (0.0.0.0:3001)...
start "MEDORA Service - Pharmacy Web App" cmd /k "title MEDORA Service - Pharmacy Web App && cd /d "%ROOT_DIR%frontend-pharmacy" && npm run dev"

:: 5. Launch Delivery Rider Dashboard on Port 3002
echo [5/5] Launching Delivery Rider Dashboard (0.0.0.0:3002)...
start "MEDORA Service - Delivery Web App" cmd /k "title MEDORA Service - Delivery Web App && cd /d "%ROOT_DIR%frontend-delivery" && npm run dev"

echo.
echo ===================================================================
echo   All 5 MEDORA microservices launched in separate terminals!
echo ===================================================================
echo.
echo   [THIS LAPTOP ACCESS]
echo   --------------------
echo   * Patient & Admin:      http://localhost:3000
echo   * Pharmacy Terminal:    http://localhost:3001
echo   * Delivery Console:     http://localhost:3002
echo   * Backend API:          http://localhost:8000 (Swagger: /docs)
echo.
echo   [MAC, IPHONE, ANDROID, TABLET ACCESS (SAME WI-FI)]
echo   --------------------------------------------------
echo   * Patient & Admin:      http://%LAN_IP%:3000
echo   * Pharmacy Terminal:    http://%LAN_IP%:3001
echo   * Delivery Console:     http://%LAN_IP%:3002
echo   * Backend API:          http://%LAN_IP%:8000
echo.
echo   NOTE: If other devices cannot connect, run setup_firewall.bat once.
echo ===================================================================
echo.
echo Waiting 4 seconds for servers to start, then opening browser...
timeout /t 4 /nobreak >nul

start http://localhost:3000

echo.
echo To shut down all services and terminal windows safely, run:
echo   kill_all.bat
echo.
pause
