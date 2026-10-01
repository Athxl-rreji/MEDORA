@echo off
TITLE MEDORA Firewall Setup

:: Check for Administrator permissions
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator privileges to configure Windows Firewall...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo ==============================================================
echo     Configuring Windows Firewall Inbound Rules for MEDORA
echo ==============================================================
echo.

:: Add rules for all 5 microservices
echo Allowing Port 8000 (Core Backend API)...
netsh advfirewall firewall delete rule name="MEDORA Backend (8000)" >nul 2>&1
netsh advfirewall firewall add rule name="MEDORA Backend (8000)" dir=in action=allow protocol=TCP localport=8000 >nul 2>&1

echo Allowing Port 8001 (AI Clinical Services)...
netsh advfirewall firewall delete rule name="MEDORA AI (8001)" >nul 2>&1
netsh advfirewall firewall add rule name="MEDORA AI (8001)" dir=in action=allow protocol=TCP localport=8001 >nul 2>&1

echo Allowing Port 3000 (Patient & Admin Portal)...
netsh advfirewall firewall delete rule name="MEDORA User Web (3000)" >nul 2>&1
netsh advfirewall firewall add rule name="MEDORA User Web (3000)" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1

echo Allowing Port 3001 (Pharmacy Terminal)...
netsh advfirewall firewall delete rule name="MEDORA Pharmacy (3001)" >nul 2>&1
netsh advfirewall firewall add rule name="MEDORA Pharmacy (3001)" dir=in action=allow protocol=TCP localport=3001 >nul 2>&1

echo Allowing Port 3002 (Delivery Rider Console)...
netsh advfirewall firewall delete rule name="MEDORA Delivery (3002)" >nul 2>&1
netsh advfirewall firewall add rule name="MEDORA Delivery (3002)" dir=in action=allow protocol=TCP localport=3002 >nul 2>&1

echo.
echo ==============================================================
echo  [SUCCESS] Windows Firewall successfully configured for MEDORA!
echo  Devices on your local Wi-Fi / hotspot (Mac, iPhone, Android)
echo  can now access all portals directly without connection drops.
echo ==============================================================
echo.
pause
