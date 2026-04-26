@echo off
chcp 65001 >nul
echo ==========================================
echo   Fit Tool JS-Express-@garmin_fitsdk - Windows 一键启动
echo ==========================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] 未检测到 Node.js，正在尝试安装...
    echo.
    echo 请选择安装方式：
    echo   1. 使用 winget 安装（推荐）
    echo   2. 访问 https://nodejs.org/ 下载安装
    echo   3. 使用其他包管理器（如 chocolatey、scoop）
    echo.
    set /p choice=请输入选择 (1/2/3):
    if "%choice%"=="1" (
        winget install OpenJS.NodeJS.LTS
    ) else if "%choice%"=="2" (
        start https://nodejs.org/
    ) else if "%choice%"=="3" (
        echo 请使用你的包管理器安装 Node.js
    )
    echo.
    echo 安装完成后，请重新运行此脚本
    pause
    exit /b 1
)

echo [*] 检测到 Node.js 版本：
node --version
echo.

cd /d "%~dp0"

echo [*] 正在安装项目依赖...
call npm install
if %errorlevel% neq 0 (
    echo [!] 依赖安装失败
    pause
    exit /b 1
)

echo.
echo [*] 启动服务中...
echo ==========================================
call npm start
