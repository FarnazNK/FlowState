# FlowState — Workflow Operations Console

[![Quality Gate](https://github.com/FarnazNK/FlowState/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/FarnazNK/FlowState/actions/workflows/ci.yml)
[![Vercel](https://img.shields.io/badge/hosting-Vercel-black?logo=vercel)](https://flowstate-steel-psi.vercel.app)

**Create workflows, run them, inspect every state change, and review extracted document fields in one operational workspace.**

[Open dashboard](https://flowstate-steel-psi.vercel.app) · [Source code](src/) · [API health](https://flowstate-steel-psi.vercel.app/api/healthz) · [CI runs](https://github.com/FarnazNK/FlowState/actions/workflows/ci.yml)

## What you can do

- **Explore immediately:** four sample workflows in the database, with queued, running, approval, and completed runs.
- **Run a workflow:** create and activate workflows, start executions, advance or fail runs, and inspect the timeline.
- **Review document intake:** paste synthetic document content into a running execution, request field extraction from a configured LLM, and inspect schema-validated results before marking the run complete.
- **Audit changes:** each accepted state transition produces an event in the same PostgreSQL transaction; stale concurrent transitions are rejected.

**Current scope:** The workflow state machine and audit events are operational features. AI extraction requires `OPENAI_API_KEY`; approvals are manual state changes rather than authenticated sign-off. Use sample data, not sensitive documents.

## Architecture

```text
React/Vite dashboard
   |
   v
Type-safe tRPC API + Zod schemas (Vercel serverless)
   |
   v
Effect Context / Layer services
   |                         \
   v                          v
PostgreSQL repository       LLM intake provider (optional)
   |                          |
   +---- atomic run events <--+-- schema-validated extraction
```

The [repository](src/server/db.ts) uses parameterized queries, transactions, and compare-and-swap state updates. The [service](src/server/service.ts) wires Effect services using `Context.Tag` and `Layer`, with typed failures. The [intake module](src/server/intake.ts) validates the model's JSON using Zod before storing it. The [frontend](src/client/main.tsx) displays workflows, runs, and event details with explicit loading and error states.

## Run locally

Requires Node.js 20+ and Docker.

```bash
npm install
docker compose up -d db
cp .env.example .env
npm run dev
```


To enable real document extraction, add `OPENAI_API_KEY` to your local `.env`, or to Vercel as a **server-only** secret. `OPENAI_MODEL` is optional; its default is `gpt-4o-mini`. Without a key, workflow operations still work, but AI extraction returns a clear configuration error.

## Build, tests, and deployment

```bash
npm run build
npm test
docker compose up --build
```

The [GitHub Actions quality gate](.github/workflows/ci.yml) runs the TypeScript/Vite build, tests, and Docker build. The badge above reflects the actual workflow status rather than a hardcoded claim. Vercel serves both the frontend and the serverless tRPC handlers from the same origin. The database schema is in [sql/schema.sql](sql/schema.sql).

## Roadmap

Authenticated approval policies, durable worker queues, retry scheduling, rate limits, better operational metrics, and end-to-end browser tests. The current build is a workflow console, not an autonomous workflow engine.
