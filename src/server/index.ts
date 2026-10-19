import 'dotenv/config';
import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {nodeHTTPRequestHandler} from '@trpc/server/adapters/node-http';
import {pool} from './db.js';
import {appRouter} from './router.js';
const port=Number(process.env.PORT ?? 3001);
const dist=resolve(process.cwd(),'dist');
let activeStreams=0;
const maxStreams=20;
const staticCache = new Map<string, {body:Buffer; type:string}>();
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'};
createServer((req,res)=>{
 const path=new URL(req.url??'/','http://localhost').pathname;
 if(path==='/healthz'){
  void pool.query('SELECT 1').then(()=>{res.writeHead(200,{'content-type':'application/json'});res.end('{"status":"ok"}')}).catch(()=>{res.writeHead(503);res.end('{"status":"unavailable"}')});return;
 }

 // Optional privileged event stream: disabled when FLOWSTATE_STREAM_TOKEN is unset.
 if(path.startsWith('/api/runs/')&&path.endsWith('/events/stream')){
  const token=process.env.FLOWSTATE_API_TOKEN;
  const bearer=req.headers.authorization;
  const provided=bearer?.startsWith('Bearer ')?bearer.slice(7):'';
  const a=Buffer.from(provided),b=Buffer.from(token??'');
  if(!token){res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});res.end('{"error":"stream disabled"}');return}
  if(a.length!==b.length||!timingSafeEqual(a,b)){res.writeHead(401,{'www-authenticate':'Bearer','cache-control':'no-store'});res.end();return}
  const match=/^\/api\/runs\/([0-9a-fA-F-]{36})\/events\/stream$/.exec(path);
  if(!match){res.writeHead(404);res.end();return}
  if(activeStreams>=maxStreams){res.writeHead(429,{'retry-after':'10','cache-control':'no-store'});res.end();return}
  const runId=match[1];
  let cursor=Number(req.headers['last-event-id']??new URL(req.url??'','http://localhost').searchParams.get('after')??0);
  if(!Number.isSafeInteger(cursor)||cursor<0){res.writeHead(400);res.end();return}
  void pool.query('SELECT id FROM runs WHERE id=$1',[runId]).then(result=>{
   if(!result.rowCount){res.writeHead(404);res.end();return}
   activeStreams++;
   res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-store, no-transform','x-content-type-options':'nosniff','x-accel-buffering':'no','connection':'keep-alive'});
   res.write(': connected\n\n');
   let busy=false;
   const poll=async()=>{
    if(busy||res.destroyed)return;
    busy=true;
    try{
     const result=await pool.query('SELECT id,run_id,event_type,created_at FROM run_events WHERE run_id=$1 AND id>$2 ORDER BY id ASC LIMIT 50',[runId,cursor]);
     for(const event of result.rows){
      cursor=Number(event.id);
      res.write('id: '+cursor+'\nevent: workflow.updated\ndata: '+JSON.stringify(event)+'\n\n');
     }
     if(result.rows.length===0)res.write(': heartbeat\n\n');
    }catch{res.end()}finally{busy=false}
   };
   void poll();
   const timer=setInterval(()=>void poll(),2000);
   res.on('close',()=>{clearInterval(timer);activeStreams=Math.max(0,activeStreams-1)});
  }).catch(()=>{res.writeHead(503);res.end()});
  return;
 }
 if(path.startsWith('/trpc/')){void nodeHTTPRequestHandler({req,res,router:appRouter,path:path.slice(6),createContext:()=>({authorization:req.headers.authorization})});return}
 void (async()=>{
  const pathname=path==='/'?'/index.html':path==='/docs'?'/docs.html':path;
  const file=resolve(dist,'.'+decodeURIComponent(pathname));
  if(file!==dist&&!file.startsWith(dist+sep)){res.writeHead(403);res.end();return}
  try{const cached=staticCache.get(file);if(!cached&&!(await stat(file)).isFile())throw Error();const type=mime[extname(file)]??'application/octet-stream';const contents=cached?.body??await readFile(file);if(!cached&&file.includes(sep+'assets'+sep))staticCache.set(file,{body:contents,type});res.writeHead(200,{'content-type':type,'cache-control':file.includes(sep+'assets'+sep)?'public,max-age=31536000,immutable':'no-cache'});res.end(contents)}
  catch{if(path.startsWith('/assets/')||extname(path)){res.writeHead(404);res.end('Not found');return}
   try{const html=await readFile(resolve(dist,'index.html'));res.writeHead(200,{'content-type':'text/html'});res.end(html)}catch{res.writeHead(500);res.end('Build missing')}}
 })().catch(()=>{res.writeHead(500);res.end('Server error')});
}).listen(port,'0.0.0.0',()=>console.log('FlowState ready on port '+port));
