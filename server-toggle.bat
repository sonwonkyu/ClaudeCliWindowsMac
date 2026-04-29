@echo off
chcp 65001 >nul
setlocal

:: Check if server is running on port 3333
set "PID="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3333.*LISTENING" 2^>nul') do (
    if not defined PID set "PID=%%a"
)

if defined PID (
    :: Server is running — kill it
    taskkill /PID %PID% /F >nul 2>&1
    echo [OFF] Server stopped (PID %PID%)
    exit /b 0
) else (
    :: Server is not running — start it
    cd /d "%~dp0"
    start "" /B node server.js
    timeout /t 1 /nobreak >nul
    echo [ON] Server started at http://localhost:3333
    start http://localhost:3333
    exit /b 0
)
