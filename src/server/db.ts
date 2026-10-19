import pg from 'pg';
import { Context, Layer } from 'effect';
import { randomUUID } from 'node:crypto';
const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
export type Workflow = { id: string; name: string; status: 'draft'|'active'|'paused'; created_at: Date };
export type Run = { id: string; workflow_id: string; state: 'pending'|'running'|'approval'|'completed'|'failed'; created_at: Date; updated_at: Date };
export type RunEvent = { id: string; run_id: string; event_type: string; payload: Record<string, unknown>; created_at: Date };
export const repo = {
 list: async () => (await pool.query<Workflow>('SELECT * FROM workflows ORDER BY created_at DESC LIMIT 100')).rows,
 create: async (name: string): Promise<Workflow> => (await pool.query<Workflow>('INSERT INTO workflows(id,name) VALUES($1,$2) RETURNING *',[randomUUID(),name])).rows[0],
 get: async (id: string) => (await pool.query<Workflow>('SELECT * FROM workflows WHERE id=$1',[id])).rows[0],
 activate: async (id: string) => (await pool.query<Workflow>("UPDATE workflows SET status='active' WHERE id=$1 RETURNING *",[id])).rows[0],
 runs: async (workflowId: string) => (await pool.query<Run>('SELECT * FROM runs WHERE workflow_id=$1 ORDER BY created_at DESC LIMIT 100',[workflowId])).rows,
 events: async (runId: string) => (await pool.query<RunEvent>('SELECT * FROM run_events WHERE run_id=$1 ORDER BY id',[runId])).rows,
 createRun: async (workflowId: string): Promise<Run | undefined> => {
  const client = await pool.connect();
  try {
   await client.query('BEGIN');
   const item = (await client.query<Run>("INSERT INTO runs(id,workflow_id) SELECT $1,id FROM workflows WHERE id=$2 AND status='active' RETURNING *",[randomUUID(), workflowId])).rows[0];
   if(item) await client.query('INSERT INTO run_events(run_id,event_type) VALUES($1,$2)',[item.id,'run.created']);
   await client.query('COMMIT'); return item;
  } catch(error){await client.query('ROLLBACK');throw error} finally{client.release()}
 },
 transition: async (id: string, expected: Run['state'], next: Run['state']): Promise<Run | undefined> => {
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   const item=(await client.query<Run>('UPDATE runs SET state=$1,updated_at=now() WHERE id=$2 AND state=$3 RETURNING *',[next,id,expected])).rows[0];
   if(item)await client.query('INSERT INTO run_events(run_id,event_type,payload) VALUES($1,$2,$3)',[id,'run.transition',JSON.stringify({from:expected,to:next})]);
   await client.query('COMMIT');return item;
  }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
 },
 recordIntake: async (runId: string, result: Record<string, unknown>): Promise<Run | undefined> => {
  const client = await pool.connect();
  try {
   await client.query('BEGIN');
   const run = (await client.query<Run>(
    "UPDATE runs SET state='approval', updated_at=now() WHERE id=$1 AND state='running' RETURNING *",
    [runId]
   )).rows[0];
   if (run) await client.query(
    'INSERT INTO run_events(run_id,event_type,payload) VALUES($1,$2,$3::jsonb)',
    [runId,'intake.extracted',JSON.stringify(result)]
   );
   await client.query('COMMIT');
   return run;
  } catch (error) { await client.query('ROLLBACK'); throw error }
  finally { client.release() }
 }
};
export type WorkflowRepository = typeof repo;
export class Repository extends Context.Tag('FlowState/Repository')<Repository, WorkflowRepository>() {}
export const RepositoryLive = Layer.succeed(Repository, repo);
