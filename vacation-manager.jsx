import { useState, useEffect, useRef, useCallback } from "react";

const _fl = document.createElement("link");
_fl.rel = "stylesheet";
_fl.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&display=swap";
document.head.appendChild(_fl);

const P = {
  bg:"#f4f0eb", surface:"#fffcf8", surfaceAlt:"#f9f5ef",
  border:"#e8e0d4", text:"#3d3530", textMid:"#7a6e65", textSoft:"#b0a49a",
  accent:"#d4956a", danger:"#e07b7b", success:"#7bbf9e", warn:"#e0b97b",
  shadow:"rgba(100,80,60,0.08)",
};
const ECOLS  = ["#e8a598","#98c4e8","#a8ddb5","#e898c4","#b898e8","#e8d598","#98e8d5","#c4a8e8"];
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DSHORT = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

const uid  = () => Math.random().toString(36).slice(2,9);
const pd   = s  => new Date(s+"T00:00:00");
function wdays(s,e){ let c=0,cur=new Date(s); while(cur<=e){const d=cur.getDay();if(d&&d<6)c++;cur.setDate(cur.getDate()+1);} return c; }
function overlap(s1,e1,s2,e2){ return s1<=e2&&s2<=e1; }

const ld = async(k,fb)=>{ try{const r=await window.storage.get(k);return r?JSON.parse(r.value):fb;}catch{return fb;} };
const sd = async(k,v) =>{ try{await window.storage.set(k,JSON.stringify(v));}catch{} };

function buildPayload(emps, vacs, confs) {
  const yr  = new Date().getFullYear();
  const now = new Date().toLocaleString("es-AR");

  const resumen = [
    ["VACACIONES MANAGER — Resumen automático"],
    [""],
    ["Última actualización", now],
    ["Total empleados",      emps.length],
    ["Total solicitudes",    vacs.length],
    ["Aprobadas",            vacs.filter(v=>v.status==="aprobado").length],
    ["Pendientes",           vacs.filter(v=>v.status==="pendiente").length],
    ["Rechazadas",           vacs.filter(v=>v.status==="rechazado").length],
    ["Reglas de conflicto",  confs.length],
  ];

  const vacaciones = [
    ["Empleado","Fecha Inicio","Fecha Fin","Días Hábiles","Estado","Notas","Cargado el"],
    ...vacs.map(v => {
      const e = emps.find(x=>x.id===v.employeeId);
      return [e?.name||"?", v.startDate, v.endDate, v.days, v.status, v.notes||"", v.createdAt?.slice(0,10)||""];
    })
  ];

  const empleados = [
    ["Nombre","Días Máx/Año",`Usados (${yr})`,"Restantes","% Utilizado"],
    ...emps.map(e => {
      const used = vacs.filter(v=>v.employeeId===e.id&&v.status!=="rechazado"&&v.startDate.startsWith(yr)).reduce((a,v)=>a+(v.days||0),0);
      const rem  = Math.max(0,e.maxDays-used);
      const pct  = Math.min(100,Math.round((used/e.maxDays)*100));
      return [e.name, e.maxDays, used, rem, pct+"%"];
    })
  ];

  const conflictos = [
    ["Empleados que NO pueden coincidir en vacaciones","Cantidad de empleados"],
    ...confs.map(c=>[
      c.employeeIds.map(id=>emps.find(e=>e.id===id)?.name||"?").join(" — "),
      c.employeeIds.length
    ])
  ];

  return { resumen, vacaciones, empleados, conflictos };
}

async function syncToSheet(scriptUrl, emps, vacs, confs) {
  const payload  = buildPayload(emps, vacs, confs);
  payload.rawState = { emps, vacs, confs };
  const formData = new FormData();
  formData.append("data", JSON.stringify(payload));
  await fetch(scriptUrl, { method:"POST", mode:"no-cors", body: formData });
}

