CREATE TABLE IF NOT EXISTS workflows (
 id UUID PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name))>0),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','paused')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS runs (
 id UUID PRIMARY KEY, workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','running','approval','completed','failed')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS runs_workflow_created_idx ON runs(workflow_id,created_at DESC);
CREATE TABLE IF NOT EXISTS run_events (
 id BIGSERIAL PRIMARY KEY, run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
 event_type TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS run_events_run_id_id_idx ON run_events(run_id, id);
