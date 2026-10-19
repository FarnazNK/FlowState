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

**Current scope:** The workflow state machine and audit events are operational features. AI extraction requires `OPENAI_API_KEY`; approvals are manual state changes rather than authenticated sign-off.

## Technology stack

### Frontend

![React](https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![tRPC client](https://img.shields.io/badge/tRPC-Client-2596BE)

### Backend & database

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![tRPC API](https://img.shields.io/badge/tRPC-API-2596BE)
![Effect TS](https://img.shields.io/badge/Effect-TS-6E4AFF)
![Zod](https://img.shields.io/badge/Zod-Validation-3E67B1)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Functions-000000?logo=vercel)

### AI, testing & delivery

![OpenAI](https://img.shields.io/badge/OpenAI-Optional-412991?logo=openai&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-Tests-6E9F18?logo=vitest)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-CI-2088FF?logo=github-actions&logoColor=white)
[![FlowState CI](https://github.com/FarnazNK/FlowState/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/FarnazNK/FlowState/actions/workflows/ci.yml)

## Architecture

```mermaid
flowchart LR
  UI["React / Vite Dashboard"] --> CLIENT["tRPC Client"]
  CLIENT --> API["Vercel API / Zod"]
  API --> SERVICE["Effect Services and Layers"]
  SERVICE --> DB[("PostgreSQL")]
  SERVICE --> MODEL["Optional AI Intake"]
  MODEL --> SERVICE
```

### Workflow state machine

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> running
  pending --> failed
  running --> approval
  running --> completed
  running --> failed
  approval --> running
  approval --> completed
  approval --> failed
  completed --> [*]
  failed --> [*]
```

### AI intake flow

```mermaid
sequenceDiagram
  participant U as User
  participant UI as React Dashboard
  participant API as tRPC API
  participant S as Effect Service
  participant L as LLM
  participant DB as PostgreSQL
  U->>UI: Submit synthetic document
  UI->>API: Typed intake request
  API->>S: Validate input
  S->>L: Extract fields
  L-->>S: Structured JSON
  Note over S: Zod validates model output
  S->>DB: Commit extraction event and approval state
  S-->>UI: Updated run and extracted fields
```

## Run locally

Requires Node.js 20+ and Docker.

```bash
npm install
docker compose up -d db
cp .env.example .env
npm run dev
```

To enable real document extraction, add `OPENAI_API_KEY` to your local `.env`, or to Vercel as a **server-only** secret. `OPENAI_MODEL` is optional; its default is `gpt-4o-mini`. Without a key, workflow and audit features still work.

## Build, tests, and deployment

```bash
npm run build
npm test
docker compose up --build
```

The [GitHub Actions quality gate](.github/workflows/ci.yml) runs the TypeScript/Vite build, tests, and Docker build. The badge above reflects the actual workflow status rather than a hardcoded claim.

## Roadmap

Authenticated approval policies, durable worker queues, retry scheduling, rate limits, better operational metrics, and end-to-end browser tests. The current build is a workflow console, not an autonomous agent.
