import { randomUUID } from 'node:crypto';
import { pool } from './db.js';

export type Job = {id:string;run_id:string;kind:'start_run';attempts:number;max_attempts:number;lease_token:string};
export async function claimJob():Promise<Job|undefined>{
 const token=randomUUID();
 const {rows}=await pool.query<Job>(`
 WITH candidate AS (
  SELECT id FROM workflow_jobs
  WHERE (status='queued' AND available_at<=now())
     OR (status='running' AND leased_until<now())
  ORDER BY available_at,created_at
  FOR UPDATE SKIP LOCKED LIMIT 1
 )
 UPDATE workflow_jobs j
 SET status='running', attempts=j.attempts+1, lease_token=$1::uuid,
     leased_until=now()+interval '60 seconds'
 FROM candidate WHERE j.id=candidate.id
 RETURNING j.id,j.run_id,j.kind,j.attempts,j.max_attempts,j.lease_token
 `,[token]);
 return rows[0];
}
export async function renewLease(job:Job):Promise<boolean>{
 const r=await pool.query(`UPDATE workflow_jobs SET leased_until=now()+interval '60 seconds'
 WHERE id=$1 AND lease_token=$2 AND status='running' AND leased_until>now()`,[job.id,job.lease_token]);
 return r.rowCount===1;
}
export async function finishJob(job:Job):Promise<boolean>{
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const owner=await client.query(`SELECT id FROM workflow_jobs
   WHERE id=$1 AND lease_token=$2 AND status='running' AND leased_until>now()
   FOR UPDATE`,[job.id,job.lease_token]);
  if(!owner.rowCount){await client.query('ROLLBACK');return false;}
  // Idempotent after a crash: only a pending run can be advanced.
  const advanced=await client.query(`UPDATE runs SET state='running',updated_at=now()
   WHERE id=$1 AND state='pending' RETURNING id`,[job.run_id]);
  if(advanced.rowCount)await client.query(`INSERT INTO run_events(run_id,event_type,payload)
    VALUES($1,'run.transition',$2::jsonb)`,[job.run_id,JSON.stringify({from:'pending',to:'running',source:'worker'})]);
  await client.query(`UPDATE workflow_jobs SET status='completed',leased_until=NULL,lease_token=NULL,
    finished_at=now(),last_error=NULL WHERE id=$1`,[job.id]);
  await client.query('COMMIT');
  return true;
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
export async function failJob(job:Job,reason:string):Promise<void>{
 // Sanitize failure data: do not persist model input, SQL contents or secrets.
 const message=reason.slice(0,160).replace(/[\r\n]/g,' ');
 const delay=Math.min(300,Math.pow(2,Math.min(job.attempts,8))*5);
 await pool.query(`UPDATE workflow_jobs SET
  status=CASE WHEN attempts>=max_attempts THEN 'failed' ELSE 'queued' END,
  available_at=now()+($3::int * interval '1 second'),
  last_error=$4,lease_token=NULL,leased_until=NULL,
  finished_at=CASE WHEN attempts>=max_attempts THEN now() ELSE NULL END
  WHERE id=$1 AND lease_token=$2 AND status='running'`,[job.id,job.lease_token,delay,message]);
}
