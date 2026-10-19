# Durable execution and secure events (free local deployment)

No Redis, paid queue, paid worker host, or paid AI API is required for **start_run** jobs.
Uses PostgreSQL (already part of the project) and a standalone Node worker.

## Start locally
1. Start PostgreSQL with `docker compose up -d db`.
2. Apply `sql/schema.sql` for a fresh DB, then `sql/002_durable_jobs.sql`.
3. Run `npm run dev` and, in another terminal, `npm run worker`.
4. Create/activate a workflow and start a run. The worker advances pending -> running, recording an event transactionally.

## Guarantees
Jobs persist across API and worker restarts. Claims use SKIP LOCKED, limited 60-second leases,
20-second renewals, fencing by lease token, bounded exponential retries, and atomic state+event
updates. The worker is idempotent for pending -> running. Jobs are **at least once**, not
exactly once for arbitrary external APIs. Never introduce side effects without idempotency keys.

## Security boundaries
- Do not expose a public production instance: **existing tRPC APIs are unauthenticated**.
- Never submit sensitive documents to a public demo.
- Never store API keys in the client or job payloads; use server-side environment variables.
- Do not expose Postgres or the worker to the public internet.
- A secure authenticated event endpoint is needed before browser streaming in production.
- SSE event data needs authorization, scope checks, connection limits and replay controls.
- Vercel functions cannot provide an always-on background worker; run it locally for free,
  or on a self-hosted machine. Third-party free hosting is not guaranteed.

This branch implements durable start-run jobs only, not a generic durable AI-agent runtime.
The optional OpenAI intake endpoint remains synchronous and requires a provider key.
