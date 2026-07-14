@echo off
TITLE Stop MEDORA Ecosystem

echo WARNING: Terminating all MEDORA development servers and terminal windows...
echo.

:: 1. Terminate terminal windows starting with "MEDORA Service - " and all their child processes
taskkill /F /T /FI "WINDOWTITLE eq MEDORA Service - *" >nul 2>&1

:: 2. Ensure any orphaned processes on the service ports are also terminated
for %%p in (8000 8001 3000 3001 3002) do (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr /c:":%%p " ^| findstr LISTENING 2^>nul') do (
        taskkill /F /T /PID %%a >nul 2>&1
    )
)

echo.
echo All MEDORA services and terminals have been successfully terminated!
