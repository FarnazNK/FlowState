import React,{useEffect,useState} from 'react';
import{createRoot}from'react-dom/client';
import{createTRPCClient,httpBatchLink}from'@trpc/client';
import type{AppRouter}from'../server/router.js';
import './style.css';
const api=createTRPCClient<AppRouter>({links:[httpBatchLink({url:'/trpc'})]});
type Workflow=Awaited<ReturnType<typeof api.workflows.query>>[number];
type Run=Awaited<ReturnType<typeof api.runs.query>>[number];
type Event=Awaited<ReturnType<typeof api.events.query>>[number];
function App(){
 const[workflows,setWorkflows]=useState<Workflow[]>([]);
 const[selected,setSelected]=useState('');
 const[runs,setRuns]=useState<Run[]>([]);
 const[events,setEvents]=useState<Event[]>([]);
 const[activeRun,setActiveRun]=useState('');
 const[name,setName]=useState('');
 const[error,setError]=useState('');
 const[busy,setBusy]=useState(false);
 const current=workflows.find(w=>w.id===selected);
 const run=runs.find(r=>r.id===activeRun);
 const refresh=async()=>setWorkflows(await api.workflows.query());
 const refreshRuns=async(id:string)=>setRuns(await api.runs.query({workflowId:id}));
 useEffect(()=>{void refresh().catch(()=>setError('Unable to connect to API.'))},[]);
 useEffect(()=>{if(selected)void refreshRuns(selected).catch(()=>setError('Unable to load runs.'));else setRuns([]);setActiveRun('')},[selected]);
 useEffect(()=>{if(activeRun)void api.events.query({runId:activeRun}).then(setEvents).catch(()=>setError('Unable to load history.'));else setEvents([])},[activeRun]);
 const action=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn();await refresh();if(selected)await refreshRuns(selected);if(activeRun)setEvents(await api.events.query({runId:activeRun}))}catch(e){setError(e instanceof Error?e.message:'Unexpected error')}finally{setBusy(false)}};
 const options:Record<Run['state'],Run['state'][]>= {pending:['running','failed'],running:['approval','completed','failed'],approval:['running','completed','failed'],completed:[],failed:[]};
 return <div className="shell">
 <header><div className="logo"><span className="glyph">◉</span> FlowState <span className="version">/ OPERATIONS CONSOLE</span></div><span className="headRight"><span className="liveDot"/>WORKFLOW ENGINE</span></header>
 <section className="hero"><p className="eyebrow">WORKFLOW SYSTEM / CONTROL PLANE</p><h1>Every process.<br/><em>Under control.</em></h1><p className="intro">Define workflows, track execution, manage approval checkpoints, and inspect an immutable sequence of operational events.</p></section>
 <div className="metrics"><div><small>WORKFLOWS</small><strong>{workflows.length.toString().padStart(2,'0')}</strong></div><div><small>ACTIVE</small><strong>{workflows.filter(w=>w.status==='active').length.toString().padStart(2,'0')}</strong></div><div><small>EXECUTIONS</small><strong>{runs.length.toString().padStart(2,'0')}</strong></div><div><small>STATE</small><strong className="stateText">PERSISTENT</strong></div></div>
 <main><aside className="panel"><div className="panelHead"><h2>Workflows</h2><span className="count">{workflows.length}</span></div><form onSubmit={e=>{e.preventDefault();void action(async()=>{const w=await api.createWorkflow.mutate({name});setName('');setSelected(w.id)})}}><label htmlFor="name">NEW WORKFLOW</label><input id="name" required maxLength={120} placeholder="e.g. Intake verification" value={name} onChange={e=>setName(e.target.value)}/><button disabled={busy} className="primary">+ Create workflow</button></form><div className="workflowList">{workflows.map(w=><button key={w.id} onClick={()=>{setSelected(w.id);setActiveRun('')}} className={'workflow '+(w.id===selected?'chosen':'')}><span><b>{w.name}</b><small>{w.id.slice(0,8).toUpperCase()}</small></span><span className={'pill '+w.status}>{w.status}</span></button>)}{!workflows.length&&<p className="empty">No workflows. Create one to get started.</p>}</div></aside>
 <section className="panel mainPanel">{!current?<div className="placeholder"><div className="illustration">⌘</div><h2>Select a workflow</h2><p>Select a workflow from the sidebar or create your first workflow.</p></div>:<>
 <div className="panelHead"><div><small className="eyebrow">WORKFLOW DETAIL</small><h2>{current.name}</h2></div><span className={'pill '+current.status}>{current.status}</span></div>
 <div className="toolbar"><span>Created {new Date(String(current.created_at)).toLocaleDateString()}</span>{current.status!=='active'&&<button disabled={busy} onClick={()=>void action(async()=>{await api.activateWorkflow.mutate({id:current.id})})}>Activate →</button>}{current.status==='active'&&<button disabled={busy} className="primary" onClick={()=>void action(async()=>{const r=await api.startRun.mutate({workflowId:current.id});setActiveRun(r.id)})}>+ Start execution</button>}</div>
 <h3>Execution history <span className="count">{runs.length}</span></h3><div className="runList">{runs.map(r=><button key={r.id} className={'run '+(r.id===activeRun?'chosen':'')} onClick={()=>setActiveRun(r.id)}><span><b>RUN / {r.id.slice(0,8).toUpperCase()}</b><small>{new Date(String(r.created_at)).toLocaleString()}</small></span><span className={'pill '+r.state}>{r.state}</span></button>)}{runs.length===0&&<p className="empty">No executions yet. Activate the workflow and launch a run.</p>}</div>
 {run&&<div className="runDetail"><h3>Execution control</h3><p className="runId">RUN ID: {run.id}</p><div className="controls">{options[run.state].map(next=><button disabled={busy} key={next} onClick={()=>void action(async()=>{await api.transition.mutate({runId:run.id,expected:run.state,next})})}>{next==='approval'?'Request approval':next==='completed'?'Complete run':next==='failed'?'Mark failed':next==='running'?'Start / resume':next}</button>)}</div><h3>Event trail</h3><div className="timeline">{events.map(ev=><div key={ev.id} className="event"><span className="eventMarker"/><div><strong>{ev.event_type}</strong><small>{new Date(String(ev.created_at)).toLocaleString()}</small><code>{JSON.stringify(ev.payload)}</code></div></div>)}{events.length===0&&<p className="empty">Select a run to inspect its events.</p>}</div></div>}
 </>}</section></main>{error&&<p role="alert" className="error">{error}</p>}<footer><span>FLOWSTATE / WORKFLOW OPERATIONS</span><span>TYPESCRIPT · tRPC · EFFECT · POSTGRESQL</span></footer></div>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