export default function App() {
  const [tab,setTab]       = useState("calendar");
  const [emps,setEmps]     = useState([]);
  const [vacs,setVacs]     = useState([]);
  const [confs,setConfs]   = useState([]);
  const [alerts,setAlerts] = useState([]);
  const [ready,setReady]   = useState(false);

  const [scriptUrl, setScriptUrl] = useState("https://script.google.com/macros/s/AKfycbwiiMBmfDywaeFRKYwJSWjftGLueMDX6bsReSRxqE5qw4JRdK-rVttOMQP0zEdO0WjYXg/exec");
  
  const [syncState, setSyncState] = useState("idle");
  const [lastSync,  setLastSync]  = useState("");
  const syncTimer = useRef(null);

  const urlRef   = useRef(scriptUrl);
  const empsRef  = useRef(emps);
  const vacsRef  = useRef(vacs);
  const confsRef = useRef(confs);
  useEffect(()=>{ urlRef.current=scriptUrl; },[scriptUrl]);
  useEffect(()=>{ empsRef.current=emps; },[emps]);
  useEffect(()=>{ vacsRef.current=vacs; },[vacs]);
  useEffect(()=>{ confsRef.current=confs; },[confs]);

  useEffect(()=>{
    (async()=>{
      let loadedFromCloud = false;
      if (scriptUrl && scriptUrl !== "TU_URL_DE_GOOGLE_AQUI") {
        try {
          const res = await fetch(scriptUrl);
          const json = await res.json();
          if (json.ok && json.data) {
            setEmps(json.data.emps || []);
            setVacs(json.data.vacs || []);
            setConfs(json.data.confs || []);
            loadedFromCloud = true;
          }
        } catch(e) { }
      }
      
      if (!loadedFromCloud) {
        const [e,v,c]=await Promise.all([ld("vcm_e",[]),ld("vcm_v",[]),ld("vcm_c",[])]);
        setEmps(e); setVacs(v); setConfs(c);
      }
      setReady(true);
    })();
  },[]);

  useEffect(()=>{ if(ready) sd("vcm_e",emps); },[emps,ready]);
  useEffect(()=>{ if(ready) sd("vcm_v",vacs); },[vacs,ready]);
  useEffect(()=>{ if(ready) sd("vcm_c",confs); },[confs,ready]);

  useEffect(()=>{
    const a=[];
    confs.forEach(r=>{
      const ids=r.employeeIds;
      for(let i=0;i<ids.length;i++) for(let j=i+1;j<ids.length;j++){
        vacs.filter(v=>v.employeeId===ids[i]&&v.status!=="rechazado").forEach(va=>{
          vacs.filter(v=>v.employeeId===ids[j]&&v.status!=="rechazado").forEach(vb=>{
            if(overlap(pd(va.startDate),pd(va.endDate),pd(vb.startDate),pd(vb.endDate))){
              const ea=emps.find(e=>e.id===ids[i]),eb=emps.find(e=>e.id===ids[j]);
              if(ea&&eb) a.push({id:`${va.id}-${vb.id}`,message:`${ea.name} y ${eb.name} se solapan (${va.startDate} → ${va.endDate})`,employeeIds:[ids[i],ids[j]]});
            }
          });
        });
      }
    });
    setAlerts(a);
  },[vacs,confs,emps]);

  const doSync = useCallback(async(e,v,c)=>{
    const url = urlRef.current;
    if(!url || url === "TU_URL_DE_GOOGLE_AQUI") return;
    setSyncState("syncing");
    try {
      await syncToSheet(url, e, v, c);
      const ts = new Date().toLocaleString("es-AR");
      setLastSync(ts);
      setSyncState("ok");
    } catch(err) {
      setSyncState("error");
    }
  },[]);

  useEffect(()=>{
    if(!ready || !scriptUrl || scriptUrl === "TU_URL_DE_GOOGLE_AQUI") return;
    setSyncState("pending");
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(()=>
      doSync(empsRef.current, vacsRef.current, confsRef.current), 2000
    );
    return ()=> clearTimeout(syncTimer.current);
  },[emps,vacs,confs,ready,scriptUrl]);

  if(!ready) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:P.bg,color:P.textMid,fontFamily:"Outfit,sans-serif"}}>Cargando Base de Datos…</div>;

  return (
    <div style={{minHeight:"100vh",background:P.bg,fontFamily:"Outfit,sans-serif",color:P.text}}>
      <Header alerts={alerts} tab={tab} setTab={setTab} syncState={syncState} lastSync={lastSync} hasUrl={scriptUrl && scriptUrl !== "TU_URL_DE_GOOGLE_AQUI"}/>
      <main style={{maxWidth:1120,margin:"0 auto",padding:"28px 20px"}}>
        {alerts.length>0&&tab!=="conflicts"&&<AlertBanner alerts={alerts} setTab={setTab}/>}
        {tab==="calendar"  && <CalendarView  emps={emps} vacs={vacs}/>}
        {tab==="requests"  && <RequestsView  emps={emps} vacs={vacs} setVacs={setVacs}/>}
        {tab==="employees" && <EmployeesView emps={emps} setEmps={setEmps} vacs={vacs}/>}
        {tab==="conflicts" && <ConflictsView emps={emps} confs={confs} setConfs={setConfs} alerts={alerts}/>}
        {tab==="stats"     && <StatsView     emps={emps} vacs={vacs}/>}
      </main>
    </div>
  );
}

