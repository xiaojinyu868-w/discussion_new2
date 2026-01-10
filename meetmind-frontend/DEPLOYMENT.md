# MeetMind 前端部署指南

本指南帮助你将 MeetMind 前端项目正确部署到带域名的服务器上。

## 目录

1. [环境变量配置](#1-环境变量配置)
2. [构建生产版本](#2-构建生产版本)
3. [Nginx 配置](#3-nginx-配置)
4. [部署步骤](#4-部署步骤)
5. [常见问题排查](#5-常见问题排查)
6. [更新部署检查清单](#6-更新部署检查清单)

---

## 1. 环境变量配置

### 1.1 创建生产环境变量文件

在 `meetmind-frontend` 目录下创建 `.env.production` 文件：

```bash
# 在 meetmind-frontend 目录下执行
touch .env.production
```

### 1.2 配置 API 地址

编辑 `.env.production` 文件：

```env
# 方式一：使用相对路径（推荐，前后端同域名）
VITE_API_BASE_URL=/api

# 方式二：使用绝对路径（前后端不同域名）
# VITE_API_BASE_URL=https://api.yourdomain.com
```

**说明**：
- 如果前端和后端部署在同一域名下（通过 Nginx 反向代理），使用 `/api` 即可
- 如果后端部署在独立域名，需要填写完整的 API 地址

### 1.3 环境变量生效原理

前端代码中使用环境变量的位置（`src/services/api.ts`）：

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
```

**重要**：Vite 的环境变量在**构建时**被注入，而非运行时。因此：
- 修改 `.env.production` 后必须**重新构建**
- 构建后的静态文件中 API 地址是固定的

---

## 2. 构建生产版本

### 2.1 安装依赖

```bash
cd meetmind-frontend
npm install
```

### 2.2 构建

```bash
npm run build
```

构建产物位于 `dist/` 目录，包含：
- `index.html` - 入口文件
- `assets/` - JS、CSS、图片等静态资源

### 2.3 预览构建结果（可选）

```bash
npm run preview
```

访问 `http://localhost:4173` 预览生产构建效果。

---

## 3. Nginx 配置

### 3.1 基础配置（前后端同域名）

假设：
- 域名：`meetmind.yourdomain.com`
- 前端静态文件：`/var/www/meetmind-frontend/dist`
- 后端服务：`localhost:4000`

```nginx
server {
    listen 80;
    server_name meetmind.yourdomain.com;
    
    # 重定向到 HTTPS（如果有 SSL 证书）
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name meetmind.yourdomain.com;

    # SSL 证书配置
    ssl_certificate /etc/nginx/ssl/yourdomain.com.pem;
    ssl_certificate_key /etc/nginx/ssl/yourdomain.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 前端静态文件
    root /var/www/meetmind-frontend/dist;
    index index.html;

    # 前端路由 - SPA 单页应用支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://localhost:4000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket 支持（如果后端有 WebSocket 服务）
    location /ws/ {
        proxy_pass http://localhost:4000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;  # WebSocket 长连接
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;
}
```

### 3.2 仅 HTTP 配置（无 SSL 证书）

```nginx
server {
    listen 80;
    server_name meetmind.yourdomain.com;

    root /var/www/meetmind-frontend/dist;
    index index.html;

    # 前端路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://localhost:4000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 3.3 配置说明

| 配置项 | 说明 |
|--------|------|
| `try_files $uri $uri/ /index.html` | SPA 路由支持，所有前端路由都返回 index.html |
| `proxy_pass http://localhost:4000/` | 将 `/api/` 请求代理到后端，注意末尾的 `/` 会去掉 `/api` 前缀 |
| `proxy_set_header Upgrade` | WebSocket 升级支持 |
| `expires 1y` | 静态资源长期缓存 |

---

## 4. 部署步骤

### 4.1 首次部署

```bash
# 1. 在本地构建
cd meetmind-frontend
npm install
npm run build

# 2. 上传到服务器
scp -r dist/* user@your-server:/var/www/meetmind-frontend/dist/

# 3. 在服务器上配置 Nginx
sudo vim /etc/nginx/sites-available/meetmind
# 粘贴上面的 Nginx 配置

# 4. 启用站点
sudo ln -s /etc/nginx/sites-available/meetmind /etc/nginx/sites-enabled/

# 5. 测试配置
sudo nginx -t

# 6. 重载 Nginx
sudo systemctl reload nginx
```

### 4.2 更新部署

```bash
# 1. 本地重新构建
cd meetmind-frontend
npm run build

# 2. 上传新的构建产物
scp -r dist/* user@your-server:/var/www/meetmind-frontend/dist/

# 3. 清除 Nginx 缓存（如果配置了缓存）
# 通常静态文件名带 hash，无需清除缓存
```

### 4.3 使用部署脚本（推荐）

在 `meetmind-frontend` 目录下创建 `deploy.sh`：

```bash
#!/bin/bash

# 配置
SERVER_USER="your-username"
SERVER_HOST="your-server-ip"
REMOTE_PATH="/var/www/meetmind-frontend/dist"

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}[1/4] 安装依赖...${NC}"
npm install

echo -e "${GREEN}[2/4] 构建生产版本...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}构建失败！${NC}"
    exit 1
fi

echo -e "${GREEN}[3/4] 上传到服务器...${NC}"
rsync -avz --delete dist/ ${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/

if [ $? -ne 0 ]; then
    echo -e "${RED}上传失败！${NC}"
    exit 1
fi

echo -e "${GREEN}[4/4] 部署完成！${NC}"
echo "访问: https://meetmind.yourdomain.com"
```

使用方式：
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 5. 常见问题排查

### 5.1 页面空白或 404

**症状**：访问域名显示空白页或 404

**排查**：
1. 检查 Nginx 配置中 `root` 路径是否正确
2. 确认 `dist/index.html` 文件存在
3. 检查 `try_files` 配置是否正确

```bash
# 检查文件是否存在
ls -la /var/www/meetmind-frontend/dist/

# 检查 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```

### 5.2 API 请求失败 (502/504)

**症状**：页面加载但 API 请求失败

**排查**：
1. 确认后端服务正在运行
2. 检查后端端口是否正确（默认 4000）
3. 检查 Nginx 代理配置

```bash
# 检查后端服务状态
curl http://localhost:4000/api/health

# 检查后端进程
ps aux | grep node

# 查看后端日志
pm2 logs meetmind-backend  # 如果使用 PM2
```

### 5.3 刷新页面 404

**症状**：直接访问 `/recorder` 等路由返回 404

**原因**：Nginx 没有配置 SPA 路由支持

**解决**：确保 Nginx 配置包含：
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### 5.4 HTTPS 混合内容警告

**症状**：浏览器控制台显示 Mixed Content 警告

**原因**：HTTPS 页面请求了 HTTP 资源

**解决**：
1. 确保 `.env.production` 中 API 地址使用 HTTPS 或相对路径
2. 重新构建并部署

### 5.5 静态资源加载失败

**症状**：JS/CSS 文件 404

**排查**：
1. 检查 `dist/assets/` 目录是否完整上传
2. 检查文件权限

```bash
# 检查文件权限
ls -la /var/www/meetmind-frontend/dist/assets/

# 修复权限
sudo chown -R www-data:www-data /var/www/meetmind-frontend/
sudo chmod -R 755 /var/www/meetmind-frontend/
```

### 5.6 WebSocket 连接失败

**症状**：实时转写功能不工作

**排查**：
1. 检查 Nginx WebSocket 配置
2. 确认 `Upgrade` 和 `Connection` 头设置正确

```nginx
location /ws/ {
    proxy_pass http://localhost:4000/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

---

## 6. 更新部署检查清单

每次更新前端代码后，按此清单检查：

### 部署前

- [ ] 确认 `.env.production` 中 API 地址正确
- [ ] 本地 `npm run build` 构建成功
- [ ] 本地 `npm run preview` 预览正常

### 部署中

- [ ] 上传 `dist/` 目录所有文件
- [ ] 确认文件权限正确（755）

### 部署后

- [ ] 访问首页正常加载
- [ ] 登录功能正常（API 连通）
- [ ] 刷新页面不出现 404
- [ ] 检查浏览器控制台无报错
- [ ] 录音功能正常（WebSocket 连通）

### 快速验证命令

```bash
# 在服务器上执行

# 1. 检查 Nginx 配置
sudo nginx -t

# 2. 检查后端服务
curl -I http://localhost:4000/api/health

# 3. 检查前端文件
ls -la /var/www/meetmind-frontend/dist/

# 4. 检查 Nginx 日志
sudo tail -20 /var/log/nginx/access.log
sudo tail -20 /var/log/nginx/error.log
```

---

## 附录：后端部署参考

后端服务部署（使用 PM2）：

```bash
cd backend
npm install
npm run build

# 使用 PM2 启动
pm2 start dist/main.js --name meetmind-backend

# 设置开机自启
pm2 save
pm2 startup
```

后端环境变量配置（项目根目录 `.env`）：

```env
# 必须配置
DASHSCOPE_API_KEY=your-api-key
PORT=4000

# 可选配置
LLM_MODEL=qwen3-max
DASHSCOPE_ASR_WS_MODEL=qwen3-asr-flash-realtime
```

---

## 联系支持

如遇到无法解决的问题，请检查：
1. Nginx 错误日志：`/var/log/nginx/error.log`
2. 后端服务日志：`pm2 logs meetmind-backend`
3. 浏览器开发者工具 Network 和 Console 面板
