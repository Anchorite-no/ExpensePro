@echo off
chcp 65001 >nul
title Expense Pro 启动器

echo ===================================================
echo   Expense Pro - 开发环境启动器
echo ===================================================
echo.

cd /d "%~dp0"

:: 检查 .env 文件
if not exist ".env" (
    echo [ERROR] .env 文件不存在
    echo 请复制 .env.example 为 .env 并配置
    pause
    exit /b 1
)

:: 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js 未安装
    echo 请访问 https://nodejs.org/ 下载安装
    pause
    exit /b 1
)

:: 检查 MySQL
echo [1/4] 检查 MySQL 数据库...
set MYSQL_CHECK=mysql
where mysql >nul 2>nul
if %errorlevel% neq 0 (
    set MYSQL_CHECK=mariadb
    where mariadb >nul 2>nul
)

if %errorlevel% neq 0 (
    echo [WARNING] MySQL/MariaDB 未安装或未在 PATH 中
    echo.
    echo 请先安装 MySQL:
    echo   1. 下载 MySQL: https://dev.mysql.com/downloads/installer/
    echo   2. 安装时选择 "Full" 安装类型
    echo   3. 配置 root 密码
    echo.
    echo 或使用 Chocolatey: choco install mysql
    echo.
    pause
    exit /b 1
)

:: 检查 MySQL 服务状态
echo [2/4] 检查 MySQL 服务状态...
net start | findstr /i "mysql mariadb" >nul
if %errorlevel% neq 0 (
    echo [INFO] MySQL 服务未启动，正在尝试启动...
    net start MySQL80 >nul 2>nul
    if %errorlevel% neq 0 (
        net start MySQL >nul 2>nul
        if %errorlevel% neq 0 (
            net start MariaDB >nul 2>nul
        )
    )
)

:: 检查数据库是否存在
echo [3/4] 检查数据库配置...
set DB_HOST=localhost
set DB_PORT=3306
set DB_NAME=expense_pro

for /f "tokens=1,* delims==" %%a in ('findstr /i "DB_" .env 2^>nul') do (
    if /i "%%a"=="DB_HOST" set DB_HOST=%%b
    if /i "%%a"=="DB_PORT" set DB_PORT=%%b
    if /i "%%a"=="DB_NAME" set DB_NAME=%%b
)

mysql -h %DB_HOST% -P %DB_PORT% -e "USE %DB_NAME%;" 2>nul
if %errorlevel% neq 0 (
    echo [INFO] 数据库 %DB_NAME% 不存在，正在创建...
    mysql -h %DB_HOST% -P %DB_PORT% -e "CREATE DATABASE IF NOT EXISTS %DB_NAME% CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    if %errorlevel% neq 0 (
        echo [ERROR] 创建数据库失败，请检查 .env 中的数据库配置
        pause
        exit /b 1
    )
    echo [OK] 数据库已创建
)

:: 创建数据表
echo [4/4] 同步数据库表结构...
cd /d "%~dp0server"
npx drizzle-kit push 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] 数据表同步失败，请手动运行: cd server ^&^& npx drizzle-kit push
)

echo.
echo ===================================================
echo   启动服务...
echo   后端: http://localhost:3001
echo   前端: http://localhost:5173
echo   按 Ctrl+C 停止所有服务
echo ===================================================

:: 安装依赖并启动
cd /d "%~dp0"
start "Frontend - Vite" cmd /k "cd /d "%~dp0client" && npm run dev"
start "Backend - Server" cmd /k "cd /d "%~dp0server" && npm run dev"

echo [OK] 服务已启动，窗口将自动关闭
timeout /t 3 /nobreak >nul