function Header({alerts,tab,setTab,syncState,lastSync,hasUrl}){
  const TABS=[
    {id:"calendar", icon:"📅",label:"CALENDARIO"},
    {id:"requests", icon:"✉️",label:"SOLICITUDES"},
    {id:"employees",icon:"👤",label:"EMPLEADOS"},
    {id:"conflicts",icon:"⚡",label:"REGLAS",badge:alerts.length},
    {id:"stats",    icon:"📊",label:"ESTADÍSTICAS"}
  ];
  const dot={
    idle:    {bg:"#cbd5e1",label:hasUrl?"Listo":"Sin configurar"},
    pending: {bg:P.warn,   label:"Guardando en la nube…"},
    syncing: {bg:P.accent, label:"Sincronizando…"},
    ok:      {bg:P.success,label:"Base de Datos ✓"},
    error:   {bg:P.danger, label:"Error de red"},
  }[syncState]||{bg:"#cbd5e1",label:""};

  return (
    <header style={{background:P.surface,borderBottom:`1px solid ${P.border}`,boxShadow:`0 2px 12px ${P.shadow}`,position:"sticky",top:0,zIndex:100}}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
      <div style={{maxWidth:1120,margin:"0 auto",padding:"0 20px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:16,paddingBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{background:`linear-gradient(135deg,${P.accent},#c87b5a)`,borderRadius:10,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🌴</div>
            <div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:2,color:P.text,lineHeight:1}}>VACACIONES <span style={{color:P.accent}}>MANAGER</span></div>
              <div style={{fontSize:10,color:P.textSoft,letterSpacing:1}}>SISTEMA CENTRALIZADO</div>
            </div>
          </div>
          <div title={syncState==="ok"?`Último sync: ${lastSync}`:""} style={{display:"flex",alignItems:"center",gap:7,background:P.surfaceAlt,border:`1px solid ${P.border}`,borderRadius:20,padding:"5px 12px",fontSize:12,color:P.textMid}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:dot.bg,animation:(syncState==="syncing"||syncState==="pending")?"pulse 1s infinite":"none"}}/>
            <span style={{color:syncState==="ok"?P.success:syncState==="error"?P.danger:syncState==="pending"||syncState==="syncing"?P.accent:P.textSoft,fontWeight:600}}>
              {dot.label}
            </span>
          </div>
        </div>
        <nav style={{display:"flex",gap:2,overflowX:"auto"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",cursor:"pointer",padding:"9px 13px",fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:1.5,color:tab===t.id?P.accent:P.textMid,borderBottom:tab===t.id?`2px solid ${P.accent}`:"2px solid transparent",whiteSpace:"nowrap",position:"relative",transition:"color .15s"}}>
              <span style={{marginRight:5}}>{t.icon}</span>{t.label}
              {t.badge>0&&<span style={{position:"absolute",top:5,right:3,background:P.danger,color:"#fff",borderRadius:"50%",fontSize:9,width:15,height:15,display:"flex",alignItems:"center",justifyContent:"center"}}>{t.badge}</span>}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

function AlertBanner({alerts,setTab}){
  return (
    <div style={{background:"#fde8e8",border:`1px solid ${P.danger}`,borderRadius:10,padding:"14px 18px",marginBottom:22,display:"flex",alignItems:"flex-start",gap:12}}>
      <div style={{fontSize:20}}>🚨</div>
      <div style={{flex:1}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:1,color:"#c05050",marginBottom:4}}>{alerts.length} CONFLICTO{alerts.length>1?"S":""} DETECTADO{alerts.length>1?"S":""}</div>
        {alerts.slice(0,2).map(a=><div key={a.id} style={{fontSize:13,color:"#a04040",marginBottom:2}}>{a.message}</div>)}
        {alerts.length>2&&<div style={{fontSize:12,color:"#b05050"}}>+{alerts.length-2} más…</div>}
      </div>
      <button onClick={()=>setTab("conflicts")} style={{background:P.danger,color:"#fff",border:"none",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>Ver reglas →</button>
    </div>
  );
}

function CalendarView({emps,vacs}){
  const today=new Date();
  const [yr,setYr]=useState(today.getFullYear());
  const [mo,setMo]=useState(today.getMonth());
  const first=new Date(yr,mo,1),last=new Date(yr,mo+1,0);
  const pad=first.getDay();
  const cells=Array.from({length:Math.ceil((pad+last.getDate())/7)*7},(_,i)=>{ const d=i-pad+1; return(d>=1&&d<=last.getDate())?d:null; });
  const getV=d=>{ if(!d)return[]; const ds=`${yr}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; return vacs.filter(v=>v.status!=="rechazado"&&ds>=v.startDate&&ds<=v.endDate); };
  const prev=()=>{if(mo===0){setMo(11);setYr(y=>y-1);}else setMo(m=>m-1);};
  const next=()=>{if(mo===11){setMo(0);setYr(y=>y+1);}else setMo(m=>m+1);};
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <button onClick={prev} style={NB}>‹</button>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:3}}>{MONTHS[mo].toUpperCase()} <span style={{color:P.accent}}>{yr}</span></div>
        <button onClick={next} style={NB}>›</button>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:18}}>
        {emps.map(e=><div key={e.id} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:P.textMid,background:P.surface,padding:"4px 10px",borderRadius:20,border:`1px solid ${P.border}`}}><div style={{width:10,height:10,borderRadius:"50%",background:e.color}}/>{e.name}</div>)}
      </div>
      <div style={{background:P.surface,borderRadius:14,border:`1px solid ${P.border}`,overflow:"hidden",boxShadow:`0 2px 16px ${P.shadow}`}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
          {DSHORT.map(d=><div key={d} style={{textAlign:"center",padding:"10px 4px",fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:1.5,color:P.textSoft,borderBottom:`1px solid ${P.border}`,background:P.surfaceAlt}}>{d}</div>)}
          {cells.map((day,i)=>{
            const vd=getV(day);
            const isT=day===today.getDate()&&mo===today.getMonth()&&yr===today.getFullYear();
            const isW=day&&(new Date(yr,mo,day).getDay()===0||new Date(yr,mo,day).getDay()===6);
            return <div key={i} style={{minHeight:72,padding:6,background:!day?"transparent":isW?"#f9f4ee":P.surface,borderRight:`1px solid ${P.border}`,borderBottom:`1px solid ${P.border}`,outline:isT?`2px solid ${P.accent}`:"none",outlineOffset:"-2px"}}>
              {day&&<><div style={{fontSize:12,fontWeight:isT?700:400,color:isT?P.accent:isW?P.textSoft:P.textMid,marginBottom:4}}>{day}</div>
              {vd.map(v=>{const e=emps.find(x=>x.id===v.employeeId);return e?<div key={v.id} title={e.name} style={{background:e.color+"55",border:`1px solid ${e.color}`,borderRadius:4,padding:"1px 5px",fontSize:10,color:P.text,fontWeight:600,marginBottom:2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{e.name.split(" ")[0]}</div>:null;})}</>}
            </div>;
          })}
        </div>
      </div>
    </div>
  );
}

function RequestsView({emps,vacs,setVacs}){
  const [form,setF]=useState({employeeId:"",startDate:"",endDate:"",notes:""});
  const [filter,setFl]=useState("todos");
  const [err,setErr]=useState("");
  const submit=()=>{
    setErr("");
    if(!form.employeeId||!form.startDate||!form.endDate){setErr("Completá todos los campos.");return;}
    if(form.startDate>form.endDate){setErr("La fecha inicio debe ser anterior al fin.");return;}
    const days=wdays(pd(form.startDate),pd(form.endDate));
    setVacs(v=>[{id:uid(),...form,days,status:"aprobado",createdAt:new Date().toISOString()},...v]);
    setF({employeeId:"",startDate:"",endDate:"",notes:""});
  };
  const upd=(id,s)=>setVacs(vs=>vs.map(v=>v.id===id?{...v,status:s}:v));
  const del=(id)=>setVacs(vs=>vs.filter(v=>v.id!==id));
  const fil=filter==="todos"?vacs:vacs.filter(v=>v.status===filter);
  const ST={aprobado:{bg:"#e8f5ee",c:"#4a9e6e",l:"Aprobado"},pendiente:{bg:"#fef5e7",c:"#c09020",l:"Pendiente"},rechazado:{bg:"#fde8e8",c:"#c05050",l:"Rechazado"}};
  return (
    <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:24,alignItems:"start"}}>
      <div style={CS}>
        <ST2>Nueva Solicitud</ST2>
        <Lb>Empleado *</Lb>
        <select value={form.employeeId} onChange={e=>setF(f=>({...f,employeeId:e.target.value}))} style={IS}>
          <option value="">Seleccionar…</option>
          {emps.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <Lb>Fecha inicio *</Lb><input type="date" value={form.startDate} onChange={e=>setF(f=>({...f,startDate:e.target.value}))} style={IS}/>
        <Lb>Fecha fin *</Lb><input type="date" value={form.endDate} onChange={e=>setF(f=>({...f,endDate:e.target.value}))} style={IS}/>
        <Lb>Notas</Lb>
        <textarea value={form.notes} onChange={e=>setF(f=>({...f,notes:e.target.value}))} style={{...IS,height:62,resize:"vertical"}} placeholder="Opcional…"/>
        {form.startDate&&form.endDate&&form.startDate<=form.endDate&&<div style={{fontSize:12,color:P.textMid,marginBottom:10,background:P.surfaceAlt,padding:"6px 10px",borderRadius:6}}>📅 <strong>{wdays(pd(form.startDate),pd(form.endDate))}</strong> días hábiles</div>}
        {err&&<div style={{color:P.danger,fontSize:12,marginBottom:8}}>{err}</div>}
        <button onClick={submit} style={PB}>Agregar Solicitud</button>
      </div>
      <div>
        <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
          {["todos","aprobado","pendiente","rechazado"].map(s=><button key={s} onClick={()=>setFl(s)} style={{border:`1px solid ${filter===s?P.accent:P.border}`,background:filter===s?P.accent:"transparent",color:filter===s?"#fff":P.textMid,borderRadius:20,padding:"5px 16px",fontSize:12,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1,cursor:"pointer"}}>{s.toUpperCase()}</button>)}
        </div>
        {fil.length===0&&<Emp txt="No hay solicitudes."/>}
        {fil.map(v=>{
          const e=emps.find(x=>x.id===v.employeeId);const st=ST[v.status]||ST.pendiente;
          return <div key={v.id} style={{...CS,marginBottom:10,borderLeft:`4px solid ${e?.color||P.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17,letterSpacing:1}}>{e?.name||"Desconocido"}</div>
                <div style={{fontSize:13,color:P.textMid,marginTop:3}}>{v.startDate} → {v.endDate} · <strong>{v.days} días hábiles</strong></div>
                {v.notes&&<div style={{fontSize:12,color:P.textSoft,marginTop:4}}>{v.notes}</div>}
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
                <span style={{background:st.bg,color:st.c,fontSize:11,padding:"2px 10px",borderRadius:12,fontWeight:600}}>{st.l}</span>
                <div style={{display:"flex",gap:4}}>
                  {v.status!=="aprobado"&&<AB c={P.success} f={()=>upd(v.id,"aprobado")}>✓</AB>}
                  {v.status!=="pendiente"&&<AB c={P.warn} f={()=>upd(v.id,"pendiente")}>~</AB>}
                  {v.status!=="rechazado"&&<AB c={P.danger} f={()=>upd(v.id,"rechazado")}>✗</AB>}
                  <AB c={P.textSoft} f={()=>del(v.id)}>🗑</AB>
                </div>
              </div>
            </div>
          </div>;
        })}
      </div>
    </div>
  );
}

