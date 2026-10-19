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

## Operator-only SSE (standalone Node server)

Set a long random `FLOWSTATE_STREAM_TOKEN` environment variable on the **server only**.
Do not commit it or place it in frontend bundles. The endpoint is disabled if unset.

Example (use your own random secret):

```bash
export FLOWSTATE_STREAM_TOKEN="$(openssl rand -hex 32)"
npm run start
curl -N -H "Authorization: Bearer $FLOWSTATE_STREAM_TOKEN" \
  "http://localhost:3001/api/runs/YOUR-RUN-UUID/events/stream?after=0"
```

Only event metadata is streamed (not extracted document bodies). Maximum 20 simultaneous
streams per Node process. Supports `Last-Event-ID` or `after` cursor for replay,
and sends a heartbeat when idle. Never transmit bearer tokens over plain HTTP on
an untrusted network; localhost is suitable for development. This operator token is
**not user authentication or per-workflow authorization** and must not be copied into
browser JavaScript. The dashboard is not yet connected to SSE.

## Limitations for production security

The existing public Vercel tRPC endpoint does not implement authentication or
tenant-level authorization. Existing creation, transitions and intake must be protected
before processing user/company documents. Add account identities, access control
on each workflow/run, origin/CSRF protections, request/body quotas, abuse controls,
and credential rotation. The preview branch should remain unmerged until a
security review is complete.
