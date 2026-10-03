@echo off
setlocal enabledelayedexpansion

echo ============================================================
echo      MEDORA Full-Stack Cloud Deployment (Render + Vercel)
echo ============================================================
echo.

:: Check Vercel Login Status
echo Checking Vercel authentication...
cmd /c "npx -y vercel whoami" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] You are currently not logged in to Vercel.
    echo [!] Opening Vercel login in your browser...
    echo.
    cmd /c "npx -y vercel login"
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Vercel login failed or was cancelled.
        pause
        exit /b 1
    )
)

echo.
echo ============================================================
echo [Step 1/5] Syncing Git Commits to GitHub...
echo ============================================================
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo [NOTE] If Git credentials are required, click "Push origin" in GitHub Desktop.
)

echo.
echo ============================================================
echo [Step 2/5] Deploying Core FastAPI Backend to Render...
echo ============================================================
cd /d "%~dp0"
python deploy_render.py

echo.
echo ============================================================
echo [Step 3/5] Deploying Patient Web Portal to Vercel...
echo ============================================================
cd /d "%~dp0frontend-user"
cmd /c "npx -y vercel deploy --prod --yes"

echo.
echo ============================================================
echo [Step 4/5] Deploying Pharmacy Dashboard to Vercel...
echo ============================================================
cd /d "%~dp0frontend-pharmacy"
cmd /c "npx -y vercel deploy --prod --yes"

echo.
echo ============================================================
echo [Step 5/5] Deploying Delivery Rider Console to Vercel...
echo ============================================================
cd /d "%~dp0frontend-delivery"
cmd /c "npx -y vercel deploy --prod --yes"

cd /d "%~dp0"
echo.
echo ============================================================
echo      Deployment Complete! All MEDORA services are online!
echo ============================================================
echo.
echo Core Backend API:     https://medora-backend-4q9x.onrender.com
echo Patient Portal:       https://frontend-user-athxl-rrejis-projects.vercel.app
echo.
pause
