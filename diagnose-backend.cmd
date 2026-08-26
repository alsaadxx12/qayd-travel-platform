@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "OUT=%~dp0diagnose-output.txt"
set "LOG=%~dp0backend-log.txt"

echo ==== QAYD BACKEND DIAGNOSTIC ====> "%OUT%"
echo when : %DATE% %TIME%>> "%OUT%"
echo root : %~dp0>> "%OUT%"
echo.>> "%OUT%"

echo [1] node / npm>> "%OUT%"
node -v >> "%OUT%" 2>&1
npm -v >> "%OUT%" 2>&1
echo.>> "%OUT%"

echo [2] listening on port 4000 (backend)?>> "%OUT%"
netstat -ano | findstr ":4000" >> "%OUT%" 2>&1
if errorlevel 1 echo     NOTHING is listening on 4000>> "%OUT%"
echo.>> "%OUT%"

echo [3] listening on port 3001 (vite)?>> "%OUT%"
netstat -ano | findstr ":3001" >> "%OUT%" 2>&1
if errorlevel 1 echo     NOTHING is listening on 3001>> "%OUT%"
echo.>> "%OUT%"

echo [4] backend node_modules installed?>> "%OUT%"
if exist "%~dp0backend\node_modules\@nestjs\core" (echo     YES>> "%OUT%") else (echo     MISSING -- run: cd backend ^&^& npm install>> "%OUT%")
echo.>> "%OUT%"

echo [5] prisma client generated?>> "%OUT%"
if exist "%~dp0backend\node_modules\.prisma\client" (echo     YES>> "%OUT%") else (echo     MISSING -- run: cd backend ^&^& npx prisma generate>> "%OUT%")
echo.>> "%OUT%"

echo [6] puppeteer chromium downloaded?>> "%OUT%"
if exist "%USERPROFILE%\.cache\puppeteer" (dir /b "%USERPROFILE%\.cache\puppeteer" >> "%OUT%" 2>&1) else (echo     NO folder at %USERPROFILE%\.cache\puppeteer  -- chromium was never downloaded>> "%OUT%")
echo.>> "%OUT%"

echo [7] compiled dist present?>> "%OUT%"
if exist "%~dp0backend\dist\src\main.js" (echo     YES>> "%OUT%") else (echo     MISSING>> "%OUT%")
echo.>> "%OUT%"

echo ==== END OF CHECKS ====>> "%OUT%"

type "%OUT%"
echo.
echo ----------------------------------------------------------
echo  Checks saved to  diagnose-output.txt
echo  Starting backend now. All output mirrored to backend-log.txt
echo  KEEP THIS WINDOW OPEN.  Ctrl+C stops the server.
echo ----------------------------------------------------------
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location -LiteralPath '%~dp0backend'; npm run start:dev 2>&1 | Tee-Object -FilePath '%LOG%'"

pause
