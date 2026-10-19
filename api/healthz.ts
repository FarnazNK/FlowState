import type {IncomingMessage,ServerResponse} from 'node:http';
import {pool} from '../src/server/db.js';
let lastProbe:{at:number;healthy:boolean}|undefined;
export default async function handler(_req:IncomingMessage,res:ServerResponse){
 if(!lastProbe||Date.now()-lastProbe.at>5000){try{await pool.query('SELECT 1');lastProbe={at:Date.now(),healthy:true}}catch{lastProbe={at:Date.now(),healthy:false}}}
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.statusCode=lastProbe.healthy?200:503;res.end(JSON.stringify(lastProbe.healthy?{status:'ok',database:'connected'}:{status:'unavailable'}));
}
