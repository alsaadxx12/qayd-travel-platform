@echo off
chcp 65001 >nul
title Qayd - launcher
cd /d "%~dp0"

echo.
echo   ==========================================
echo    Qayd Travel Platform - starting up
echo   ==========================================
echo.

if not exist "%~dp0backend\node_modules\@nestjs\core" (
  echo   [!] backend dependencies missing - installing...
  pushd "%~dp0backend" && call npm install && popd
)
if not exist "%~dp0frontend\node_modules\vite" (
  echo   [!] frontend dependencies missing - installing...
  pushd "%~dp0frontend" && call npm install && popd
)

echo   Opening BACKEND window  ... http://localhost:4000
start "Qayd BACKEND :4000" cmd /k "cd /d "%~dp0backend" && npm run start:dev"

echo   Waiting for the API to come up...
timeout /t 12 /nobreak >nul

echo   Opening FRONTEND window ... http://localhost:3001
start "Qayd FRONTEND :3001" cmd /k "cd /d "%~dp0frontend" && npm run dev"

timeout /t 8 /nobreak >nul
start "" "http://localhost:3001"

echo.
echo   Both windows are open. Close THEM to stop the servers.
echo   This launcher window can be closed now.
echo.
pause
