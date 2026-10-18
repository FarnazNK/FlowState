import 'dotenv/config';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {nodeHTTPRequestHandler} from '@trpc/server/adapters/node-http';
import {pool} from './db.js';
import {appRouter} from './router.js';
const port=Number(process.env.PORT ?? 3001);
const dist=resolve(process.cwd(),'dist');
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'};
createServer((req,res)=>{
 const path=new URL(req.url??'/','http://localhost').pathname;
 if(path==='/healthz'){
  void pool.query('SELECT 1').then(()=>{res.writeHead(200,{'content-type':'application/json'});res.end('{"status":"ok"}')}).catch(()=>{res.writeHead(503);res.end('{"status":"unavailable"}')});return;
 }
 if(path.startsWith('/trpc/')){void nodeHTTPRequestHandler({req,res,router:appRouter,path:path.slice(6),createContext:()=>({})});return}
 void (async()=>{
  const pathname=path==='/'?'/index.html':path;
  const file=resolve(dist,'.'+decodeURIComponent(pathname));
  if(file!==dist&&!file.startsWith(dist+sep)){res.writeHead(403);res.end();return}
  try{if(!(await stat(file)).isFile())throw Error();const contents=await readFile(file);res.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream'});res.end(contents)}
  catch{if(path.startsWith('/assets/')||extname(path)){res.writeHead(404);res.end('Not found');return}
   try{const html=await readFile(resolve(dist,'index.html'));res.writeHead(200,{'content-type':'text/html'});res.end(html)}catch{res.writeHead(500);res.end('Build missing')}}
 })().catch(()=>{res.writeHead(500);res.end('Server error')});
}).listen(port,'0.0.0.0',()=>console.log('FlowState ready on port '+port));
