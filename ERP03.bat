@echo off
title ERP03 Command Center
color 0A

echo.
echo   ========================================
echo     ERP03 Command Center
echo     Starting all services...
echo   ========================================
echo.

set PROJECT=d:\DEV2026\ERP03

echo [1/4] Starting Firebase Emulators...
start "ERP03-Emulators" cmd /k "cd /d %PROJECT% && npx firebase emulators:start --import=emulator-data"
timeout /t 3 /nobreak >nul

echo [2/4] Building Backend...
start "ERP03-Backend" cmd /k "cd /d %PROJECT%\backend && npm run build"
timeout /t 2 /nobreak >nul

echo [3/4] Starting Frontend...
start "ERP03-Frontend" cmd /k "cd /d %PROJECT%\frontend && npm run dev"
timeout /t 2 /nobreak >nul

echo [4/4] Starting Command Center Dashboard...
start "ERP03-Dashboard" cmd /k "cd /d %PROJECT%\command-center && npm start"
timeout /t 3 /nobreak >nul

echo.
echo   All services started!
echo   Opening Command Center...
echo.
start http://localhost:5555

echo   ========================================
echo   Services running:
echo     Dashboard:   http://localhost:5555
echo     Frontend:    http://localhost:5173
echo     Emulator UI: http://localhost:4000
echo     Backend API: http://localhost:5001
echo   ========================================
echo.
echo   Press any key to close this window.
echo   (Services keep running in their own windows)
pause >nul
