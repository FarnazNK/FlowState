// Read-only PostgreSQL benchmark. Never write or seed production data.
import 'dotenv/config';
import { Pool } from 'pg';
import { performance } from 'node:perf_hooks';

const iterations = Math.min(2000, Math.max(10, Number(process.env.BENCH_SAMPLES || 100)));
const concurrency = Math.min(16, Math.max(1, Number(process.env.BENCH_CONCURRENCY || 4)));
const warmup = 10;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: concurrency, connectionTimeoutMillis: 10000 });
const percentile = (numbers, pct) => numbers[Math.min(numbers.length - 1, Math.ceil(numbers.length * pct) - 1)];
async function main() {
 const counts = await pool.query("SELECT (SELECT COUNT(*) FROM workflows)::int AS workflows, (SELECT COUNT(*) FROM runs)::int AS runs, (SELECT COUNT(*) FROM run_events)::int AS events");
 const workflowId = (await pool.query('SELECT id FROM workflows ORDER BY created_at DESC LIMIT 1')).rows[0]?.id;
 const runId = (await pool.query('SELECT id FROM runs ORDER BY created_at DESC LIMIT 1')).rows[0]?.id;
 const queries = [
  ['workflow_page', 'SELECT id,name,status,created_at FROM workflows ORDER BY created_at DESC,id DESC LIMIT 26', []],
  ['workflow_search', "SELECT id,name,status,created_at FROM workflows WHERE to_tsvector('simple',name) @@ plainto_tsquery('simple',$1) ORDER BY created_at DESC,id DESC LIMIT 26", ['workflow']],
  ['run_page', 'SELECT id,workflow_id,state,created_at,updated_at FROM runs WHERE workflow_id=$1 ORDER BY created_at DESC,id DESC LIMIT 26', [workflowId]],
  ['event_page', 'SELECT id,run_id,event_type,payload,created_at FROM run_events WHERE run_id=$1 ORDER BY id DESC LIMIT 50', [runId]],
  ['health_probe', 'SELECT 1', []]
 ].filter(([name]) => (name !== 'run_page' || workflowId) && (name !== 'event_page' || runId));
 const results = [];
 for(const [name, sql, params] of queries) {
  for(let i=0;i<warmup;i++) await pool.query(sql,params);
  const samples = [];
  let index=0; const started=performance.now();
  await Promise.all(Array.from({length: concurrency},async()=>{
   while(index<iterations){index++;const t=performance.now();await pool.query(sql,params);samples.push(performance.now()-t)}
  }));
  const duration = (performance.now()-started)/1000;
  samples.sort((a,b)=>a-b);
  results.push({name,samples:samples.length,concurrency,p50_ms:+percentile(samples,0.5).toFixed(2),p95_ms:+percentile(samples,0.95).toFixed(2),p99_ms:+percentile(samples,0.99).toFixed(2),max_ms:+samples.at(-1).toFixed(2),throughput_rps:+(samples.length/duration).toFixed(2)});
 }
 process.stdout.write(JSON.stringify({timestamp:new Date().toISOString(),kind:'read_only_database_round_trip',dataset:counts.rows[0],results},null,2)+'\n');
} 
try { await main() } finally { await pool.end() }
