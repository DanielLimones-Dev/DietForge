"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ShieldCheck, Users, Clock, Plus, RefreshCw, Search, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSubscription } from "@/contexts/SubscriptionContext";
type Coach={email:string;user_id:string|null;is_admin:boolean;suspended:boolean;confirmed:boolean;expires_at:string|null;trial_started_at:string|null;clients:number;plans:number};
type History={id:number;email:string;action:string;months:number|null;note:string;created_at:string};
const date=(value:string|null)=>value?new Date(value).toLocaleDateString("es-MX",{day:"numeric",month:"short",year:"numeric"}):"Sin periodo";
function state(c:Coach){if(c.is_admin)return "Administrador";if(c.suspended)return "Suspendido";const until=c.expires_at??(c.trial_started_at?new Date(Date.parse(c.trial_started_at)+15*86400000).toISOString():null);return until?(Date.parse(until)>Date.now()?"Activo":"Vencido"):"Pendiente";}
export function AdminPanel(){
 const {status}=useSubscription();
 const [coaches,setCoaches]=useState<Coach[]>([]),[history,setHistory]=useState<History[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [query,setQuery]=useState(""),[selected,setSelected]=useState<Coach|null>(null),[adding,setAdding]=useState(false);
 const [email,setEmail]=useState(""),[months,setMonths]=useState(1),[note,setNote]=useState("");
 const [confirmingDelete,setConfirmingDelete]=useState(false),[deleteConfirmation,setDeleteConfirmation]=useState("");
 const [enteringEmail,setEnteringEmail]=useState(""),[removingEmail,setRemovingEmail]=useState("");
 const request=useRef<{payload:string;id:string}|null>(null);
 const rowAnimationTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const reload=useCallback(async()=>{try{const {data,error}=await supabase.rpc("dietforge_admin_list");if(error)throw error;setCoaches(data.coaches);setHistory(data.history);}catch{setError("No pudimos cargar el panel. Vuelve a intentar.");}finally{setLoading(false);}},[]);
 useEffect(()=>{
  if(!status.isAdmin)return;
  let live=true;
  void supabase.rpc("dietforge_admin_list").then(({data,error})=>{
   if(!live)return;
   if(error)setError("No pudimos cargar el panel. Vuelve a intentar.");else{setCoaches(data.coaches);setHistory(data.history);}
   setLoading(false);
  });
  return ()=>{live=false;};
 },[status.isAdmin]);
 useEffect(()=>()=>{if(rowAnimationTimer.current)clearTimeout(rowAnimationTimer.current);},[]);
 function open(coach:Coach|null){setSelected(coach);setAdding(!coach);setEmail(coach?.email??"");setMonths(1);setNote("");setConfirmingDelete(false);setDeleteConfirmation("");setError("");setNotice("");request.current=null;}
 async function save(action:"renew"|"suspend"|"resume"){
  setBusy(true);setError("");setNotice("");
  const normalized=email.trim().toLowerCase();
  const payload=JSON.stringify({email:normalized,action,months:action==="renew"?months:null,note:note.trim()});
  if(request.current?.payload!==payload)request.current={payload,id:crypto.randomUUID()};
  try{
   if(adding){
    const {data:{session}}=await supabase.auth.getSession();
    const response=await fetch("/api/admin/coaches",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session?.access_token},body:JSON.stringify({email:normalized,months,note:note.trim(),requestId:request.current.id})});
    const result=await response.json();if(!response.ok)throw Error(result.error);
    setEnteringEmail(normalized);
    setNotice(result.emailSent?`Coach activado. Enviamos a ${normalized} la invitación para validar su correo y crear su contraseña.`:"El correo ya estaba registrado. Actualizamos su periodo; puede iniciar sesión o recuperar su contraseña.");
   }else{
    const {error}=await supabase.rpc("dietforge_admin_set_access",{p_email:normalized,p_action:action,p_months:action==="renew"?months:null,p_note:note.trim(),p_request_id:request.current.id});
    if(error)throw Error("No se pudo guardar. Reintenta la misma operación.");
   }
   request.current=null;setAdding(false);setSelected(null);if(!adding)setNotice(action==="renew"?"Acceso actualizado. El coach puede iniciar sesión con su contraseña.":action==="suspend"?"Acceso suspendido. Los datos se conservan.":"Suspensión retirada. Se conserva el vencimiento del periodo.");await reload();
   if(adding){rowAnimationTimer.current=setTimeout(()=>setEnteringEmail(""),700);}
  }catch(e){setError(e instanceof Error?e.message:"No se pudo guardar.");}finally{setBusy(false);}
 }
 async function removeCoach(){
  if(!selected||deleteConfirmation.trim().toLowerCase()!==selected.email)return;
  setBusy(true);setError("");setNotice("");
  try{
   const {data:{session}}=await supabase.auth.getSession();
   const response=await fetch("/api/admin/coaches",{method:"DELETE",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session?.access_token},body:JSON.stringify({email:selected.email,requestId:crypto.randomUUID()})});
   const result=await response.json();if(!response.ok)throw Error(result.error);
   const removedEmail=selected.email;
   setRemovingEmail(removedEmail);setSelected(null);setConfirmingDelete(false);setDeleteConfirmation("");setNotice(`Eliminamos la cuenta y los datos de ${removedEmail}.`);
   const reduceMotion=typeof window!=="undefined"&&window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
   await new Promise(resolve=>setTimeout(resolve,reduceMotion?0:480));
   setCoaches(current=>current.filter(coach=>coach.email!==removedEmail));setRemovingEmail("");await reload();
  }catch(e){setError(e instanceof Error?e.message:"No se pudo eliminar la cuenta.");}finally{setBusy(false);}
 }
 if(!status.isAdmin)return <section className="df-card p-8"><ShieldCheck/><h1 className="text-2xl font-semibold mt-4">Acceso exclusivo del administrador</h1><p className="df-muted mt-2">Tu cuenta no tiene permisos para administrar la plataforma.</p></section>;
 const users=coaches.filter(c=>!c.is_admin);
 const metrics=[{label:"Coaches registrados",value:users.filter(c=>c.user_id).length,detail:`${users.length} accesos configurados`,icon:Users,tone:"green"},{label:"Accesos activos",value:users.filter(c=>state(c)==="Activo").length,detail:"Con periodo vigente",icon:ShieldCheck,tone:"teal"},{label:"Vencidos o suspendidos",value:users.filter(c=>["Vencido","Suspendido"].includes(state(c))).length,detail:"Requieren revisión",icon:Clock,tone:"amber"},{label:"Primer acceso pendiente",value:users.filter(c=>!c.confirmed).length,detail:"Correo por confirmar",icon:RefreshCw,tone:"blue"}];
 return <div className="admin-page">
  <header className="admin-header"><div><span className="admin-master-pill"><i/>Panel maestro de administración</span><h1>Gestión de coaches y periodos de acceso</h1><p>Alta de cuentas, renovaciones, suspensiones, eliminaciones y actividad administrativa desde un solo lugar.</p></div><button className="df-button" disabled={busy} onClick={()=>open(null)}><Plus size={18}/>Dar de alta coach</button></header>
  <div className="admin-metrics">{metrics.map(m=><div className={`admin-metric metric-${m.tone}`} key={m.label}><div><span>{m.label}</span><strong>{m.value}</strong><small>{m.detail}</small></div><span><m.icon size={19}/></span></div>)}</div>
  {error&&<div role="alert" className="rounded-xl bg-red-50 text-red-800 p-4">{error}</div>}
  {notice&&<div role="status" className="df-notice">{notice}</div>}
  {(adding||selected)&&<section className="admin-editor animate-slide-down">
   <h2 className="text-xl font-semibold">{adding?"Dar de alta y activar coach":"Gestionar acceso"}</h2>
   <p className="df-muted text-sm mt-2">Registra el periodo pagado. Si sigue activo, se suma al vencimiento; si venció, comienza hoy.</p>
   <form className="mt-5 space-y-4" onSubmit={(e:FormEvent)=>{e.preventDefault();void save("renew");}}>
    <fieldset disabled={busy} className="grid md:grid-cols-3 gap-4"><label className="df-label">Correo del coach<input className="df-input mt-2" required type="email" maxLength={254} readOnly={!adding} value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="df-label">Periodo pagado<select className="df-input mt-2" value={months} onChange={e=>setMonths(Number(e.target.value))}><option value={1}>1 mes</option><option value={3}>3 meses</option><option value={12}>1 año</option></select></label><label className="df-label">Referencia o nota (opcional)<input className="df-input mt-2" maxLength={500} value={note} onChange={e=>setNote(e.target.value)} placeholder="Ej. transferencia de septiembre"/></label></fieldset>
    {selected&&<p className="text-sm df-muted">Vencimiento actual: <strong>{date(selected.expires_at)}</strong> · {state(selected)}</p>}
    <div className="flex flex-wrap gap-3"><button disabled={busy} className="df-button">{busy?"Guardando…":adding?"Activar y enviar invitación":"Registrar pago y renovar"}</button>{selected&&<button type="button" disabled={busy} className="df-button-secondary" onClick={()=>void save(selected.suspended?"resume":"suspend")}>{selected.suspended?"Retirar suspensión":"Suspender acceso"}</button>}<button type="button" className="df-button-secondary" disabled={busy} onClick={()=>{setAdding(false);setSelected(null);}}>Cerrar</button>{selected&&<button type="button" className="df-button-danger" disabled={busy} onClick={()=>setConfirmingDelete(true)}><Trash2 size={15}/>Eliminar coach</button>}</div>
    {adding?<ol className="care-access-steps"><li><b>1</b><span><strong>Das de alta</strong><br/>Autorizas su correo y periodo.</span></li><li><b>2</b><span><strong>DietForge invita</strong><br/>Enviamos el enlace a su correo.</span></li><li><b>3</b><span><strong>El coach activa</strong><br/>Valida el correo y crea su contraseña.</span></li></ol>:<p className="text-xs df-muted">Una renovación amplía el acceso y conserva la contraseña actual.</p>}
    {selected&&confirmingDelete&&<div className="admin-delete-confirm"><AlertTriangle size={20}/><div><strong>Eliminación permanente</strong><p>Se borrarán la cuenta, clientes, planes, rutinas y videos. Escribe <b>{selected.email}</b> para confirmar.</p><input className="df-input" aria-label="Confirmar correo para eliminar" autoComplete="off" value={deleteConfirmation} onChange={e=>setDeleteConfirmation(e.target.value)} placeholder={selected.email}/><div><button type="button" className="df-button-danger" disabled={busy||deleteConfirmation.trim().toLowerCase()!==selected.email} onClick={()=>void removeCoach()}>{busy?"Eliminando…":"Eliminar definitivamente"}</button><button type="button" className="df-button-secondary" disabled={busy} onClick={()=>{setConfirmingDelete(false);setDeleteConfirmation("");}}>Cancelar</button></div></div></div>}
   </form>
  </section>}
  <section className="admin-directory"><div className="admin-directory-head"><div><p className="df-eyebrow">DIRECTORIO</p><h2>Coaches y accesos</h2></div><div className="admin-search"><Search size={17}/><input aria-label="Buscar coach" placeholder="Buscar por correo…" value={query} onChange={e=>setQuery(e.target.value)}/><button aria-label="Actualizar directorio" disabled={loading||busy} onClick={()=>void reload()}><RefreshCw size={16}/></button></div></div>
   <div className="overflow-x-auto"><table className="df-table"><thead><tr><th>Cuenta</th><th>Estado</th><th>Vencimiento</th><th>Clientes / planes</th><th>Acceso</th></tr></thead><tbody>{coaches.filter(c=>c.email.includes(query.toLowerCase())).map(c=><tr key={c.email} className={`admin-coach-row ${enteringEmail===c.email?"is-entering":""} ${removingEmail===c.email?"is-removing":""}`}><td><span className="font-medium">{c.email}</span><p className="text-xs df-muted mt-1">{!c.user_id?"Pendiente de alta":c.confirmed?"Correo confirmado":"Pendiente de primer acceso"}</p></td><td><span className={"df-badge "+(state(c)==="Activo"||c.is_admin?"df-badge-green":"")}>{state(c)}</span></td><td>{c.is_admin?"Permanente":date(c.expires_at)}</td><td>{c.clients} / {c.plans}</td><td>{!c.is_admin&&<button className="df-button-secondary" disabled={busy} onClick={()=>open(c)}>Gestionar</button>}</td></tr>)}</tbody></table></div>{loading&&<p role="status" className="p-5 df-muted">Actualizando cuentas…</p>}{!loading&&!coaches.length&&<p className="p-6 df-muted">Todavía no hay cuentas para mostrar.</p>}
  </section>
  <section className="admin-history"><div><p className="df-eyebrow">AUDITORÍA</p><h2>Historial administrativo</h2><p>Últimos 100 movimientos. Cada renovación conserva su referencia.</p></div><div className="admin-history-list">{history.map(h=><div key={h.id}><span className={`admin-history-icon ${h.action}`}>{h.action==="delete"?<Trash2 size={14}/>:<RefreshCw size={14}/>}</span><div><strong>{h.email}</strong><p>{h.action==="renew"?"Renovación · "+(h.months===12?"1 año":h.months+" mes"+(h.months===1?"":"es")):h.action==="suspend"?"Acceso suspendido":h.action==="delete"?"Coach eliminado":"Suspensión retirada"}{h.note?" · "+h.note:""}</p></div><time>{date(h.created_at)}</time></div>)}{!history.length&&<p className="df-muted text-sm py-4">Los movimientos aparecerán aquí al registrar el primer cambio.</p>}</div></section>
 </div>;
}
