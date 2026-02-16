# ExpensePro 💰

一款全栈 AI 个人记账助手，集成 Google Gemini 实现小票图片智能识别与自动记账。

![React](https://img.shields.io/badge/React_19-Vite_7-61DAFB.svg)
![Backend](https://img.shields.io/badge/Express_5-Drizzle_ORM-green.svg)
![AI](https://img.shields.io/badge/AI-Google_Gemini-8E75B2.svg)
![Database](https://img.shields.io/badge/Database-MySQL_8.0-4479A1.svg)

## ✨ 功能概览

- **AI 智能记账** — 上传消费小票图片，Gemini AI 自动识别商家、金额、日期、分类，支持批量识别
- **交互式数据看板** — 堆积面积图、每日明细、分类占比饼图，多维度筛选
- **用户系统** — JWT 认证，数据隔离
- **深色/浅色主题** — 自适应切换
- **自定义分类** — 添加、删除、排序消费分类
- **响应式设计** — 桌面端与移动端适配

## 🔐 双版本架构

ExpensePro 支持两种部署模式，**同一套代码**，通过环境变量切换：

| 功能 | 开源版（默认） | 私有版 |
|------|--------------|--------|
| 注册方式 | 开放注册 | 邀请码注册 |
| AI Key | 用户自行配置 | 服务端统一管理，前端不可见 |
| 数据加密 | 无 | 客户端 E2E 加密（管理员无法查看） |

通过 `.env` 中的三个开关控制：

```env
INVITE_CODE=your-invite-code    # 留空=开放注册
SERVER_AI_KEY=AIzaSy...          # 留空=用户自行输入 Key
ENCRYPTION_ENABLED=true          # 留空=不加密
```

> **加密说明**：启用 E2E 加密后，`title`、`category`、`note` 字段在用户浏览器端加密后传输存储，服务端和数据库只存密文。`amount` 和 `date` 不加密以保留排序和统计功能。

## 🛠️ 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + Vite 7 + TypeScript + Recharts |
| 后端 | Node.js + Express 5 + Drizzle ORM |
| 数据库 | MySQL 8.0 |
| AI | Google Gemini API (2.0 Flash / 2.5 Flash) |

## 📁 项目结构

```
ExpensePro/
├── client/                # React 前端 (Vite)
│   └── src/
│       ├── components/    # UI 组件
│       ├── context/       # Auth Context (含 Master Key 管理)
│       ├── utils/         # 加密工具 (crypto.ts)
│       ├── App.tsx        # 主应用
│       └── App.css        # 全局样式
├── server/                # Express 后端
│   └── src/
│       ├── db/            # Drizzle Schema & 连接
│       ├── crypto.ts      # 服务端加密工具
│       └── index.ts       # API 入口
├── docker-compose.yml     # Docker 一键部署
├── Dockerfile             # 多阶段构建
├── server/.env.private    # 私有版环境变量模板
├── start.bat              # Windows 本地启动脚本
└── package.json           # 根目录启动脚本
```

---

## 🚀 部署指南

### 环境变量配置

所有部署方式都需要配置环境变量。

**Docker 部署**：在项目根目录创建 `.env` 文件：

```env
DB_PASSWORD=your_secure_password
DB_NAME=expense_pro
JWT_SECRET=change_me_to_a_secure_secret_key
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta

# 私有版功能开关（留空则不启用）
INVITE_CODE=
SERVER_AI_KEY=
ENCRYPTION_ENABLED=

# 代理（可选）
# HTTP_PROXY=http://host.docker.internal:7890
# HTTPS_PROXY=http://host.docker.internal:7890
```

**本地/手动部署**：参考 `server/.env.private` 模板，复制为 `server/.env` 并填入实际值。

---

### 方式一：Docker 部署（推荐）

> 适合服务器部署，一键启动应用和数据库。

#### 前置条件

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose

#### 启动

```bash
# 构建并启动（后台运行）
docker compose up -d --build
```

应用将在 `http://localhost:3001` 启动，数据库自动创建。

#### 常用命令

```bash
# 查看日志
docker compose logs -f app

# 停止服务
docker compose down

# 停止并清除数据（⚠️ 会删除数据库数据）
docker compose down -v
```

---

### 方式二：本地代码部署

> 适合开发调试或没有 Docker 的环境。

#### 前置条件

- [Node.js](https://nodejs.org/) v18+
- MySQL 8.0 数据库

#### 1. 安装 MySQL 并创建数据库

```sql
CREATE DATABASE expense_pro CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

#### 2. 配置环境变量

```bash
cp server/.env.private server/.env
# 编辑 server/.env，填入数据库密码等实际值
```

#### 3. 安装依赖

```bash
npm install
cd client && npm install
cd ../server && npm install
```

#### 4. 初始化数据库

```bash
cd server
npx drizzle-kit push
```

#### 5. 启动

```bash
# 方式 A：一键启动
npm start

# 方式 B：手动分别启动
cd server && npm run dev    # 后端 3001
cd client && npm run dev    # 前端 5173
```

访问 `http://localhost:5173`。

---

### 方式三：Docker + 域名 + Nginx 反向代理

> 适合服务器上已有其他 Docker 服务运行、需要通过域名访问的场景。

#### 整体架构

```
用户浏览器
  ↓ https://expense.yourdomain.com
Nginx（宿主机或 Docker 容器，监听 80/443）
  ↓ proxy_pass http://127.0.0.1:3001
ExpensePro Docker 容器（监听 3001）
  ↓
MySQL Docker 容器（3306 仅内部访问）
```

#### 步骤 1：启动 ExpensePro

```bash
cd ExpensePro
# 编辑 .env 后启动
docker compose up -d --build
```

此时 ExpensePro 在 `localhost:3001` 运行。

#### 步骤 2：配置 Nginx 反向代理

如果宿主机已安装 Nginx，在 `/etc/nginx/conf.d/` 创建配置：

```nginx
# /etc/nginx/conf.d/expense.conf
server {
    listen 80;
    server_name expense.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持（如未来需要）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # 上传图片较大，增加 body 限制
        client_max_body_size 20m;
    }
}
```

```bash
# 测试配置
sudo nginx -t
# 重载
sudo nginx -s reload
```

#### 步骤 3：DNS 解析

在域名服务商（如 Cloudflare、阿里云 DNS）添加 A 记录：

| 类型 | 名称 | 值 | TTL |
|------|------|-----|-----|
| A | expense | 你的服务器 IP | 自动 |

#### 步骤 4：HTTPS（推荐）

使用 Certbot 自动签发 Let's Encrypt 证书：

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 自动签发并配置 Nginx
sudo certbot --nginx -d expense.yourdomain.com

# 自动续期（每天检查）
sudo systemctl enable certbot.timer
```

完成后即可通过 `https://expense.yourdomain.com` 访问。

#### 如果 Nginx 也运行在 Docker 里

如果你的 Nginx 也是 Docker 容器（如 nginx-proxy 或 Traefik），需要让它和 ExpensePro 在同一个 Docker 网络：

```yaml
# docker-compose.yml 中添加
services:
  app:
    # ... 现有配置 ...
    networks:
      - nginx_network   # 加入 Nginx 所在网络
      - default

networks:
  nginx_network:
    external: true       # 引用已存在的 Nginx 网络
```

然后 Nginx 容器的反向代理配置中，用容器名（而非 `127.0.0.1`）：

```nginx
proxy_pass http://expensepro-app-1:3001;
```

---

## 📄 License

MIT

---

Made with ❤️ by Anchorite