function EmployeesView({emps,setEmps,vacs}){
  const [form,setF]=useState({name:"",maxDays:30,color:ECOLS[0]});
  const [err,setErr]=useState("");
  const add=()=>{
    if(!form.name.trim()){setErr("El nombre es obligatorio.");return;}
    setEmps(e=>[...e,{id:uid(),name:form.name.trim(),maxDays:Number(form.maxDays),color:form.color}]);
    setF({name:"",maxDays:30,color:ECOLS[emps.length%ECOLS.length]});setErr("");
  };
  return (
    <div style={{display:"grid",gridTemplateColumns:"300px 1fr",gap:24,alignItems:"start"}}>
      <div style={CS}>
        <ST2>Nuevo Empleado</ST2>
        <Lb>Nombre *</Lb><input value={form.name} onChange={e=>setF(f=>({...f,name:e.target.value}))} style={IS} placeholder="Nombre completo"/>
        <Lb>Días máx./año</Lb><input type="number" value={form.maxDays} onChange={e=>setF(f=>({...f,maxDays:e.target.value}))} style={IS} min={1} max={60}/>
        <Lb>Color en el calendario</Lb>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
          {ECOLS.map(c=><div key={c} onClick={()=>setF(f=>({...f,color:c}))} style={{width:30,height:30,borderRadius:"50%",background:c,cursor:"pointer",border:`3px solid ${form.color===c?P.text:"transparent"}`}}/>)}
        </div>
        {err&&<div style={{color:P.danger,fontSize:12,marginBottom:8}}>{err}</div>}
        <button onClick={add} style={PB}>Agregar Empleado</button>
      </div>
      <div>
        {emps.length===0&&<Emp txt="No hay empleados aún."/>}
        {emps.map(e=>{
          const yr=new Date().getFullYear();
          const used=vacs.filter(v=>v.employeeId===e.id&&v.status!=="rechazado"&&v.startDate.startsWith(yr)).reduce((a,v)=>a+(v.days||0),0);
          const pct=Math.min(100,Math.round((used/e.maxDays)*100));
          return <div key={e.id} style={{...CS,marginBottom:10,borderLeft:`4px solid ${e.color}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <div style={{width:36,height:36,borderRadius:"50%",background:e.color+"55",border:`2px solid ${e.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:16}}>{e.name[0]}</div>
                  <div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17,letterSpacing:1}}>{e.name}</div><div style={{fontSize:12,color:P.textSoft}}>Máx. {e.maxDays} días/año</div></div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:P.textMid,marginBottom:5}}>
                  <span>Usados {new Date().getFullYear()}: <strong style={{color:used>e.maxDays?P.danger:P.success}}>{used} días</strong></span>
                  <span style={{color:P.textSoft}}>{pct}%</span>
                </div>
                <div style={{background:P.surfaceAlt,borderRadius:6,height:8}}><div style={{background:pct>=100?P.danger:e.color,borderRadius:6,height:8,width:`${pct}%`,transition:"width .4s"}}/></div>
              </div>
              <AB c={P.textSoft} f={()=>setEmps(x=>x.filter(a=>a.id!==e.id))}>🗑</AB>
            </div>
          </div>;
        })}
      </div>
    </div>
  );
}

