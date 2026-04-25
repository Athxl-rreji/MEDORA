@echo off
TITLE Stop MEDORA Ecosystem

echo WARNING: Terminating all NodeJS and Python development servers...
echo.

taskkill /F /IM node.exe
taskkill /F /IM python.exe

echo.
echo All background backend and frontend frameworks have been successfully terminated!
echo You may close this window.
pause
