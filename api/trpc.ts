import type {IncomingMessage,ServerResponse} from 'node:http';
import {nodeHTTPRequestHandler} from '@trpc/server/adapters/node-http';
import {appRouter} from '../src/server/router.js';
export default async function handler(req:IncomingMessage,res:ServerResponse){
 const procedure=new URL(req.url??'/','http://localhost').searchParams.get('procedure');
 if(!procedure){res.writeHead(400);res.end('Procedure required');return}
 await nodeHTTPRequestHandler({req,res,router:appRouter,path:procedure,createContext:()=>({authorization:req.headers.authorization})});
}