function ConflictsView({emps,confs,setConfs,alerts}){
  const [sel,setSel]=useState([]);const [err,setErr]=useState("");
  const tog=id=>setSel(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const add=()=>{if(sel.length<2){setErr("Seleccioná al menos 2 empleados.");return;}setConfs(c=>[...c,{id:uid(),employeeIds:[...sel]}]);setSel([]);setErr("");};
  return (
    <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:24,alignItems:"start"}}>
      <div style={CS}>
        <ST2>Nueva Regla</ST2>
        <p style={{fontSize:13,color:P.textMid,marginBottom:14,lineHeight:1.5}}>Empleados que <strong>no pueden</strong> coincidir en vacaciones:</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
          {emps.length===0&&<div style={{fontSize:13,color:P.textSoft}}>Agregá empleados primero.</div>}
          {emps.map(e=><button key={e.id} onClick={()=>tog(e.id)} style={{padding:"6px 14px",borderRadius:20,fontSize:13,cursor:"pointer",fontWeight:600,background:sel.includes(e.id)?e.color+"33":"transparent",color:P.textMid,border:`2px solid ${sel.includes(e.id)?e.color:P.border}`}}>{e.name}</button>)}
        </div>
        {sel.length>=2&&<div style={{fontSize:12,color:P.textMid,marginBottom:10,background:P.surfaceAlt,padding:"6px 10px",borderRadius:6}}>⚡ {sel.map(id=>emps.find(e=>e.id===id)?.name).join(" y ")} no pueden coincidir.</div>}
        {err&&<div style={{color:P.danger,fontSize:12,marginBottom:8}}>{err}</div>}
        <button onClick={add} style={PB}>Agregar Regla</button>
      </div>
      <div>
        <ST2>Reglas activas</ST2>
        {confs.length===0&&<Emp txt="No hay reglas definidas."/>}
        {confs.map(r=>{
          const ra=alerts.filter(a=>r.employeeIds.every(id=>a.employeeIds.includes(id)));
          return <div key={r.id} style={{...CS,marginBottom:10,borderLeft:`4px solid ${ra.length>0?P.danger:P.success}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,letterSpacing:1}}>{r.employeeIds.map(id=>emps.find(e=>e.id===id)?.name||"?").join(" ⟷ ")}</div>
                {ra.length>0?ra.map(a=><div key={a.id} style={{fontSize:12,color:P.danger,marginTop:4}}>⚠️ {a.message}</div>):<div style={{fontSize:12,color:P.success,marginTop:4}}>✓ Sin conflictos activos</div>}
              </div>
              <AB c={P.textSoft} f={()=>setConfs(c=>c.filter(x=>x.id!==r.id))}>🗑</AB>
            </div>
          </div>;
        })}
        {alerts.length>0&&<div style={{...CS,marginTop:20,background:"#fde8e8",borderColor:P.danger}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:1,color:"#c05050",marginBottom:12}}>🚨 CONFLICTOS ACTIVOS ({alerts.length})</div>
          {alerts.map(a=><div key={a.id} style={{fontSize:13,color:"#a04040",marginBottom:8,padding:"6px 0",borderBottom:`1px solid ${P.danger}33`}}>⚠️ {a.message}</div>)}
        </div>}
      </div>
    </div>
  );
}

function StatsView({emps,vacs}){
  const years=[...new Set(vacs.map(v=>v.startDate?.slice(0,4)))].sort().reverse();
  const [yr,setYr]=useState(String(new Date().getFullYear()));
  const yv=vacs.filter(v=>v.startDate?.startsWith(yr)&&v.status!=="rechazado");
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:24}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:2}}>ESTADÍSTICAS</div>
        <select value={yr} onChange={e=>setYr(e.target.value)} style={{...IS,width:"auto",margin:0}}>
          {years.length===0&&<option value={yr}>{yr}</option>}
          {years.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {emps.length===0&&<Emp txt="Agregá empleados primero."/>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:16}}>
        {emps.map(e=>{
          const ev=yv.filter(v=>v.employeeId===e.id);
          const used=ev.reduce((a,v)=>a+(v.days||0),0);
          const rem=Math.max(0,e.maxDays-used);
          const pct=Math.min(100,Math.round((used/e.maxDays)*100));
          return <div key={e.id} style={{...CS,borderTop:`4px solid ${e.color}`}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{width:42,height:42,borderRadius:"50%",background:e.color+"44",border:`2px solid ${e.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:18}}>{e.name[0]}</div>
              <div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:1}}>{e.name}</div><div style={{fontSize:11,color:P.textSoft}}>{yr}</div></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
              {[{l:"Usados",v:used,c:e.color},{l:"Máximo",v:e.maxDays,c:P.textMid},{l:"Restantes",v:rem,c:rem===0?P.danger:P.success}].map(s=>(
                <div key={s.l} style={{background:P.surfaceAlt,borderRadius:8,padding:"10px 6px",textAlign:"center"}}>
                  <div style={{fontSize:24,fontFamily:"'Bebas Neue',sans-serif",color:s.c,letterSpacing:1}}>{s.v}</div>
                  <div style={{fontSize:10,color:P.textSoft,letterSpacing:0.5}}>{s.l.toUpperCase()}</div>
                </div>
              ))}
            </div>
            <div style={{background:P.surfaceAlt,borderRadius:6,height:8}}><div style={{background:pct>=100?P.danger:e.color,borderRadius:6,height:8,width:`${pct}%`,transition:"width .4s"}}/></div>
            <div style={{fontSize:11,color:P.textSoft,marginTop:4,textAlign:"right"}}>{pct}% utilizado</div>
            {ev.length>0&&<div style={{marginTop:12,borderTop:`1px solid ${P.border}`,paddingTop:10}}>
              {ev.map(v=><div key={v.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:P.textMid,marginBottom:4}}><span>{v.startDate} → {v.endDate}</span><strong>{v.days}d</strong></div>)}
            </div>}
          </div>;
        })}
      </div>
    </div>
  );
}

