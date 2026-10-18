import { initTRPC, TRPCError } from '@trpc/server';
import { Effect } from 'effect';
import { z } from 'zod';
import { service } from './service.js';
const t=initTRPC.create();
const runState=z.enum(['pending','running','approval','completed','failed']);
const id=z.string().uuid();
async function execute<T,E extends {_tag:string}>(program:Effect.Effect<T,E>):Promise<T>{
 const result=await Effect.runPromise(Effect.either(program));
 if(result._tag==='Right')return result.right;
 if(result.left._tag==='NotFound')throw new TRPCError({code:'NOT_FOUND',message:'Resource not found'});
 if(result.left._tag==='InvalidTransition')throw new TRPCError({code:'CONFLICT',message:'Invalid or stale state transition'});
 throw new TRPCError({code:'INTERNAL_SERVER_ERROR',message:'Database operation failed'});
}
export const appRouter=t.router({
 workflows:t.procedure.query(()=>execute(service.list())),
 createWorkflow:t.procedure.input(z.object({name:z.string().trim().min(1).max(120)})).mutation(({input})=>execute(service.create(input.name))),
 activateWorkflow:t.procedure.input(z.object({id})).mutation(({input})=>execute(service.activate(input.id))),
 runs:t.procedure.input(z.object({workflowId:id})).query(({input})=>execute(service.runs(input.workflowId))),
 startRun:t.procedure.input(z.object({workflowId:id})).mutation(({input})=>execute(service.start(input.workflowId))),
 events:t.procedure.input(z.object({runId:id})).query(({input})=>execute(service.events(input.runId))),
 transition:t.procedure.input(z.object({runId:id,expected:runState,next:runState})).mutation(({input})=>execute(service.transition(input.runId,input.expected,input.next)))
});
export type AppRouter=typeof appRouter;
