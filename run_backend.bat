@echo off
title SkillProof Backend (Port 8000)
cd /d "%~dp0backend"
echo ========================================================
echo   Starting SkillProof Backend (FastAPI) on port 8000
echo ========================================================
call .venv\Scripts\activate.bat
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
pause