const ST2 = ({children}) => <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:2,color:P.text,marginBottom:14}}>{children}</div>;
const Lb  = ({children}) => <div style={{fontSize:11,fontWeight:600,color:P.textSoft,letterSpacing:1,marginBottom:4,textTransform:"uppercase"}}>{children}</div>;
const Emp = ({txt})      => <div style={{textAlign:"center",padding:"48px 20px",color:P.textSoft,fontSize:14,background:P.surface,borderRadius:12,border:`1px dashed ${P.border}`}}>{txt}</div>;
const AB  = ({c,f,children}) => <button onClick={f} style={{background:c+"18",color:c,border:`1px solid ${c}44`,borderRadius:5,padding:"4px 8px",cursor:"pointer",fontSize:12}}>{children}</button>;

const CS = {background:P.surface,border:`1px solid ${P.border}`,borderRadius:12,padding:18,boxShadow:`0 2px 12px ${P.shadow}`};
const IS = {width:"100%",background:P.surfaceAlt,border:`1px solid ${P.border}`,borderRadius:8,color:P.text,padding:"9px 12px",fontSize:13,marginBottom:12,boxSizing:"border-box",outline:"none",fontFamily:"Outfit,sans-serif"};
const PB = {width:"100%",background:P.accent,color:"#fff",border:"none",borderRadius:8,padding:"11px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1.5};
const NB = {background:P.surface,border:`1px solid ${P.border}`,color:P.text,borderRadius:8,padding:"6px 16px",cursor:"pointer",fontSize:20,boxShadow:`0 1px 4px ${P.shadow}`};