@echo off
echo ==========================================
echo   Fit Tool TS-Hono - Windows Launcher
echo ==========================================
echo.

where node >nul 2>&1
if %errorlevel% == 0 goto :has_node

echo [!] Node.js not found.
echo.
echo Install options:
echo   1. winget install (recommended)
echo   2. Open https://nodejs.org/
echo   3. Use your own package manager
echo.
set /p "choice=Enter choice (1/2/3): "
if "%choice%"=="1" winget install OpenJS.NodeJS.LTS
if "%choice%"=="2" start https://nodejs.org/
if "%choice%"=="3" echo Please install Node.js manually.
echo.
echo Restart this script after installation.
pause
exit /b 1

:has_node
echo [*] Node.js version:
node --version
echo.

cd /d "%~dp0"

if exist "node_modules\" goto :has_deps

echo [*] Installing dependencies...
call npm install
if %errorlevel% == 0 goto :has_deps
echo [!] npm install failed.
pause
exit /b 1

:has_deps
echo.
echo [*] Starting server...
echo ==========================================
call npm start
