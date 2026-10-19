import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../server/router.js';
import './style.css';
import {DemoApp} from './DemoApp.js';

let operatorToken='';
const api = createTRPCClient<AppRouter>({ links: [httpBatchLink({
 url: '/trpc', headers:()=>operatorToken?{Authorization:'Bearer '+operatorToken}:{}
})] });
type WorkflowPage = Awaited<ReturnType<typeof api.workflows.query>>;
type RunPage = Awaited<ReturnType<typeof api.runs.query>>;
type Workflow = WorkflowPage['items'][number];
type Run = RunPage['items'][number];
type RunEvent = Awaited<ReturnType<typeof api.events.query>>[number];
type RunState = Run['state'];
const transitions: Record<RunState, RunState[]> = {
  pending: ['running', 'failed'], running: ['approval', 'completed', 'failed'],
  approval: ['running', 'completed', 'failed'], completed: [], failed: []
};
const stateLabel: Record<RunState, string> = {
  pending: 'Queued', running: 'Running', approval: 'Needs approval', completed: 'Completed', failed: 'Failed'
};
const dateFormatter = new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
const dateLabel = (date: unknown) => { const parsed = new Date(String(date)); return Number.isNaN(parsed.getTime()) ? 'Unknown date' : dateFormatter.format(parsed); };
const shortId = (id: string) => id.slice(0, 8).toUpperCase();
const Icon = ({ name, size=20 }: { name: string; size?: number }) => {
 const paths: Record<string, React.ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></>,
  activity: <><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 9a8 8 0 0 1 14-2l1 5M4 12l1 5a8 8 0 0 0 14-2"/></>,
  check: <path d="m5 12 5 5L20 7"/>,
  bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7V2Z"/>,
  shield: <><path d="m12 2 8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4Z"/><path d="m9 12 2 2 4-4"/></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/></>,
  x: <path d="M18 6 6 18M6 6l12 12"/>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.2"/></>,
  external: <><path d="M13 5h6v6m0-6-9 9"/><path d="M19 14v5H5V5h5"/></>
 };
 return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{paths[name]??paths.activity}</svg>;
};
function App() {
 const [demoMode,setDemoMode]=useState(true);
 const [authorized,setAuthorized]=useState(false);
 const [enteredToken,setEnteredToken]=useState('');
 const [authError,setAuthError]=useState('');
 const [authBusy,setAuthBusy]=useState(false);
 const [workflows, setWorkflows] = useState<Workflow[]>([]);
 const [workflowCursor,setWorkflowCursor]=useState<WorkflowPage['nextCursor']>(null);
 const [runCursor,setRunCursor]=useState<RunPage['nextCursor']>(null);
 const [moreBusy,setMoreBusy]=useState(false);
 const [selectedId, setSelectedId] = useState('');
 const [runs, setRuns] = useState<Run[]>([]);
 const [runId, setRunId] = useState('');
 const [events, setEvents] = useState<RunEvent[]>([]);
 const [moreEvents,setMoreEvents]=useState(false);
 const [eventsBusy,setEventsBusy]=useState(false);
 const [name, setName] = useState('');
 const [documentText,setDocumentText]=useState('');
 const [filter, setFilter] = useState('');
 const [statusFilter,setStatusFilter]=useState<'all'|'draft'|'active'|'paused'>('all');
 const [view, setView] = useState<'overview'|'workflows'|'activity'>('overview');
 const [dialog, setDialog] = useState(false);
 const [loading, setLoading] = useState(true);
 const [busy, setBusy] = useState(false);
 const busyRef = useRef(false);
 const [lastUpdated,setLastUpdated]=useState<Date | null>(null);
 const [notice, setNotice] = useState('');
 const [error, setError] = useState('');
 useEffect(()=>{
  if(!authorized||!runId||!selectedId)return;
  const controller=new AbortController();
  let cursor=0;
  const refresh=async()=>{
   await Promise.all([
    api.runs.query({workflowId:selectedId,limit:25}).then(page=>{if(!controller.signal.aborted){setRuns(page.items);setRunCursor(page.nextCursor)}}),
    api.events.query({runId}).then(data=>{if(!controller.signal.aborted){setEvents(data);setMoreEvents(data.length===50)}})
   ]);
  };
  const wait=(ms:number)=>new Promise<void>(resolve=>{
   const timer=setTimeout(()=>{controller.signal.removeEventListener('abort',onAbort);resolve()},ms);
   const onAbort=()=>{clearTimeout(timer);resolve()};
   controller.signal.addEventListener('abort',onAbort,{once:true});
  });
  const stream=async()=>{
   while(!controller.signal.aborted){
    try{
     const response=await fetch('/api/runs/'+encodeURIComponent(runId)+'/events/stream?after='+cursor,{
      headers:{Authorization:'Bearer '+operatorToken,Accept:'text/event-stream'},
      signal:controller.signal,
      cache:'no-store'
     });
     if(response.status===401||response.status===403)break;
     if(!response.ok||!response.body){await wait(3000);continue}
     const reader=response.body.getReader(),decoder=new TextDecoder();
     let buffer='';
     while(!controller.signal.aborted){
      const result=await reader.read();
      if(result.done)break;
      buffer+=decoder.decode(result.value,{stream:true});
      if(buffer.length>65536){buffer='';continue}
      let boundary=buffer.indexOf('\n\n');
      while(boundary>=0){
       const frame=buffer.slice(0,boundary);
       buffer=buffer.slice(boundary+2);
       const id=/^id: (\d+)$/m.exec(frame);
       if(id)cursor=Math.max(cursor,Number(id[1]));
       if(frame.includes('event: workflow.updated'))void refresh().catch(()=>{});
       boundary=buffer.indexOf('\n\n');
      }
     }
    }catch{ /* Reconnect after transient errors. */ }
    await wait(3000);
   }
  };
  void stream();
  return()=>controller.abort();
 },[authorized,runId,selectedId]);
 const selected = workflows.find(w=>w.id===selectedId);
 const run = runs.find(r=>r.id===runId);
 const activeCount = useMemo(()=>workflows.reduce((n,w)=>n+(w.status==='active'?1:0),0),[workflows]);
 const completedCount = useMemo(()=>runs.reduce((n,r)=>n+(r.state==='completed'?1:0),0),[runs]);
 const filtered = workflows;
 const workflowInput=useMemo(()=>({limit:25,search:filter.trim()||undefined,status:statusFilter==='all'?undefined:statusFilter}),[filter,statusFilter]);
 const loadWorkflows=useCallback(async()=>{const page=await api.workflows.query(workflowInput);setWorkflows(page.items);setWorkflowCursor(page.nextCursor);setLastUpdated(new Date())},[workflowInput,authorized]);
 const loadRuns=useCallback(async(id:string)=>{const page=await api.runs.query({workflowId:id,limit:25});setRuns(page.items);setRunCursor(page.nextCursor)},[]);
 useEffect(()=>{if(!authorized)return;let mounted=true;setLoading(true);const timeout=setTimeout(()=>{void api.workflows.query(workflowInput).then(page=>{if(mounted){setWorkflows(page.items);setWorkflowCursor(page.nextCursor);setSelectedId(old=>old&&page.items.some(w=>w.id===old)?old:page.items[0]?.id||'')}}).catch(()=>{if(mounted)setError('Cannot reach the workflow API. Check backend health and retry.')}).finally(()=>{if(mounted)setLoading(false)})},filter?250:0);return()=>{mounted=false;clearTimeout(timeout)}},[workflowInput]);
 useEffect(()=>{if(!authorized)return;let mounted=true;if(!selectedId){setRuns([]);setRunId('');setRunCursor(null);return}void api.runs.query({workflowId:selectedId,limit:25}).then(page=>{if(mounted){setRuns(page.items);setRunCursor(page.nextCursor);setRunId(old=>page.items.some(r=>r.id===old)?old:page.items[0]?.id||'')}}).catch(()=>{if(mounted)setError('Could not load executions.')});return()=>{mounted=false}},[selectedId,authorized]);
 useEffect(()=>{if(!authorized)return;let mounted=true;if(!runId){setEvents([]);setMoreEvents(false);return}void api.events.query({runId}).then(data=>{if(mounted){setEvents(data);setMoreEvents(data.length===50)}}).catch(()=>{if(mounted)setError('Could not load audit events.')});return()=>{mounted=false}},[runId,authorized]);
 const loadMoreWorkflows=async()=>{if(!workflowCursor||moreBusy)return;setMoreBusy(true);try{const page=await api.workflows.query({...workflowInput,cursor:workflowCursor});setWorkflows(old=>[...old,...page.items.filter(item=>!old.some(w=>w.id===item.id))]);setWorkflowCursor(page.nextCursor)}catch{setError('Could not load older workflows.')}finally{setMoreBusy(false)}};
 const loadMoreRuns=async()=>{if(!runCursor||!selectedId||moreBusy)return;setMoreBusy(true);try{const page=await api.runs.query({workflowId:selectedId,limit:25,cursor:runCursor});setRuns(old=>[...old,...page.items.filter(item=>!old.some(r=>r.id===item.id))]);setRunCursor(page.nextCursor)}catch{setError('Could not load older executions.')}finally{setMoreBusy(false)}};
 const act=async (f:()=>Promise<void>, success:string)=>{if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');setNotice('');try{await f();setNotice(success)}catch(e){setError(e instanceof Error?e.message:'Operation failed. Please try again.')}finally{busyRef.current=false;setBusy(false)}};
 const create=()=>void act(async()=>{const created=await api.createWorkflow.mutate({name:name.trim()});setWorkflows(old=>[created,...old]);setSelectedId(created.id);setName('');setDialog(false);setView('workflows')},'Workflow created successfully.');
 const refresh=()=>void act(async()=>{const [ws,rs,es]=await Promise.all([api.workflows.query(workflowInput),selectedId?api.runs.query({workflowId:selectedId,limit:25}):Promise.resolve(null),runId?api.events.query({runId}):Promise.resolve([])]);setWorkflows(ws.items);setWorkflowCursor(ws.nextCursor);setRuns(rs?.items??[]);setRunCursor(rs?.nextCursor??null);setEvents(es);setMoreEvents(es.length===50);setLastUpdated(new Date())},'Workspace is up to date.');
 const extractIntake=()=>{if(!run||run.state!=='running')return;const id=run.id;void act(async()=>{await api.intake.mutate({runId:id,text:documentText.trim()});setDocumentText('');await Promise.all([loadRuns(selectedId),api.events.query({runId:id}).then(items=>{setEvents(items);setMoreEvents(items.length===50)})])},'Document fields extracted. Review the results and approve or reject the run.')};
 const changeState=(next:RunState)=>{if(!run)return;const id=run.id, expected=run.state;void act(async()=>{await api.transition.mutate({runId:id,expected,next});await Promise.all([loadRuns(selectedId),api.events.query({runId:id}).then(items=>{setEvents(items);setMoreEvents(items.length===50)})])},'Execution moved to '+stateLabel[next].toLowerCase()+'.')};
 const loadMoreEvents=async()=>{if(eventsBusy||!runId||events.length===0)return;const selectedRun=runId;setEventsBusy(true);try{const page=await api.events.query({runId:selectedRun,before:Number(events[events.length-1].id)});if(selectedRun===runId){setEvents(old=>[...old,...page]);setMoreEvents(page.length===50)}}catch{setError('Could not load older events.')}finally{setEventsBusy(false)}};
 const sectionTitle=view==='overview'?'Operations overview':view==='workflows'?'Workflow explorer':'Execution activity';
 if(demoMode)return <DemoApp onOperator={()=>setDemoMode(false)}/>;
 if(!authorized)return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24}}>
  <form style={{maxWidth:420,width:'100%',padding:32,border:'1px solid #64748b',borderRadius:16}} onSubmit={e=>{
   e.preventDefault();if(!enteredToken.trim()||authBusy)return;
   operatorToken=enteredToken.trim();setAuthBusy(true);setAuthError('');
   void api.workflows.query({limit:1}).then(()=>{
    setEnteredToken('');setAuthorized(true);
   }).catch(()=>{
    operatorToken='';setAuthError('Invalid operator token or API unavailable.');
   }).finally(()=>setAuthBusy(false));
  }}>
   <h1>FlowState operator access</h1><button type="button" className="button" onClick={()=>setDemoMode(true)}>Back to public demo</button>
   <p>This workspace requires the server-side operator token. Never enter a token on an untrusted site.</p>
   <label htmlFor="accessToken">Operator token</label>
   <input id="accessToken" type="password" autoComplete="off" required value={enteredToken}
    onChange={e=>setEnteredToken(e.target.value)} style={{display:'block',width:'100%',padding:12,margin:'12px 0'}}/>
   {authError&&<p role="alert" style={{color:'#b91c1c'}}>{authError}</p>}
   <button className="button buttonPrimary" disabled={authBusy} type="submit">{authBusy?'Verifying…':'Unlock workspace'}</button>
  </form>
 </div>;
 return <div className="app">
 <aside className="sidebar">
  <a href="/" className="brand"><span className="brandmark"><Icon name="layers" size={21}/></span><span>flowstate<span className="branddot">.</span><small>WORKFLOW PLATFORM</small></span></a>
  <div className="navLabel">WORKSPACE</div>
  <nav aria-label="Primary navigation">
   <button className={'navItem '+(view==='overview'?'active':'')} onClick={()=>setView('overview')}><Icon name="grid" size={18}/>Overview</button>
   <button className={'navItem '+(view==='workflows'?'active':'')} onClick={()=>setView('workflows')}><Icon name="layers" size={18}/>Workflows<span className="navCount">{workflows.length}</span></button>
   <button className={'navItem '+(view==='activity'?'active':'')} onClick={()=>setView('activity')}><Icon name="activity" size={18}/>Activity</button>
  </nav>
  <div className="sidebarBottom"><div className="sideFooter"><span className="avatar">FS</span><span>FlowState Workspace<small>Engineering console</small></span></div></div>
 </aside>
 <div className="content">
  <header className="topbar"><div className="crumb"><span>Workspace</span><Icon name="chevron" size={14}/><strong>{sectionTitle}</strong></div><div className="topActions"><span className="environment">Workflow console</span><button className="iconButton" onClick={refresh} disabled={busy} aria-label="Refresh data" title="Refresh data"><Icon name="refresh" size={17}/></button><a className="iconButton externalLink" title="Repository" aria-label="Open GitHub repository" href="https://github.com/FarnazNK/FlowState" target="_blank" rel="noreferrer"><Icon name="external" size={17}/></a></div></header>
  <div className="page">
   <div className="headingRow"><div><div className="overline"><span className="smallLine"/>OPERATIONS CENTER <span className="separator">/</span> 01</div><h1>{sectionTitle}</h1><p className="subtitle">Design, operate, and audit dependable workflow executions from a single control plane.</p></div><button className="button buttonPrimary" onClick={()=>setDialog(true)}><Icon name="plus" size={17}/> New workflow</button></div>
   {error&&<div className="alert error" role="alert"><Icon name="info" size={18}/><span>{error}</span><button onClick={()=>setError('')} aria-label="Dismiss error"><Icon name="x" size={17}/></button></div>}
   {notice&&<div className="alert success" role="status"><Icon name="check" size={18}/><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Dismiss notification"><Icon name="x" size={17}/></button></div>}
   {view==='overview'&&<><section className="stats" aria-label="Workspace statistics">
    <article className="stat"><div className="statTop"><span>Total workflows</span><span className="statIcon purple"><Icon name="layers" size={19}/></span></div><div className="statNumber">{loading?'—':String(workflows.length).padStart(2,'0')}</div><div className="statFoot">In currently loaded workflows</div></article>
    <article className="stat"><div className="statTop"><span>Active workflows</span><span className="statIcon green"><Icon name="bolt" size={19}/></span></div><div className="statNumber">{loading?'—':String(activeCount).padStart(2,'0')}</div><div className="statFoot"><span className="miniDot greenDot"/> Active in loaded workflows</div></article>
    <article className="stat"><div className="statTop"><span>Selected executions</span><span className="statIcon blue"><Icon name="activity" size={19}/></span></div><div className="statNumber">{loading?'—':String(runs.length).padStart(2,'0')}</div><div className="statFoot">Runs in selected workflow</div></article>
    <article className="stat"><div className="statTop"><span>Completed runs</span><span className="statIcon orange"><Icon name="check" size={19}/></span></div><div className="statNumber">{loading?'—':String(completedCount).padStart(2,'0')}</div><div className="statFoot">Selected workflow only</div></article>
   </section><div className="sectionLead"><div><span className="overline">WORKSPACE SNAPSHOT</span><h2>Manage your operations</h2></div><span className="sectionHint">Select a workflow to inspect its execution lifecycle</span></div></>}
   <div className="workspaceGrid"><section className="surface workflowsPanel"><div className="panelHeader"><div><h2>Workflows</h2><p>Configured automation pipelines</p></div><span className="counter">{workflows.length}</span></div><label className="search"><Icon name="search" size={18}/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search workflows..." aria-label="Search workflows"/></label><div className="filterBar"><label htmlFor="workflowStatus">Status</label><select id="workflowStatus" value={statusFilter} onChange={e=>setStatusFilter(e.target.value as typeof statusFilter)}><option value="all">All workflows</option><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option></select></div><div className="workflowItems">
    {loading?<div className="emptyState">Loading workflows…</div>:filtered.length===0?<div className="emptyState"><Icon name="layers" size={29}/><h3>{filter?'No matching workflows':'No workflows yet'}</h3><p>{filter?'Try another search term.':'Create a workflow to start tracking executions.'}</p></div>:filtered.map(w=><button className={'workflowItem '+(selectedId===w.id?'selected':'')} key={w.id} onClick={()=>{setSelectedId(w.id);setRunId('')}}><div className="workflowIcon"><Icon name="layers" size={18}/></div><span className="workflowMeta"><strong>{w.name}</strong><small>ID {shortId(w.id)} · {dateLabel(w.created_at)}</small></span><span className={'badge '+w.status}>{w.status}</span><Icon name="chevron" size={16}/></button>)}
   </div><div className="panelFooter"><span>{workflows.length} loaded</span>{workflowCursor&&<button className="textButton" disabled={moreBusy} onClick={()=>void loadMoreWorkflows()}>Load more</button>}<button className="textButton" onClick={()=>setDialog(true)}><Icon name="plus" size={15}/> Add new</button></div></section>
   <section className="surface detailPanel">{!selected?<div className="detailEmpty"><div className="emptyGraphic"><Icon name="layers" size={34}/></div><h2>No workflow selected</h2><p>Choose a workflow to inspect its configuration and execution history.</p><button className="button buttonPrimary" onClick={()=>setDialog(true)}>Create your first workflow <Icon name="arrow" size={17}/></button></div>:<>
    <div className="panelHeader detailHeader"><div><span className="overline">WORKFLOW DETAIL <span className="separator">/</span> {shortId(selected.id)}</span><h2>{selected.name}</h2><p>Created {dateLabel(selected.created_at)}</p></div><span className={'badge big '+selected.status}>{selected.status}</span></div>
    <div className="lifecycle"><div className="lifecycleTitle"><Icon name="activity" size={18}/> Execution lifecycle <span>STATE MACHINE</span></div><div className="steps"><div className="step"><span className="stepIcon">01</span><strong>Pending</strong><small>Queued</small></div><span className="stepConnector"/><div className="step"><span className="stepIcon">02</span><strong>Running</strong><small>In progress</small></div><span className="stepConnector"/><div className="step"><span className="stepIcon">03</span><strong>Approval</strong><small>Review gate</small></div><span className="stepConnector"/><div className="step"><span className="stepIcon">04</span><strong>Done</strong><small>Terminal</small></div></div></div>
    <div className="executionHeading"><div><h3>Executions</h3><p>State transitions are persisted with an audit trail.</p></div>{selected.status==='active'?<button disabled={busy} className="button buttonPrimary compact" onClick={()=>void act(async()=>{const created=await api.startRun.mutate({workflowId:selected.id});setRuns(old=>[created,...old]);setRunId(created.id)},'Execution launched.') }><Icon name="plus" size={16}/> Start run</button>:<button disabled={busy} className="button compact" onClick={()=>void act(async()=>{const updated=await api.activateWorkflow.mutate({id:selected.id});setWorkflows(old=>old.map(w=>w.id===updated.id?updated:w))},'Workflow activated.')}>Activate workflow <Icon name="arrow" size={16}/></button>}</div>
    <div className="executionList">{runs.length===0?<div className="emptyRuns"><Icon name="clock" size={23}/><p>No executions recorded yet.</p><small>Start a run to build an event timeline.</small></div>:runs.map(r=><button key={r.id} onClick={()=>setRunId(r.id)} className={'runItem '+(r.id===runId?'current':'')}><span className="runSymbol"><Icon name="activity" size={17}/></span><span className="runMeta"><strong>Run {shortId(r.id)}</strong><small>{dateLabel(r.created_at)}</small></span><span className={'badge '+r.state}>{stateLabel[r.state]}</span><Icon name="chevron" size={16}/></button>)}{runCursor&&<button className="button compact" disabled={moreBusy} onClick={()=>void loadMoreRuns()}>Load more executions</button>}</div>
    {run&&<div className="runInspector"><div className="inspectorHeading"><div><span className="overline">SELECTED EXECUTION</span><h3>Run {shortId(run.id)}</h3></div><span className={'badge '+run.state}>{stateLabel[run.state]}</span></div>{run.state==='running'&&<div className="intakeForm"><div className="intakeTitle"><Icon name="layers" size={17}/> Document intake</div><p>Paste sample text to extract structured fields. Results are added to the audit timeline for review.</p><label htmlFor="intakeDocument">DOCUMENT CONTENT</label><textarea id="intakeDocument" rows={5} placeholder="Paste sample agreement or invoice content (no sensitive information)" value={documentText} onChange={e=>setDocumentText(e.target.value)} maxLength={12000}/><button className="button buttonPrimary compact" disabled={busy||documentText.trim().length<40} onClick={extractIntake}>Extract fields with AI <Icon name="arrow" size={14}/></button><small>Requires an AI provider configured on the server.</small></div>}
    <div className="runActions">{transitions[run.state].map(next=><button key={next} disabled={busy} className={'button compact '+(next==='failed'?'danger':'')} onClick={()=>changeState(next)}>{next==='approval'?'Request approval':next==='running'?'Start / resume':next==='completed'?'Complete execution':'Mark failed'} <Icon name="arrow" size={14}/></button>)}{transitions[run.state].length===0&&<p className="terminal"><Icon name="shield" size={16}/> Terminal state — further transitions are locked.</p>}</div><div className="auditHeading"><Icon name="clock" size={16}/> Event timeline <span>{events.length} EVENTS</span></div><div className="timeline">{events.map(ev=><div className="event" key={ev.id}><span className="eventDot"/><div><strong>{ev.event_type.replace('run.','').replace('.',' ')}</strong><span>{dateLabel(ev.created_at)}</span><code>{JSON.stringify(ev.payload).slice(0,500)}</code></div></div>)}</div>{moreEvents&&<button className="button compact" disabled={eventsBusy} onClick={()=>void loadMoreEvents()}>{eventsBusy?'Loading…':'Load older events'}</button>}</div>}
   </>}</section></div>
   <div className="bottomBanner"><div className="bannerIcon"><Icon name="shield" size={20}/></div><div><strong>Keep every execution accountable</strong><p>Review workflow activity, track pending approvals, and inspect a clear history of decisions.</p></div></div>
   <footer><span>© {new Date().getFullYear()} FlowState · Workflow orchestration</span><span>Workflow operations workspace</span></footer>
  </div>
 </div>
 {dialog&&<div className="modalOverlay" onMouseDown={e=>{if(e.target===e.currentTarget)setDialog(false)}}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="dialogTitle"><div className="modalTop"><span className="modalIcon"><Icon name="plus" size={22}/></span><button className="iconButton" aria-label="Close dialog" onClick={()=>setDialog(false)}><Icon name="x" size={19}/></button></div><h2 id="dialogTitle">Create a workflow</h2><p>Give this process a descriptive name. You can activate it and start executing it immediately after creation.</p><form onSubmit={e=>{e.preventDefault();if(name.trim())create()}}><label htmlFor="workflowName">WORKFLOW NAME</label><input autoFocus id="workflowName" minLength={1} maxLength={120} required placeholder="e.g. Document intake verification" value={name} onChange={e=>setName(e.target.value)}/><div className="dialogActions"><button type="button" className="button" onClick={()=>setDialog(false)}>Cancel</button><button type="submit" disabled={busy||!name.trim()} className="button buttonPrimary">Create workflow <Icon name="arrow" size={16}/></button></div></form></div></div>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
