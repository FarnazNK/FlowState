import React,{useState} from 'react';
type Stage='draft'|'active'|'pending'|'running'|'approval'|'completed';
type DemoWorkflow={id:number;name:string;stage:Stage;events:string[]};
const initial:DemoWorkflow[]=[
 {id:1,name:'Immigration document review',stage:'approval',events:['Run created','Background worker started','Document fields validated','Human approval requested']},
 {id:2,name:'Contract compliance check',stage:'running',events:['Run created','Background worker started']},
 {id:3,name:'Client onboarding',stage:'active',events:['Workflow activated']}
];
const steps:Record<Stage,Stage|undefined>={draft:'active',active:'pending',pending:'running',running:'approval',approval:'completed',completed:undefined};
const action:Record<Stage,string>={draft:'Activate',active:'Queue run',pending:'Execute queued job',running:'Request review',approval:'Approve and complete',completed:'Completed'};
export function DemoApp({onOperator}:{onOperator:()=>void}){
 const [items,setItems]=useState(initial);
 const [selected,setSelected]=useState(1);
 const [name,setName]=useState('');
 const current=items.find(x=>x.id===selected)??items[0];
 const advance=()=>setItems(old=>old.map(x=>x.id!==selected||!steps[x.stage]?x:{...x,stage:steps[x.stage]!,events:[...x.events,action[x.stage]]}));
 const add=(e:React.FormEvent)=>{e.preventDefault();if(!name.trim())return;const next=Date.now();setItems(old=>[{id:next,name:name.trim().slice(0,100),stage:'draft',events:['Workflow created']},...old]);setSelected(next);setName('')};
 return <main style={{minHeight:'100vh',background:'#f5f7fb',fontFamily:'Inter,system-ui,sans-serif',color:'#17243c',padding:'32px clamp(16px,5vw,72px)'}}>
  <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}>
   <div><div style={{fontSize:23,fontWeight:800}}>flowstate<span style={{color:'#6366f1'}}>.</span></div><small>WORKFLOW OPERATIONS CONSOLE</small></div>
   <button className="button" onClick={onOperator}>Operator workspace</button>
  </header>
  <section style={{margin:'36px 0 24px'}}>
   <div style={{color:'#4f46e5',fontWeight:750,fontSize:12,letterSpacing:2}}>INTERACTIVE PORTFOLIO DEMO</div>
   <h1 style={{fontSize:'clamp(27px,4vw,42px)',margin:'10px 0'}}>Explore a durable workflow lifecycle</h1>
   <p style={{maxWidth:720,lineHeight:1.6}}>Try creating and advancing synthetic workflows. All changes here stay in your browser; no private data, credentials, paid AI calls, or database writes are involved.</p>
  </section>
  <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:14,marginBottom:22}}>
   {([['Workflows',items.length],['Awaiting approval',items.filter(x=>x.stage==='approval').length],['Completed',items.filter(x=>x.stage==='completed').length]] as const).map(([label,value])=><div key={label} style={{background:'#fff',border:'1px solid #e2e8f0',padding:24,borderRadius:14}}><div style={{fontSize:13,color:'#64748b'}}>{label}</div><strong style={{fontSize:32}}>{value}</strong></div>)}
  </section>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(290px,1fr))',gap:18}}>
   <section style={{background:'#fff',border:'1px solid #e2e8f0',padding:22,borderRadius:14}}>
    <h2 style={{fontSize:19}}>Workflows</h2>
    <form onSubmit={add} style={{display:'flex',gap:8,marginBottom:20}}><input value={name} onChange={e=>setName(e.target.value)} maxLength={100} aria-label="New demo workflow" placeholder="New workflow name" style={{flex:1,minWidth:0,padding:10,border:'1px solid #cbd5e1',borderRadius:8}}/><button className="button buttonPrimary">Add</button></form>
    {items.map(w=><button key={w.id} onClick={()=>setSelected(w.id)} style={{display:'flex',width:'100%',justifyContent:'space-between',gap:12,textAlign:'left',padding:14,borderRadius:9,border:selected===w.id?'1px solid #6366f1':'1px solid #e2e8f0',background:selected===w.id?'#eef2ff':'#fff',marginBottom:8,cursor:'pointer'}}><strong>{w.name}</strong><span style={{fontSize:12,color:'#475569'}}>{w.stage}</span></button>)}
   </section>
   <section style={{background:'#fff',border:'1px solid #e2e8f0',padding:22,borderRadius:14}}>
    <h2 style={{fontSize:19}}>{current.name}</h2><p>Current stage: <strong>{current.stage}</strong></p>
    <div style={{display:'flex',flexWrap:'wrap',gap:6,margin:'20px 0'}}>{(['draft','active','pending','running','approval','completed'] as Stage[]).map(st=><span key={st} style={{padding:'7px 9px',fontSize:11,borderRadius:7,background:st===current.stage?'#4338ca':'#f1f5f9',color:st===current.stage?'white':'#475569'}}>{st}</span>)}</div>
    <button disabled={!steps[current.stage]} className="button buttonPrimary" onClick={advance}>{action[current.stage]}</button>
    <h3 style={{fontSize:16,marginTop:26}}>Audit timeline</h3>
    <ol style={{lineHeight:2,paddingLeft:24}}>{current.events.map((x,i)=><li key={i}>{x}</li>)}</ol>
   </section>
  </div>
  <p style={{color:'#64748b',fontSize:12,marginTop:24}}>This interactive browser-only simulation demonstrates the workflow lifecycle. Real PostgreSQL transactions, background jobs, and authenticated SSE run in the separate local operator environment; they are not simulated as production infrastructure.</p>
 </main>
}
