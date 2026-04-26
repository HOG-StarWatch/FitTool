#!/bin/bash
# Termux 一键运行脚本 - Fit Tool (TS-Hono)
# 使用方式：将此脚本和项目文件放到Termux可访问的目录，执行 bash run.sh

set -e

echo "=========================================="
echo "  Fit Tool TS-Hono - Termux 一键启动"
echo "=========================================="

# 检测是否已安装 Node.js
if ! command -v node &> /dev/null; then
    echo ""
    echo "[*] 正在安装 Node.js..."
    pkg update -y
    pkg install -y nodejs
fi

# 检测是否已安装 npm
if ! command -v npm &> /dev/null; then
    echo ""
    echo "[*] 正在安装 npm..."
    pkg update -y
    pkg install -y npm
fi

# 进入脚本所在目录
cd "$(dirname "$0")"

# 安装依赖
echo ""
echo "[*] 正在安装项目依赖..."
npm install

# 启动服务
echo ""
echo "[*] 启动服务中..."
echo "=========================================="
npm start
