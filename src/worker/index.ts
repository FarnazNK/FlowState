import 'dotenv/config';
import {pool} from '../server/db.js';
import {claimJob,renewLease,finishJob,failJob} from '../server/jobs.js';
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
let shuttingDown=false;
process.on('SIGTERM',()=>{shuttingDown=true});
process.on('SIGINT',()=>{shuttingDown=true});
async function main(){
 console.log('FlowState PostgreSQL worker started');
 while(!shuttingDown){
  const job=await claimJob().catch(e=>{console.error('Job claim failed',e instanceof Error?e.name:'error');return undefined});
  if(!job){await sleep(1000);continue;}
  let active=true;
  const heartbeat=setInterval(()=>{if(active)void renewLease(job).then(ok=>{if(!ok)active=false}).catch(()=>{active=false})},20000);
  try{
   if(!active)throw Error('Lease lost');
   if(job.kind!=='start_run')throw Error('Unsupported job type');
   const ok=await finishJob(job);
   if(!ok)console.warn('Job lease no longer owned:',job.id);
  }catch(error){
   console.error('Job failed:',job.id);
   await failJob(job,error instanceof Error?error.name:'worker error').catch(()=>{});
  }finally{active=false;clearInterval(heartbeat)}
 }
 await pool.end();
}
void main().catch(e=>{console.error('Worker stopped',e instanceof Error?e.name:'error');process.exitCode=1});
