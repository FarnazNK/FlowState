## Free all-in-one local setup (recommended)

This Docker Compose configuration runs PostgreSQL, the Node API/SSE server, and the background worker on your computer. No external hosting or paid queue is necessary.

```bash
cp .env.example .env
# Edit .env and set BOTH:
# FLOWSTATE_API_TOKEN=$(openssl rand -hex 32)
# FLOWSTATE_DB_PASSWORD=$(openssl rand -hex 24)
docker compose up --build -d
```

Open http://localhost:3001 and enter the operator token from your local `.env` file. No token is committed to the repository. The HTTP port binds to 127.0.0.1 only. The DB and worker have no public ports.

**Important for existing PostgreSQL volumes:** files in `docker-entrypoint-initdb.d` execute only on a brand-new database. Apply `sql/002_durable_jobs.sql` manually to existing data, for example using `docker compose exec -T db psql -U flowstate -d flowstate < sql/002_durable_jobs.sql`, before starting the worker. Never run `docker compose down -v` unless you intend to destroy your data.

**Free means locally hosted:** your computer must remain powered on, and optional calls to OpenAI are not free. This is not a public secure production deployment.

# Durable execution and secure events (free local deployment)

No Redis, paid queue, paid worker host, or paid AI API is required for **start_run** jobs.
Uses PostgreSQL (already part of the project) and a standalone Node worker.

## Start locally
1. For manual development, start PostgreSQL with `docker compose up -d db` after setting the required Docker Compose environment variables.
2. Apply `sql/schema.sql` for a fresh DB, then `sql/002_durable_jobs.sql`.
3. Set `FLOWSTATE_API_TOKEN` to a randomly generated 32-byte secret (e.g. `openssl rand -hex 32`) in your server environment. Run `npm run dev` and, in another terminal, `npm run worker`. Enter the operator token in the dashboard access screen.
4. Create/activate a workflow and start a run. The worker advances pending -> running, recording an event transactionally.

## Guarantees
Jobs persist across API and worker restarts. Claims use SKIP LOCKED, limited 60-second leases,
20-second renewals, fencing by lease token, bounded exponential retries, and atomic state+event
updates. The worker is idempotent for pending -> running. Jobs are **at least once**, not
exactly once for arbitrary external APIs. Never introduce side effects without idempotency keys.

## Security boundaries
- tRPC is protected with a mandatory shared operator token on the Node and Vercel handlers. This is **single-operator access**, not user accounts, tenant-scoped authorization or production IAM.
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

Set a long random `FLOWSTATE_API_TOKEN` environment variable on the **server only**.
Do not commit it or place it in frontend bundles. The endpoint is disabled if unset.

Example (use your own random secret):

```bash
export FLOWSTATE_API_TOKEN="$(openssl rand -hex 32)"
npm run start
curl -N -H "Authorization: Bearer $FLOWSTATE_API_TOKEN" \
  "http://localhost:3001/api/runs/YOUR-RUN-UUID/events/stream?after=0"
```

Only event metadata is streamed (not extracted document bodies). Maximum 20 simultaneous
streams per Node process. Supports `Last-Event-ID` or `after` cursor for replay,
and sends a heartbeat when idle. The React dashboard now uses an authenticated streaming fetch and refreshes the selected run on events when using the standalone Node server. Never transmit bearer tokens over plain HTTP on
an untrusted network; localhost is suitable for development. This operator token is
**not user authentication or per-workflow authorization** and must not be baked into
frontend builds. The dashboard requests it at runtime and keeps it only in memory for the tab session. Treat it as a privileged operator secret.

## Limitations for production security

The tRPC endpoints require the shared operator token but still lack individual
user identities and tenant-level authorization. Never use this demo with confidential documents. Add account identities, access control
on each workflow/run, origin/CSRF protections, request/body quotas, abuse controls,
and credential rotation. The preview branch should remain unmerged until a
security review is complete.

## Hosting caveats
The Vercel frontend/API does not implement the Node server's SSE route or run a background worker. For both durable execution and browser streaming, use the standalone Node server and worker locally. All features work without hosting charges on your own machine, but your computer must remain on. Running OpenAI intake is optional and can incur provider charges.
