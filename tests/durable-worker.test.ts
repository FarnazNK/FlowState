import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import {pool, repo} from '../src/server/db.js';
import {claimJob,finishJob} from '../src/server/jobs.js';

const suite=process.env.DATABASE_URL?describe:describe.skip;
suite('PostgreSQL durable workflow jobs',()=>{
 let workflowId='';
 beforeAll(async()=>{
  await pool.query(await readFile('sql/schema.sql','utf8'));
  await pool.query(await readFile('sql/002_durable_jobs.sql','utf8'));
 });
 afterAll(async()=>{
  if(workflowId)await pool.query('DELETE FROM workflows WHERE id=$1',[workflowId]);
  await pool.end();
 });
 it('atomically schedules a job and advances a run exactly once',async()=>{
  const wf=await repo.create('CI durable-worker integration');
  workflowId=wf.id;
  await repo.activate(wf.id);
  const run=await repo.createRun(wf.id);
  expect(run).toBeDefined();
  const queued=await pool.query('SELECT status FROM workflow_jobs WHERE run_id=$1',[run!.id]);
  expect(queued.rows).toHaveLength(1);
  expect(queued.rows[0].status).toBe('queued');
  const job=await claimJob();
  expect(job?.run_id).toBe(run!.id);
  expect(await finishJob(job!)).toBe(true);
  expect(await finishJob(job!)).toBe(false);
  const updated=await pool.query('SELECT state FROM runs WHERE id=$1',[run!.id]);
  expect(updated.rows[0].state).toBe('running');
  const events=await pool.query("SELECT count(*)::int AS n FROM run_events WHERE run_id=$1 AND event_type='run.transition'",[run!.id]);
  expect(events.rows[0].n).toBe(1);
 });
});
