# ExpensePro 💰

A modern full-stack personal expense tracker with AI-powered receipt recognition using Google Gemini.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/frontend-React_19_%2B_Vite-61DAFB.svg)
![Backend](https://img.shields.io/badge/backend-Express_%2B_Drizzle-green.svg)
![AI](https://img.shields.io/badge/AI-Google_Gemini-8E75B2.svg)

## Features

- **AI Receipt Scanning**: Upload or paste receipt images, Google Gemini automatically extracts merchant, amount, date, and category
- **Interactive Dashboard**: Real-time expense overview with trend charts and category breakdown
- **Dark/Light Theme**: Built-in theme switching
- **Responsive Design**: Works on desktop and mobile

## Tech Stack

- **Frontend**: React 19 + Vite 7 + TypeScript + Recharts
- **Backend**: Express.js + Drizzle ORM
- **Database**: MySQL 8.0
- **AI**: Google Gemini API

## Quick Start

### Prerequisites

- Node.js (v18+)
- MySQL 8.0
- Google Gemini API Key

### Configuration

```bash
cp .env.example .env
```

Edit `.env`:

```env
DB_PASSWORD=your_db_password
DB_NAME=expense_pro
JWT_SECRET=your_jwt_secret
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
```

### Docker (Recommended)

```bash
docker-compose up -d --build
docker exec expensepro-app-1 npx drizzle-kit push
```

Visit **http://localhost**

### Local Development

```bash
# Install dependencies
cd client && npm install
cd ../server && npm install

# Initialize database
cd server && npx drizzle-kit push

# Start servers (双击 start.bat 或手动启动)
cd server && npm run dev    # Backend :3001
cd client && npm run dev    # Frontend :5173
```

Visit **http://localhost:5173**

## License

MIT
