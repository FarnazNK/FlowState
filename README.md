# FlowState

A full-stack workflow operations system built with TypeScript, React, tRPC, Effect TS, and PostgreSQL.

## Current functionality

Create workflows, launch runs, change run state through a validated state machine, and inspect PostgreSQL-backed event history. Each transition and its event are persisted atomically. A public, unauthenticated instance must use only synthetic data.

## Architecture

React/Vite → typed tRPC client → Zod-validated tRPC router → Effect service → parameterized SQL and PostgreSQL transactions.

The core includes typed errors, explicit transition rules, execution history and a database readiness endpoint. **LLM-driven steps, queue workers, tenant authentication, and realtime streaming are not yet implemented.** This README intentionally distinguishes implemented functionality from proposed extensions.

## Local development

```sh
npm install
docker compose up -d db
cp .env.example .env
npm run dev
```

Open http://localhost:5173. The API runs on port 3001.

## Containerized application

```sh
docker compose up --build
```

Open http://localhost:3001.

## Verification

```sh
npm run build
npm test
```

## Deployment

The `api/` folder contains Vercel serverless tRPC and readiness routes. Vercel builds the Vite frontend and serves its API separately under the same origin. Set `DATABASE_URL` as a server-side project secret and apply `sql/schema.sql` before use. Never put database credentials in `VITE_*` variables.

## Security boundary

This is a functional engineering prototype, not a multi-tenant product. It has no authentication or authorization, so it must not receive sensitive information or be presented as production-safe.
