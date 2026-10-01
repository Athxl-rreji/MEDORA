@echo off
setlocal enabledelayedexpansion

echo ============================================================
echo          MEDORA Automated Cloud Deployment (Vercel)
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
echo [Step 1] Ensuring Git commits are synced...
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo [NOTE] If Git login is requested, click "Push origin" in GitHub Desktop.
)

echo.
echo ============================================================
echo [Step 2/5] Deploying Core FastAPI Backend to Vercel...
echo ============================================================
cd /d "%~dp0backend"
cmd /c "npx -y vercel deploy --prod --yes"

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
echo Core Backend API:     https://backend-three-kappa-38.vercel.app
echo Patient Portal:       https://frontend-user-athxl-rrejis-projects.vercel.app
echo.
pause
