# Expense Pro

一个基于 React + Node.js + MySQL 的个人记账应用，支持 AI 智能记账功能。

## 功能特性

- 用户注册登录
- 记账记录管理（收入/支出）
- AI 智能记账 - 通过 AI 自动识别和分类支出
- 数据统计与可视化

## 技术栈

- **前端**: React + TypeScript + Vite
- **后端**: Node.js + Express + TypeScript
- **数据库**: MySQL + Drizzle ORM
- **AI**: Google Gemini API

## 快速开始

### 1. 环境要求

- Node.js 18+
- MySQL 8.0+
- Docker (可选)

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置以下变量：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=expense_pro

# JWT 密钥 (生成命令: openssl rand -hex 64)
JWT_SECRET=your_jwt_secret

# AI 配置 (Google Gemini)
AI_API_KEY=your_gemini_api_key
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
```

### 3. 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装服务端依赖
cd server && npm install

# 安装客户端依赖
cd client && npm install
```

### 4. 数据库初始化

**MySQL 安装 (Ubuntu):**
```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
sudo mysql_secure_installation
```

**创建数据库:**
```bash
mysql -u root -p
CREATE DATABASE expense_pro;
```

**创建数据表:**
```bash
cd server
npx drizzle-kit push
```

### 5. 启动服务

**开发模式:**
```bash
# 启动后端 (端口 3001)
cd server && npm run dev

# 启动前端 (端口 5173)
cd client && npm run dev
```

**Docker 部署 (推荐):**
```bash
# 构建并启动所有服务
docker-compose up -d --build

# 首次运行后创建数据库表
docker exec expensepro-app-1 npx drizzle-kit push
```

访问 http://localhost

## 常用命令

```bash
# Docker
docker-compose up -d --build    # 构建并启动
docker-compose down             # 停止服务
docker-compose down -v         # 停止并删除数据

# 开发
cd server && npm run dev       # 启动后端
cd client && npm run dev        # 启动前端
```

## 代理配置

如果需要通过代理访问 AI API，在 `docker-compose.yml` 中已配置代理环境变量：
- `HTTP_PROXY`
- `HTTPS_PROXY`

如需修改端口，请编辑 `docker-compose.yml`。
