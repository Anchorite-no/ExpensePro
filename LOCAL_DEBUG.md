# Local Debug Setup

This project can be debugged locally without Docker.

## 1. Server env

Create `server/.env` from `server/.env.example` and set your local MySQL URL:

```env
DATABASE_URL="mysql://root:your_password@localhost:3306/expense_pro"
PORT=3001
NODE_ENV=development
JWT_SECRET=expensepro-local-dev-secret-change-me
TRUST_PROXY=false
INVITE_CODE=
SERVER_AI_KEY=
ENCRYPTION_ENABLED=true
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
```

Notes:

- `ENCRYPTION_ENABLED=true` enables the same E2E login flow as production.
- `TRUST_PROXY=false` is the safest setting for local direct access.
- Leave `SERVER_AI_KEY` empty if you want to test user-provided AI keys.

## 2. Install dependencies

```bash
npm install
cd client && npm install
cd ../server && npm install
```

## 3. Push schema to local MySQL

From the project root:

```bash
npm run db:push
```

## 4. Start locally

From the project root:

```bash
npm run dev
```

Or start each side separately:

```bash
npm run dev:server
npm run dev:client
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:3001`

## 5. Verify encryption is on

Open:

```text
http://localhost:3001/api/auth/config
```

You should see:

```json
{
  "requireInvite": false,
  "encryption": true
}
```
