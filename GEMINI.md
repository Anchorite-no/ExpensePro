# GEMINI.md - ExpensePro Project Context

This file provides essential context and instructions for AI agents working on the ExpensePro project.

## Project Overview
ExpensePro is a full-stack, AI-powered personal expense tracker. It specializes in intelligent receipt recognition using Google Gemini and emphasizes privacy with optional End-to-End (E2E) encryption.

### Key Technologies
- **Frontend**: React 19, Vite 7, TypeScript, Recharts (for data visualization).
- **Backend**: Node.js, Express 5, Drizzle ORM (MySQL).
- **AI**: Google Gemini API (supporting 1.5/2.0 Flash models).
- **Database**: MySQL 8.0.
- **Tools**: Docker & Docker Compose, ESLint, TypeScript.

## Project Structure
```
ExpensePro/
├── client/                # Vite + React Frontend
│   ├── src/
│   │   ├── api/           # API client definitions
│   │   ├── components/    # UI Components (AiReceiptParser, AuthForm, etc.)
│   │   ├── context/       # AuthContext (Handles JWT and Master Key for E2E)
│   │   ├── hooks/         # Custom React hooks (useData)
│   │   ├── utils/         # Crypto and helper utilities
│   │   └── App.tsx        # Main application entry and routing
├── server/                # Express Backend
│   ├── src/
│   │   ├── db/            # Drizzle schema and database connection
│   │   ├── middleware/    # Auth and other middlewares
│   │   ├── routes/        # Modular API routes (ai, auth, expenses, settings)
│   │   ├── utils/         # AI helpers and crypto logic
│   │   └── index.ts       # Express server entry point
├── docker-compose.yml     # Docker orchestration
└── .env.example           # Environment variables template
```

## Setup and Commands

### Prerequisites
- Node.js v18+
- MySQL 8.0
- Google Gemini API Key

### Initial Setup
1. Install dependencies in root, client, and server:
   ```bash
   npm install
   cd client && npm install
   cd ../server && npm install
   ```
2. Configure environment variables in `server/.env` based on `.env.example`.
3. Initialize the database schema:
   ```bash
   cd server
   npx drizzle-kit push
   ```

### Development
- **Run both client and server**: `npm start` (from root)
- **Run Client separately**: `cd client && npm run dev` (Default: port 5173)
- **Run Server separately**: `cd server && npm run dev` (Default: port 3001)

### Production / Docker
- **Build and Start**: `docker compose up -d --build`
- **Initialize DB in Docker**: `docker compose exec app npx drizzle-kit push`

## Core Features & Logic

### AI Receipt Parsing
- **Route**: `POST /api/ai/parse-receipt`
- **Logic**: Sends image data (base64) to Gemini API with a specific prompt to extract structured JSON (merchant, amount, category, date, note).
- **Key Files**: `server/src/routes/ai.ts`, `server/src/utils/ai-helper.ts`.

### End-to-End (E2E) Encryption
- **Toggle**: Enabled via `ENCRYPTION_ENABLED=true` in `.env`.
- **Logic**: 
  - `title`, `category`, and `note` are encrypted in the browser using AES-GCM.
  - A `Master Key` is derived from the user's password and stored (encrypted) in the database.
  - The server only stores ciphertexts for these fields.
  - `amount` and `date` remain unencrypted to support server-side aggregation and sorting.
- **Key Files**: `client/src/utils/crypto.ts`, `client/src/context/AuthContext.tsx`.

### Deployment Modes
- **Open Source**: `INVITE_CODE` is empty; users provide their own Gemini API keys.
- **Private**: `INVITE_CODE` set; server uses `SERVER_AI_KEY` globally.

## Development Conventions
- **API Paths**: Always prefixed with `/api/`.
- **Routing**: Client-side routing with React. Server serves `index.html` for non-API routes.
- **Types**: Maintain strictly typed interfaces in `client/src/types/index.ts` and `server/src/db/schema.ts`.
- **Styling**: Vanilla CSS (modularized per component).
- **Commits**: Follow standard git practices as outlined in `AGENTS.md`.

## AI Instructions
- When adding features, ensure they respect the `ENCRYPTION_ENABLED` state.
- When modifying the database schema, update `server/src/db/schema.ts` and run `drizzle-kit push`.
- Always check `.env.example` before introducing new configuration requirements.
- Use `npm run lint` in `client` to maintain code quality.
