#!/bin/bash

# MeetMind 前端部署脚本
# 使用前请修改下方配置

# ============ 配置区域 ============
SERVER_USER="your-username"        # SSH 用户名
SERVER_HOST="your-server-ip"       # 服务器 IP 或域名
REMOTE_PATH="/var/www/meetmind-frontend/dist"  # 远程部署路径
# ==================================

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "       MeetMind 前端部署脚本"
echo "=========================================="
echo ""

# 检查配置
if [ "$SERVER_USER" = "your-username" ] || [ "$SERVER_HOST" = "your-server-ip" ]; then
    echo -e "${RED}错误：请先修改脚本中的服务器配置！${NC}"
    echo "编辑 deploy.sh 文件，修改 SERVER_USER 和 SERVER_HOST"
    exit 1
fi

# 检查是否在正确目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}错误：请在 meetmind-frontend 目录下运行此脚本${NC}"
    exit 1
fi

# 检查 .env.production 文件
if [ ! -f ".env.production" ]; then
    echo -e "${YELLOW}警告：未找到 .env.production 文件${NC}"
    echo "将使用默认 API 地址: /api"
    echo ""
    read -p "是否继续？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}[1/4] 安装依赖...${NC}"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}依赖安装失败！${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}[2/4] 构建生产版本...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}构建失败！${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}[3/4] 上传到服务器...${NC}"
echo "目标: ${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}"

# 使用 rsync 同步文件（增量上传，删除远程多余文件）
rsync -avz --delete --progress dist/ ${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/

if [ $? -ne 0 ]; then
    echo -e "${RED}上传失败！请检查：${NC}"
    echo "  1. SSH 连接是否正常"
    echo "  2. 远程目录是否存在"
    echo "  3. 是否有写入权限"
    exit 1
fi

echo ""
echo -e "${GREEN}[4/4] 部署完成！${NC}"
echo ""
echo "=========================================="
echo -e "${GREEN}✓ 部署成功${NC}"
echo "=========================================="
echo ""
echo "请验证："
echo "  1. 访问网站首页"
echo "  2. 检查登录功能"
echo "  3. 刷新页面是否正常"
echo "  4. 查看浏览器控制台是否有错误"
echo ""
