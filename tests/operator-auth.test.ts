import {describe,it,expect,afterAll} from 'vitest';
import {appRouter} from '../src/server/router.js';
import {TRPCError} from '@trpc/server';

const previous=process.env.FLOWSTATE_API_TOKEN;
afterAll(()=>{
 if(previous===undefined)delete process.env.FLOWSTATE_API_TOKEN;
 else process.env.FLOWSTATE_API_TOKEN=previous;
});
describe('operator API authentication',()=>{
 it('denies access when the token is not configured',async()=>{
  delete process.env.FLOWSTATE_API_TOKEN;
  const caller=appRouter.createCaller({authorization:'Bearer attacker'});
  await expect(caller.workflows({limit:1})).rejects.toMatchObject({code:'UNAUTHORIZED'});
 });
 it('denies requests without the correct bearer token',async()=>{
  process.env.FLOWSTATE_API_TOKEN='test-operator-access-token';
  const caller=appRouter.createCaller({authorization:'Bearer incorrect'});
  await expect(caller.workflows({limit:1})).rejects.toMatchObject({code:'UNAUTHORIZED'});
 });
});
