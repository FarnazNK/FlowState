import { Effect, Data } from 'effect';
import { repo, type Run } from './db.js';
export class StorageFailure extends Data.TaggedError('StorageFailure')<{ cause: unknown }> {}
export class NotFound extends Data.TaggedError('NotFound')<{ entity: string }> {}
export class InvalidTransition extends Data.TaggedError('InvalidTransition')<{ state: string; target: string }> {}
const db = <T>(f:()=>Promise<T>) => Effect.tryPromise({try:f,catch:cause=>new StorageFailure({cause})});
export const allowed: Record<Run['state'], readonly Run['state'][]> = {
 pending:['running','failed'], running:['approval','completed','failed'], approval:['running','completed','failed'], completed:[], failed:[]
};
export const canTransition = (from:Run['state'], to:Run['state']) => allowed[from].includes(to);
export const service = {
 list:()=>db(()=>repo.list()),
 create:(name:string)=>db(()=>repo.create(name)),
 activate:(id:string)=>Effect.gen(function*(){const result=yield* db(()=>repo.activate(id));if(!result)return yield* Effect.fail(new NotFound({entity:'workflow'}));return result}),
 runs:(id:string)=>db(()=>repo.runs(id)),
 events:(id:string)=>db(()=>repo.events(id)),
 start:(id:string)=>Effect.gen(function*(){const run=yield* db(()=>repo.createRun(id));if(!run)return yield* Effect.fail(new NotFound({entity:'active workflow'}));return run}),
 transition:(id:string,expected:Run['state'],next:Run['state'])=>Effect.gen(function*(){
  if(!canTransition(expected,next))return yield* Effect.fail(new InvalidTransition({state:expected,target:next}));
  const run=yield* db(()=>repo.transition(id,expected,next));
  if(!run)return yield* Effect.fail(new InvalidTransition({state:expected,target:next}));
  return run;
 })
};
