import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../server/router.js';
import './style.css';

const api = createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: '/trpc' })] });
type Workflow = Awaited<ReturnType<typeof api.workflows.query>>[number];
type Run = Awaited<ReturnType<typeof api.runs.query>>[number];
type RunEvent = Awaited<ReturnType<typeof api.events.query>>[number];
type RunState = Run['state'];
const transitions: Record<RunState, RunState[]> = {
  pending: ['running', 'failed'], running: ['approval', 'completed', 'failed'],
  approval: ['running', 'completed', 'failed'], completed: [], failed: []
};
const stateLabel: Record<RunState, string> = {
  pending: 'Queued', running: 'Running', approval: 'Needs approval', completed: 'Completed', failed: 'Failed'
};
const dateLabel = (date: unknown) => new Date(String(date)).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
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
 const [workflows, setWorkflows] = useState<Workflow[]>([]);
 const [selectedId, setSelectedId] = useState('');
 const [runs, setRuns] = useState<Run[]>([]);
 const [runId, setRunId] = useState('');
 const [events, setEvents] = useState<RunEvent[]>([]);
 const [name, setName] = useState('');
 const [filter, setFilter] = useState('');
 const [view, setView] = useState<'overview'|'workflows'|'activity'>('overview');
 const [dialog, setDialog] = useState(false);
 const [loading, setLoading] = useState(true);
 const [busy, setBusy] = useState(false);
 const [notice, setNotice] = useState('');
 const [error, setError] = useState('');
 const selected = workflows.find(w=>w.id===selectedId);
 const run = runs.find(r=>r.id===runId);
 const activeCount = workflows.filter(w=>w.status==='active').length;
 const completedCount = runs.filter(r=>r.state==='completed').length;
 const filtered = useMemo(()=>workflows.filter(w=>w.name.toLowerCase().includes(filter.toLowerCase())),[workflows,filter]);
 const loadWorkflows=useCallback(async()=>{setWorkflows(await api.workflows.query())},[]);
 const loadRuns=useCallback(async(id:string)=>{setRuns(await api.runs.query({workflowId:id}))},[]);
 useEffect(()=>{let mounted=true;api.workflows.query().then(items=>{if(mounted){setWorkflows(items);setSelectedId(old=>old||items[0]?.id||'')}}).catch(()=>{if(mounted)setError('Cannot reach the workflow API. Check backend health and retry.')}).finally(()=>{if(mounted)setLoading(false)});return()=>{mounted=false}},[]);
 useEffect(()=>{let mounted=true;if(!selectedId){setRuns([]);setRunId('');return}api.runs.query({workflowId:selectedId}).then(data=>{if(mounted){setRuns(data);setRunId(old=>data.some(r=>r.id===old)?old:data[0]?.id||'')}}).catch(()=>{if(mounted)setError('Could not load execution history.')});return()=>{mounted=false}},[selectedId]);
 useEffect(()=>{let mounted=true;if(!runId){setEvents([]);return}api.events.query({runId}).then(data=>{if(mounted)setEvents(data)}).catch(()=>{if(mounted)setError('Could not load audit events.')});return()=>{mounted=false}},[runId]);
 const act=async (f:()=>Promise<void>, success:string)=>{setBusy(true);setError('');setNotice('');try{await f();await loadWorkflows();if(selectedId)await loadRuns(selectedId);setNotice(success)}catch(e){setError(e instanceof Error?e.message:'Operation failed. Please try again.')}finally{setBusy(false)}};
 const create=()=>void act(async()=>{const created=await api.createWorkflow.mutate({name:name.trim()});setSelectedId(created.id);setName('');setDialog(false);setView('workflows')},'Workflow created successfully.');
 const refresh=()=>void act(async()=>{await loadWorkflows();if(selectedId)await loadRuns(selectedId);if(runId)setEvents(await api.events.query({runId}))},'Workspace is up to date.');
 const changeState=(next:RunState)=>{if(!run)return;const id=run.id, expected=run.state;void act(async()=>{await api.transition.mutate({runId:id,expected,next});await loadRuns(selectedId);setEvents(await api.events.query({runId:id}))},'Execution moved to '+stateLabel[next].toLowerCase()+'.')};
 const sectionTitle=view==='overview'?'Operations overview':view==='workflows'?'Workflow explorer':'Execution activity';
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
  <header className="topbar"><div className="crumb"><span>Workspace</span><Icon name="chevron" size={14}/><strong>{sectionTitle}</strong></div><div className="topActions"><span className="environment"><span className="statusDot"/>PRODUCTION</span><button className="iconButton" onClick={refresh} disabled={busy} aria-label="Refresh data" title="Refresh data"><Icon name="refresh" size={17}/></button><a className="iconButton externalLink" title="Repository" aria-label="Open GitHub repository" href="https://github.com/FarnazNK/FlowState" target="_blank" rel="noreferrer"><Icon name="external" size={17}/></a></div></header>
  <div className="page">
   <div className="headingRow"><div><div className="overline"><span className="smallLine"/>OPERATIONS CENTER <span className="separator">/</span> 01</div><h1>{sectionTitle}</h1><p className="subtitle">Design, operate, and audit dependable workflow executions from a single control plane.</p></div><button className="button buttonPrimary" onClick={()=>setDialog(true)}><Icon name="plus" size={17}/> New workflow</button></div>
   {error&&<div className="alert error" role="alert"><Icon name="info" size={18}/><span>{error}</span><button onClick={()=>setError('')} aria-label="Dismiss error"><Icon name="x" size={17}/></button></div>}
   {notice&&<div className="alert success" role="status"><Icon name="check" size={18}/><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Dismiss notification"><Icon name="x" size={17}/></button></div>}
   {view==='overview'&&<><section className="stats" aria-label="Workspace statistics">
    <article className="stat"><div className="statTop"><span>Total workflows</span><span className="statIcon purple"><Icon name="layers" size={19}/></span></div><div className="statNumber">{loading?'—':String(workflows.length).padStart(2,'0')}</div><div className="statFoot">Configured in this workspace</div></article>
    <article className="stat"><div className="statTop"><span>Active workflows</span><span className="statIcon green"><Icon name="bolt" size={19}/></span></div><div className="statNumber">{loading?'—':String(activeCount).padStart(2,'0')}</div><div className="statFoot"><span className="miniDot greenDot"/> Ready for execution</div></article>
    <article className="stat"><div className="statTop"><span>Selected executions</span><span className="statIcon blue"><Icon name="activity" size={19}/></span></div><div className="statNumber">{loading?'—':String(runs.length).padStart(2,'0')}</div><div className="statFoot">Runs in selected workflow</div></article>
    <article className="stat"><div className="statTop"><span>Completed runs</span><span className="statIcon orange"><Icon name="check" size={19}/></span></div><div className="statNumber">{loading?'—':String(completedCount).padStart(2,'0')}</div><div className="statFoot">Selected workflow only</div></article>
   </section><div className="sectionLead"><div><span className="overline">WORKSPACE SNAPSHOT</span><h2>Manage your operations</h2></div><span className="sectionHint">Select a workflow to inspect its execution lifecycle</span></div></>}
   <div className="workspaceGrid"><section className="surface workflowsPanel"><div className="panelHeader"><div><h2>Workflows</h2><p>Configured automation pipelines</p></div><span className="counter">{workflows.length}</span></div><label className="search"><Icon name="search" size={18}/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search workflows..." aria-label="Search workflows"/></label><div className="workflowItems">
    {loading?<div className="emptyState">Loading workflows…</div>:filtered.length===0?<div className="emptyState"><Icon name="layers" size={29}/><h3>{filter?'No matching workflows':'No workflows yet'}</h3><p>{filter?'Try another search term.':'Create a workflow to start tracking executions.'}</p></div>:filtered.map(w=><button className={'workflowItem '+(selectedId===w.id?'selected':'')} key={w.id} onClick={()=>{setSelectedId(w.id);setRunId('')}}><div className="workflowIcon"><Icon name="layers" size={18}/></div><span className="workflowMeta"><strong>{w.name}</strong><small>ID {shortId(w.id)} · {dateLabel(w.created_at)}</small></span><span className={'badge '+w.status}>{w.status}</span><Icon name="chevron" size={16}/></button>)}
   </div><div className="panelFooter"><span>{filtered.length} of {workflows.length} workflows</span><button className="textButton" onClick={()=>setDialog(true)}><Icon name="plus" size={15}/> Add new</button></div></section>
   <section className="surface detailPanel">{!selected?<div className="detailEmpty"><div className="emptyGraphic"><Icon name="layers" size={34}/></div><h2>No workflow selected</h2><p>Choose a workflow to inspect its configuration and execution history.</p><button className="button buttonPrimary" onClick={()=>setDialog(true)}>Create your first workflow <Icon name="arrow" size={17}/></button></div>:<>
    <div className="panelHeader detailHeader"><div><span className="overline">WORKFLOW DETAIL <span className="separator">/</span> {shortId(selected.id)}</span><h2>{selected.name}</h2><p>Created {dateLabel(selected.created_at)}</p></div><span className={'badge big '+selected.status}>{selected.status}</span></div>
    <div className="lifecycle"><div className="lifecycleTitle"><Icon name="activity" size={18}/> Execution lifecycle <span>STATE MACHINE</span></div><div className="steps"><div className="step"><span className="stepIcon">01</span><strong>Pending</strong><small>Queued</small></div><span className="stepConnector"/><div className="step"><span className="stepIcon">02</span><strong>Running</strong><small>In progress</small></div><span className="stepConnector"/><div className="step"><span className="stepIcon">03</span><strong>Approval</strong><small>Review gate</small></div><span className="stepConnector"/><div className="step"><span className="stepIcon">04</span><strong>Done</strong><small>Terminal</small></div></div></div>
    <div className="executionHeading"><div><h3>Executions</h3><p>State transitions are persisted with an audit trail.</p></div>{selected.status==='active'?<button disabled={busy} className="button buttonPrimary compact" onClick={()=>void act(async()=>{const created=await api.startRun.mutate({workflowId:selected.id});await loadRuns(selected.id);setRunId(created.id)},'Execution launched.') }><Icon name="plus" size={16}/> Start run</button>:<button disabled={busy} className="button compact" onClick={()=>void act(async()=>{await api.activateWorkflow.mutate({id:selected.id})},'Workflow activated.')}>Activate workflow <Icon name="arrow" size={16}/></button>}</div>
    <div className="executionList">{runs.length===0?<div className="emptyRuns"><Icon name="clock" size={23}/><p>No executions recorded yet.</p><small>Start a run to build an event timeline.</small></div>:runs.map(r=><button key={r.id} onClick={()=>setRunId(r.id)} className={'runItem '+(r.id===runId?'current':'')}><span className="runSymbol"><Icon name="activity" size={17}/></span><span className="runMeta"><strong>Run {shortId(r.id)}</strong><small>{dateLabel(r.created_at)}</small></span><span className={'badge '+r.state}>{stateLabel[r.state]}</span><Icon name="chevron" size={16}/></button>)}</div>
    {run&&<div className="runInspector"><div className="inspectorHeading"><div><span className="overline">SELECTED EXECUTION</span><h3>Run {shortId(run.id)}</h3></div><span className={'badge '+run.state}>{stateLabel[run.state]}</span></div><div className="runActions">{transitions[run.state].map(next=><button key={next} disabled={busy} className={'button compact '+(next==='failed'?'danger':'')} onClick={()=>changeState(next)}>{next==='approval'?'Request approval':next==='running'?'Start / resume':next==='completed'?'Complete execution':'Mark failed'} <Icon name="arrow" size={14}/></button>)}{transitions[run.state].length===0&&<p className="terminal"><Icon name="shield" size={16}/> Terminal state — further transitions are locked.</p>}</div><div className="auditHeading"><Icon name="clock" size={16}/> Event timeline <span>{events.length} EVENTS</span></div><div className="timeline">{events.map(ev=><div className="event" key={ev.id}><span className="eventDot"/><div><strong>{ev.event_type.replace('run.','').replace('.',' ')}</strong><span>{dateLabel(ev.created_at)}</span><code>{JSON.stringify(ev.payload)}</code></div></div>)}</div></div>}
   </>}</section></div>
   <div className="bottomBanner"><div className="bannerIcon"><Icon name="shield" size={20}/></div><div><strong>Designed for auditable operations</strong><p>Validated state changes, transactional persistence, and inspectable execution history. Authentication and background workers are not yet implemented.</p></div><a href="https://github.com/FarnazNK/FlowState" target="_blank" rel="noreferrer">View source <Icon name="arrow" size={16}/></a></div>
   <footer><span>© {new Date().getFullYear()} FlowState · Workflow orchestration</span><span>TypeScript <b>·</b> tRPC <b>·</b> Effect <b>·</b> PostgreSQL</span></footer>
  </div>
 </div>
 {dialog&&<div className="modalOverlay" onMouseDown={e=>{if(e.target===e.currentTarget)setDialog(false)}}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="dialogTitle"><div className="modalTop"><span className="modalIcon"><Icon name="plus" size={22}/></span><button className="iconButton" aria-label="Close dialog" onClick={()=>setDialog(false)}><Icon name="x" size={19}/></button></div><h2 id="dialogTitle">Create a workflow</h2><p>Give this process a descriptive name. You can activate it and start executing it immediately after creation.</p><form onSubmit={e=>{e.preventDefault();if(name.trim())create()}}><label htmlFor="workflowName">WORKFLOW NAME</label><input autoFocus id="workflowName" minLength={1} maxLength={120} required placeholder="e.g. Document intake verification" value={name} onChange={e=>setName(e.target.value)}/><div className="dialogActions"><button type="button" className="button" onClick={()=>setDialog(false)}>Cancel</button><button type="submit" disabled={busy||!name.trim()} className="button buttonPrimary">Create workflow <Icon name="arrow" size={16}/></button></div></form></div></div>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
