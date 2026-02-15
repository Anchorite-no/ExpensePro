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
│       ├── context/       # Auth Context
│       ├── App.tsx        # 主应用
│       └── App.css        # 全局样式
├── server/                # Express 后端
│   └── src/
│       ├── db/            # Drizzle Schema & 连接
│       └── index.ts       # API 入口
├── docker-compose.yml     # Docker 一键部署
├── Dockerfile             # 多阶段构建
├── .env.example           # 环境变量模板
├── start.bat              # Windows 本地启动脚本
└── package.json           # 根目录启动脚本
```

---

## 🚀 部署指南

### 环境变量配置

无论哪种部署方式，都需要先配置环境变量。复制模板并编辑：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 数据库密码（请修改为强密码）
DB_PASSWORD=your_secure_password
DB_NAME=expense_pro

# JWT 密钥（建议随机生成：openssl rand -hex 64）
JWT_SECRET=change_me_to_a_secure_secret_key

# Gemini API 地址
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta

# 网络代理（可选，服务器无法直连 Google API 时配置）
# Docker 中 host.docker.internal 指向宿主机
# HTTP_PROXY=http://host.docker.internal:7890
# HTTPS_PROXY=http://host.docker.internal:7890

NODE_ENV=production
```

> **关于 Gemini API Key**：API Key 不在服务端配置，而是通过前端 UI 设置并保存在浏览器本地。首次使用时打开 Dashboard → AI 智能记账 → 点击 ⚙️ 图标输入你的 Key。

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

应用将在 `http://localhost:80` 启动，数据库自动创建并配置完毕。

#### 常用命令

```bash
# 查看日志
docker compose logs -f app

# 停止服务
docker compose down

# 停止并清除数据（⚠️ 会删除数据库数据）
docker compose down -v
```

#### 网络代理说明

如果你的服务器需要代理才能访问 Google Gemini API，在 `.env` 中取消注释并配置代理地址：

```env
HTTP_PROXY=http://host.docker.internal:7890
HTTPS_PROXY=http://host.docker.internal:7890
```

`host.docker.internal` 会自动映射到宿主机 IP，端口请根据你的代理软件实际配置修改。

---

### 方式二：本地代码部署

> 适合开发调试或没有 Docker 的环境。

#### 前置条件

- [Node.js](https://nodejs.org/) v18+
- MySQL 8.0 数据库

#### 1. 安装 MySQL 并创建数据库

如果你还没有 MySQL，可以参考以下方式安装：

- **Windows**: [MySQL Installer](https://dev.mysql.com/downloads/installer/)
- **macOS**: `brew install mysql`
- **Ubuntu/Debian**: `sudo apt install mysql-server`

安装完成后创建数据库：

```sql
CREATE DATABASE expense_pro CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

#### 2. 配置数据库连接

在 `server/` 目录下创建 `.env` 文件：

```env
DATABASE_URL="mysql://root:你的数据库密码@localhost:3306/expense_pro"
PORT=3001
```

> **连接格式说明**：`mysql://用户名:密码@主机地址:端口/数据库名`
> 
> 如果 MySQL 运行在其他主机或端口，请相应修改。例如：
> - 远程数据库：`mysql://user:pass@192.168.1.100:3306/expense_pro`
> - 自定义端口：`mysql://root:pass@localhost:3307/expense_pro`

#### 3. 安装依赖

```bash
# 安装根目录依赖（启动脚本）
npm install

# 安装前端依赖
cd client
npm install

# 安装后端依赖
cd ../server
npm install
```

#### 4. 初始化数据库表结构

```bash
cd server
npx drizzle-kit push
```

此命令会根据 Drizzle Schema 自动创建所有需要的表。

#### 5. 启动项目

**方式 A：一键启动（Windows）**

直接双击根目录的 `start.bat`，或在根目录执行：

```bash
npm start
```

**方式 B：手动分别启动**

```bash
# 终端 1：启动后端 (端口 3001)
cd server
npm run dev

# 终端 2：启动前端 (端口 5173)
cd client
npm run dev
```

访问 `http://localhost:5173` 即可使用。前端已配置 Vite 反向代理，所有 `/api` 请求会自动转发到后端。

---

## 📄 License

MIT

---

Made with ❤️ by Anchorite
