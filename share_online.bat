@echo off
TITLE MEDORA Public Online Sharing Tunnel

echo ==============================================================
echo        MEDORA Public Cloud Tunnel (Instant Web Access)
echo ==============================================================
echo  This script opens a secure public HTTPS link to your MEDORA
echo  services so anyone can access them from ANY device or network
echo  without needing to be on the same Wi-Fi.
echo ==============================================================
echo.

echo [1/2] Creating Public HTTPS Tunnel for Backend API (Port 8000)...
start "MEDORA Public Tunnel - Backend" cmd /k "title MEDORA Public Tunnel - Backend && npx -y localtunnel --port 8000"

echo [2/2] Creating Public HTTPS Tunnel for Patient Portal (Port 3000)...
start "MEDORA Public Tunnel - Frontend" cmd /k "title MEDORA Public Tunnel - Frontend && npx -y localtunnel --port 3000"

echo.
echo ==============================================================
echo  Public tunnels created!
echo  Check the opened terminal windows to see your public URLs:
echo    e.g. https://xxxx-xxxx.loca.lt
echo ==============================================================
echo.
pause
