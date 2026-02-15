@echo off
title Fullstack App (Ctrl+C to Stop)

echo ===================================================
echo   Starting Backend (3001) + Frontend (5173)
echo   Close this window to stop ALL processes.
echo ===================================================

cd /d "%~dp0"

npm start

pause
