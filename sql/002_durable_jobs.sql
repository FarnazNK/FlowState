-- Apply after sql/schema.sql. PostgreSQL is the only required queue infrastructure.
CREATE TABLE IF NOT EXISTS workflow_jobs (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('start_run')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed')),
  attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INT NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  leased_until TIMESTAMPTZ,
  lease_token UUID,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS workflow_jobs_ready_idx
  ON workflow_jobs (available_at, created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS workflow_jobs_expired_idx
  ON workflow_jobs (leased_until) WHERE status = 'running';
CREATE UNIQUE INDEX IF NOT EXISTS workflow_jobs_run_kind_unique
  ON workflow_jobs(run_id,kind);
