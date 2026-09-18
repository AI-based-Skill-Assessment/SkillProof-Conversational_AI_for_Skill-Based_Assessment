@echo off
title SkillProof Frontend (Port 5173)
cd /d "%~dp0frontend"
echo ========================================================
echo   Starting SkillProof Frontend (Vite) on port 5173
echo ========================================================
npm run dev
pause
