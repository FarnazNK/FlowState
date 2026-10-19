import { Effect, Data, Context, Layer } from 'effect';
import { Repository, RepositoryLive, type Run } from './db.js';
import { IntakeModel, IntakeModelLive } from './intake.js';

export class StorageFailure extends Data.TaggedError('StorageFailure')<{ cause: unknown }> {}
export class NotFound extends Data.TaggedError('NotFound')<{ entity: string }> {}
export class InvalidTransition extends Data.TaggedError('InvalidTransition')<{ state: string; target: string }> {}
const storage = <T>(f:()=>Promise<T>) => Effect.tryPromise({try:f,catch:cause=>new StorageFailure({cause})});

export const allowed: Record<Run['state'],readonly Run['state'][]> = {
 pending:['running','failed'], running:['approval','completed','failed'],
 approval:['running','completed','failed'], completed:[],failed:[]
};
export const canTransition=(from:Run['state'],to:Run['state'])=>allowed[from].includes(to);

export const service = {
 list:()=>Effect.flatMap(Repository,r=>storage(()=>r.list())),
 create:(name:string)=>Effect.flatMap(Repository,r=>storage(()=>r.create(name))),
 activate:(id:string)=>Effect.gen(function*(){
  const r=yield* Repository;
  const item=yield* storage(()=>r.activate(id));
  if(!item)return yield* Effect.fail(new NotFound({entity:'workflow'}));
  return item;
 }),
 runs:(id:string)=>Effect.flatMap(Repository,r=>storage(()=>r.runs(id))),
 events:(id:string,before?:number)=>Effect.flatMap(Repository,r=>storage(()=>r.events(id,before))),
 start:(id:string)=>Effect.gen(function*(){
  const r=yield* Repository;
  const item=yield* storage(()=>r.createRun(id));
  if(!item)return yield* Effect.fail(new NotFound({entity:'active workflow'}));
  return item;
 }),
 transition:(id:string,expected:Run['state'],next:Run['state'])=>Effect.gen(function*(){
  if(!canTransition(expected,next))return yield* Effect.fail(new InvalidTransition({state:expected,target:next}));
  const r=yield* Repository;
  const item=yield* storage(()=>r.transition(id,expected,next));
  if(!item)return yield* Effect.fail(new InvalidTransition({state:expected,target:next}));
  return item;
 }),
 intake:(id:string,text:string)=>Effect.gen(function*(){
  const model=yield* IntakeModel;
  const extracted=yield* model.extract(text);
  const repository=yield* Repository;
  const item=yield* storage(()=>repository.recordIntake(id,extracted));
  if(!item)return yield* Effect.fail(new InvalidTransition({state:'not running',target:'approval'}));
  return {run:item,extracted};
 })
};
export class WorkflowService extends Context.Tag('FlowState/WorkflowService')<WorkflowService, typeof service>() {}
export const WorkflowServiceLive=Layer.succeed(WorkflowService,service);
export const AppLayer=Layer.mergeAll(RepositoryLive,IntakeModelLive,WorkflowServiceLive);
