@echo off
setlocal enabledelayedexpansion

echo ============================================================
echo      MEDORA Automated Cloud Deployment (Railway + Vercel)
echo ============================================================
echo.

echo [Step 1] Ensuring Git is up to date...
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo [!] If Git login is requested, please complete it in your browser or click "Push origin" in GitHub Desktop.
)

echo.
echo ============================================================
echo [Step 2] Deploying Backend to Railway...
echo ============================================================
cd /d "%~dp0backend"
cmd /c "npx -y @railway/cli up"

echo.
echo ============================================================
echo [Step 3] Deploying Frontend-User to Vercel...
echo ============================================================
cd /d "%~dp0frontend-user"
cmd /c "npx -y vercel deploy --prod"

echo.
echo ============================================================
echo [Step 4] Deploying Frontend-Pharmacy to Vercel...
echo ============================================================
cd /d "%~dp0frontend-pharmacy"
cmd /c "npx -y vercel deploy --prod"

echo.
echo ============================================================
echo [Step 5] Deploying Frontend-Delivery to Vercel...
echo ============================================================
cd /d "%~dp0frontend-delivery"
cmd /c "npx -y vercel deploy --prod"

cd /d "%~dp0"
echo.
echo ============================================================
echo      Deployment Complete! All services are online!
echo ============================================================
pause
