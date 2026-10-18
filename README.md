# FlowState — Typed Workflow Orchestration

> **FlowState at a glance:** A React/TypeScript workflow console backed by a TypeScript/tRPC API, Effect service layer, and PostgreSQL. Operators create workflows, launch executions, advance them through explicit states, and inspect auditable execution events.
>
> **Try it:** [Hosted frontend](https://flowstate-steel-psi.vercel.app) · [API health](https://flowstate-steel-psi.vercel.app/api/healthz) · [Frontend source](src/client/) · [Backend source](src/server/) · [Vercel handlers](api/)
>
> **Engineering highlights:** Shared TypeScript API types through tRPC; Zod request validation; Effect error modeling; optimistic, conditional state transitions; transactional event history; typed React dashboard; PostgreSQL persistence; Docker/Compose; and GitHub Actions.
>
> **Design decisions:** State transitions use a compare-and-swap update to reject stale concurrent writes. Domain changes and events are committed in one transaction. The Vercel deployment serves a static Vite frontend and TypeScript serverless API handlers from one origin.
>
> **Current boundaries:** No autonomous AI worker, LLM calls, tenant authorization, queue scheduling, real-time stream, or file processing is implemented. Use synthetic data only. A Vercel READY deployment is not proof of passing end-to-end tests.

[![CI](https://github.com/FarnazNK/FlowState/actions/workflows/ci.yml/badge.svg)](https://github.com/FarnazNK/FlowState/actions/workflows/ci.yml)

## Architecture

```text
Browser (React + Vite)
        |
        | type-safe tRPC client
        v
Vercel API (/trpc/* -> api/trpc.ts)
        |
        v
Zod validation + tRPC router
        |
        v
Effect TS service (typed failures, state machine)
        |
        v
PostgreSQL repository (parameterized SQL)
        |
        +--> workflows
        +--> runs
        +--> run_events (atomic with transitions)
```

**Core code:** [router](src/server/router.ts) · [service](src/server/service.ts) · [database repository](src/server/db.ts) · [state-machine tests](tests/state-machine.test.ts).

## Current behavior

1. Create a workflow.
2. Activate it.
3. Start an execution (initial state: `pending`).
4. Move through `running`, `approval`, `completed`, or `failed`, subject to transition rules.
5. Inspect persisted event history for each execution.

### Execution state machine

```text
pending -> running -> approval -> running
    \         |         |          |
     -> failed |         -> completed
               -> completed / failed
```

Completed and failed runs are terminal. Updates require the expected prior state, which prevents a stale client from silently overwriting another transition.

## Technology

| Layer | Stack |
|---|---|
| Frontend | React, TypeScript, Vite |
| API | tRPC, Zod, Node.js |
| Services | Effect TS |
| Database | PostgreSQL, pg |
| Hosting | Vercel frontend + serverless backend |
| Local infrastructure | Docker, Docker Compose |
| CI | GitHub Actions (build, tests, Docker image) |

## Local development

Requires Node.js 20+ and Docker Compose.

```bash
npm install
docker compose up -d db
cp .env.example .env
npm run dev
```

Frontend: http://localhost:5173 · API: http://localhost:3001 · Health: http://localhost:3001/healthz.

For a containerized frontend, API and database:

```bash
docker compose up --build
```

Open http://localhost:3001.

## Validation

```bash
npm run build
npm test
```

GitHub Actions runs these checks and builds the Docker image on pushes and pull requests. See [.github/workflows/ci.yml](.github/workflows/ci.yml). The existence of a workflow does not mean every run has passed.

## Deployment

A Vercel project is connected to this repository. Its Vite frontend and API handlers are hosted together under the same domain, with `vercel.json` rewriting `/trpc/:procedure` to the matching API handler. `DATABASE_URL` is configured as an encrypted server-side environment variable. The separate PostgreSQL schema is in [sql/schema.sql](sql/schema.sql).

Check the [frontend](https://flowstate-steel-psi.vercel.app), [health endpoint](https://flowstate-steel-psi.vercel.app/api/healthz), and [workflow query](https://flowstate-steel-psi.vercel.app/trpc/workflows) independently before considering the hosted system verified.

## Security and operational boundaries

This is an engineering prototype without login, multi-tenant isolation, secrets management per workflow, rate limiting, or full observability. Do not upload or process confidential or production data. Human approval here is an explicit execution state, **not** an authenticated approval system.

## Future engineering work

Durable background workers, task queues, idempotency keys, retry schedules, Effect dependency layers, authenticated approval policies, observability, AI-assisted workflow steps, and integration testing against ephemeral Postgres.
