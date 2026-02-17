# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ExpensePro is a full-stack AI-powered personal expense tracker with receipt image recognition via Google Gemini. It supports both open-source and private deployment modes with optional E2E encryption.

## Common Commands

### Development
```bash
# Install all dependencies
npm install
cd client && npm install
cd ../server && npm install

# Start both server (3001) and client (5173) concurrently
npm start

# Or run separately
cd server && npm run dev    # Express backend on port 3001
cd client && npm run dev    # Vite frontend on port 5173

# Lint (client only)
cd client && npm run lint

# Build for production
cd client && npm run build
cd server && npx tsc
```

### Database
```bash
# Push schema to database (run after first setup or schema changes)
cd server && npx drizzle-kit push
```

### Docker
```bash
# Build and start containers
docker compose up -d --build

# Initialize database (required on first run)
docker compose exec app npx drizzle-kit push

# View logs
docker compose logs -f app
```

## Architecture

### Tech Stack
- **Frontend**: React 19 + Vite 7 + TypeScript + Recharts
- **Backend**: Node.js + Express 5 + Drizzle ORM
- **Database**: MySQL 8.0
- **AI**: Google Gemini API (2.0 Flash / 2.5 Flash)

### Project Structure
```
ExpensePro/
├── client/src/
│   ├── components/      # React components (TransactionsPage, TrendsPage, AiReceiptParser, etc.)
│   ├── context/         # AuthContext (JWT + E2E encryption state)
│   ├── utils/crypto.ts # Client-side encryption utilities
│   ├── App.tsx          # Main application with routing
│   └── App.css         # Global styles
├── server/src/
│   ├── db/schema.ts    # Drizzle ORM schema (users, expenses, userSettings)
│   ├── db/index.ts     # Database connection
│   ├── crypto.ts       # Server-side encryption utilities
│   └── index.ts        # Express API routes + static file serving
├── docker-compose.yml  # Docker deployment config
└── .env.example        # Environment variables template
```

### API Endpoints (server/src/index.ts:46-509)
- `/api/auth/*` - Authentication (register, login, config)
- `/api/settings` - User settings CRUD
- `/api/expenses` - Expense CRUD operations
- `/api/ai/parse-receipt` - Gemini AI receipt recognition
- SPA fallback: All non-API routes serve React index.html

### Data Model
- **users**: id, username, password (bcrypt hashed), createdAt
- **expenses**: id, title, amount, category, note, date, userId
- **userSettings**: id, userId, aiApiKey, aiModel, currency, categories, budgetConfig, encryptedMasterKey, masterKeySalt

### Deployment Modes (controlled by .env)
| Variable | Open Source (default) | Private |
|----------|---------------------|---------|
| INVITE_CODE | empty (open registration) | invite code required |
| SERVER_AI_KEY | empty (user provides key) | server-managed |
| ENCRYPTION_ENABLED | empty (no E2E) | true enables client-side encryption |

### E2E Encryption Flow
When enabled, `title`, `category`, and `note` fields are encrypted in the browser before transmission. Server stores encrypted data but cannot decrypt. `amount` and `date` remain unencrypted for sorting/filtering.

### Key Files for Context
- `server/src/index.ts:1-509` - All backend logic (auth, CRUD, AI)
- `client/src/App.tsx:1-737` - Main frontend with dashboard, forms, settings
- `client/src/context/AuthContext.tsx` - Authentication state and master key handling
- `client/src/utils/crypto.ts` - Client-side AES-GCM encryption
- `server/src/crypto.ts` - Server-side encryption utilities for Master Key management

## Git Workflow

The AGENTS.md file in root contains OpenCode-specific rules:
- Auto-commit after modifications
- Clone to `D:\Code\gitclone\` directory
- Web search priorities: Exa for general/code, Context7 for official docs, Browser for interactive tasks
