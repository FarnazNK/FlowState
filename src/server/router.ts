import { initTRPC, TRPCError } from '@trpc/server';
import { Effect } from 'effect';
import { z } from 'zod';
import { service, AppLayer } from './service.js';
import { Repository } from './db.js';
import { IntakeModel } from './intake.js';
const t=initTRPC.create();
const validWorkflowName=z.string().trim().min(1).max(120);
const runState=z.enum(['pending','running','approval','completed','failed']);
const id=z.string().uuid();
async function execute<T,E extends {_tag:string}>(program:Effect.Effect<T,E,Repository | IntakeModel>):Promise<T>{
 const result=await Effect.runPromise(Effect.either(Effect.provide(program,AppLayer)));
 if(result._tag==='Right')return result.right;
 if(result.left._tag==='NotFound')throw new TRPCError({code:'NOT_FOUND',message:'Resource not found'});
 if(result.left._tag==='ModelUnavailable')throw new TRPCError({code:'PRECONDITION_FAILED',message:'AI extraction is not configured on the server'});
 if(result.left._tag==='ModelFailure')throw new TRPCError({code:'BAD_GATEWAY',message:'AI extraction could not complete'});
 if(result.left._tag==='InvalidTransition')throw new TRPCError({code:'CONFLICT',message:'Invalid or stale state transition'});
 throw new TRPCError({code:'INTERNAL_SERVER_ERROR',message:'Database operation failed'});
}
export const appRouter=t.router({
 workflows:t.procedure.query(()=>execute(service.list())),
 createWorkflow:t.procedure.input(z.object({name:validWorkflowName})).mutation(({input})=>execute(service.create(input.name))),
 activateWorkflow:t.procedure.input(z.object({id})).mutation(({input})=>execute(service.activate(input.id))),
 runs:t.procedure.input(z.object({workflowId:id})).query(({input})=>execute(service.runs(input.workflowId))),
 startRun:t.procedure.input(z.object({workflowId:id})).mutation(({input})=>execute(service.start(input.workflowId))),
 events:t.procedure.input(z.object({runId:id})).query(({input})=>execute(service.events(input.runId))),
 intake:t.procedure.input(z.object({runId:id,text:z.string().min(40).max(12000)})).mutation(({input})=>execute(service.intake(input.runId,input.text))),
 transition:t.procedure.input(z.object({runId:id,expected:runState,next:runState})).mutation(({input})=>execute(service.transition(input.runId,input.expected,input.next)))
});
export type AppRouter=typeof appRouter;
