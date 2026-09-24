'use client';
import Link from 'next/link';
import {PortalMenus} from './diet-menus/PortalMenus';
import {tabKeys} from './diet-menus/shared';
import {useEffect,useState,useCallback,useRef} from 'react';
import {supabase} from '@/lib/supabase';
import {db,retryCloudSave} from '@/lib/db';
import {readPortal,grantPortal,memberships,writeActivity} from '@/lib/client-portal';
import {SessionTracker} from './SessionTracker';
import {CareAgenda} from './CareAgenda';
import {trainingDateValue} from '@/lib/training';
import {usePortalSync} from '@/lib/use-portal-sync';
import {PortalFailure,portalFailure} from '@/lib/portal-errors';
import {PortalCheckIn} from './PortalCheckIn';
import {Bell,Check,X,Sun,Moon,Utensils} from 'lucide-react';
import {useDietNotice} from '@/lib/use-diet-notice';
import {foodRatio} from '@/lib/meal-day';
import {PortalMesocycle} from './PortalMesocycle';
const mealNames:Record<string,string>={pre_workout:'Pre-Entreno',intra_workout:'Intra-Entreno',post_workout:'Post-Entreno',meal1:'Comida 1',meal2:'Comida 2',meal3:'Comida 3',meal4:'Comida 4',meal5:'Comida 5',meal6:'Comida 6'};
type ClientCareProps={clientId:number;owner?:string;coach?:boolean;initialTab?:string;showAccess?:boolean;agendaOnly?:boolean;targetCheckIn?:string};
export function ClientCare(props:ClientCareProps){
 return <ClientCareContent key={`${props.owner??'coach'}:${props.clientId}:${!!props.coach}:${props.showAccess!==false}`} {...props}/>;
}
function ClientCareContent({clientId,owner:providedOwner,coach=false,initialTab='training',showAccess=true,agendaOnly=false,targetCheckIn}:ClientCareProps){
 const [dietTab,setDietTab]=useState<'plan'|'menus'>('plan');
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [email,setEmail]=useState(coach?db.getClient(clientId)?.email??'':'');const [enabled,setEnabled]=useState(false);const [tab,setTab]=useState(initialTab);const [date,setDate]=useState(trainingDateValue());
 const emailEdited=useRef(false);const accessVersion=useRef(0);
 const read=useCallback(async()=>{
  let id=providedOwner;
  if(!id){const {data,error}=await supabase.auth.getUser();if(error)throw portalFailure(error);id=data.user?.id;}
  if(!id)throw new PortalFailure('session','Inicia sesión para consultar el expediente.');
  const result=await readPortal(id,clientId);
  return {id,result:coach?{...result,trainingPrograms:db.getTrainingPrograms(clientId)}:result};
 },[providedOwner,clientId,coach]);
 const sync=usePortalSync(read);
 const owner=sync.data?.id??providedOwner??'';const data=sync.data?.result??null;
 const load=sync.reload;
 // Access metadata is independent from the polling lane and must never reset an edited email.
 useEffect(()=>{
  if(!coach||!showAccess||!owner)return;
  let live=true;const version=accessVersion.current;
  void memberships().then(entries=>{
   if(!live||version!==accessVersion.current)return;
   const entry=entries.find(m=>m.owner_id===owner&&m.client_id===clientId);
   setEnabled(entry?.enabled??false);if(entry&&!emailEdited.current)setEmail(entry.email);
  }).catch(error=>{if(live&&version===accessVersion.current)setMessage(portalFailure(error).message);});
  return ()=>{live=false;};
 },[coach,showAccess,owner,clientId]);
 const dietNotice=useDietNotice(owner,clientId,!coach&&!agendaOnly&&!sync.restricted);
 const markViewed=useCallback(async(id:string)=>{if(!coach)return;const {error}=await supabase.rpc('dietforge_notification_seen',{c:clientId,i:id});if(error){setMessage('Check-in abierto. No se pudo marcar la notificación como leída.');throw error;}},[coach,clientId]);
 async function access(enable:boolean){accessVersion.current++;setBusy(true);try{await retryCloudSave();await grantPortal(clientId,email,enable);setEnabled(enable);setMessage(enable?'Acceso habilitado. Comparte el enlace del portal con el cliente.':'Acceso revocado.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 async function meal(plan:number,mealTime:string,rest:boolean,complete:boolean){setBusy(true);try{const existing=data?.activity.find(a=>a.kind==='meal'&&a.data.plan_id===plan&&a.data.meal_time===mealTime&&a.data.date===date&&a.data.rest===rest);await writeActivity(owner,clientId,{id:existing?.id??crypto.randomUUID(),kind:'meal',data:{date,plan_id:plan,meal_time:mealTime,rest,completed:complete}});await load();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 const syncNotice=<div role="status" className={sync.needsAttention?'care-notice':undefined}><span>{sync.message}</span>{sync.needsAttention&&!sync.offline&&<button onClick={()=>void load()}>Reintentar sincronización</button>}{sync.error?.kind==='session'&&<Link href="/">Ir a iniciar sesión</Link>}</div>;
 if(agendaOnly)return <>{syncNotice}{message&&<p role="status" className="care-notice">{message}</p>}{!sync.restricted&&<CareAgenda owner={owner} data={data} clientName={coach?db.getClient(clientId)?.name:undefined} coach={coach} onSaved={()=>void load()} entrance/>}</>;
 return <div className="care-page"><header className="care-card care-heading"><div><span className="training-kicker">{coach?'SEGUIMIENTO DEL CLIENTE':'MI ESPACIO'}</span><h1>{data?.client.name??(sync.error?'Expediente no disponible':'Cargando expediente…')}</h1><p>Dieta, entrenamiento y progreso en un solo lugar.</p></div>{syncNotice}</header>
 {coach&&showAccess&&<section className="care-card"><h2>Acceso del cliente</h2><p>{enabled?'Habilitado':'Sin acceso activo'} · Este paso es independiente de la Agenda.</p><ol className="care-access-steps"><li><b>1</b><span>Confirma el correo y pulsa <strong>Habilitar acceso</strong>.</span></li><li><b>2</b><span>Copia y comparte el enlace del portal.</span></li><li><b>3</b><span>El cliente valida su correo una vez; después entra con contraseña.</span></li></ol><p>Ahí puede consultar dieta y entrenamiento y registrar su avance. Solo el coach modifica la planificación.</p><div className="care-form care-access-form"><label>Correo autorizado<input type="email" value={email} onChange={e=>{emailEdited.current=true;setEmail(e.target.value);}}/></label><button disabled={busy||!email} onClick={()=>void access(true)}>Habilitar acceso</button><button disabled={busy||!enabled} onClick={()=>void access(false)}>Revocar acceso</button><a className="care-portal-link" href="/portal" target="_blank" rel="noopener noreferrer">Abrir portal</a><button onClick={()=>void navigator.clipboard.writeText(window.location.origin+'/portal').then(()=>setMessage('Enlace copiado.')).catch(()=>setMessage('Copia el enlace desde Abrir portal.'))}>Copiar enlace</button></div></section>}
 {message&&<p role="status" className="care-notice">{message}</p>}
 <nav className="care-tabs" aria-label="Secciones del expediente">{[['training','Entrenamiento'],['diet','Comida'],['progress','Progreso'],['agenda','Agenda']].map(([key,label])=><button key={key} aria-current={tab===key?'page':undefined} className={tab===key?'selected':''} onClick={()=>setTab(key)}>{label}{key==='diet'&&dietNotice.pending&&<span className="care-tab-badge" aria-label="Ajuste de dieta sin leer"><Bell size={13}/><span>Nuevo</span></span>}</button>)}</nav>
 {data&&<>{<div className="care-tab-panel" hidden={tab!=='training'}>{!coach&&<PortalMesocycle programs={data.trainingPrograms}/>}<SessionTracker key={`${owner}-${clientId}`} owner={owner} clientId={clientId} programs={data.trainingPrograms} activity={data.activity} onSaved={()=>void load()} clientMode={!coach}/></div>}
 {tab==='agenda'&&<CareAgenda owner={owner} data={data} coach={coach} onSaved={()=>void load()}/>}
 {tab==='diet'&&<><nav className="dm-diet-tabs" aria-label="Opciones de alimentación" role="tablist" onKeyDown={tabKeys}><button role="tab" id="portal-plan-tab" aria-selected={dietTab==='plan'} aria-controls="portal-plan-panel" tabIndex={dietTab==='plan'?0:-1} onClick={()=>setDietTab('plan')}>Plan de alimentación</button><button role="tab" id="portal-menus-tab" aria-selected={dietTab==='menus'} aria-controls="portal-menus-panel" tabIndex={dietTab==='menus'?0:-1} onClick={()=>setDietTab('menus')}>Mis menús</button></nav><div role="tabpanel" id="portal-plan-panel" aria-labelledby="portal-plan-tab" hidden={dietTab!=='plan'}><section className="care-card care-diet"><header><span className="training-kicker">TU ALIMENTACIÓN</span><h2>Mis planes de alimentación</h2></header>{dietNotice.pending&&<div className="care-diet-notice" role="status"><Bell size={20}/><div><strong>Tu coach hizo un ajuste en tu alimentación</strong><p>Revisa las comidas y cantidades actualizadas antes de continuar con tu plan.</p>{dietNotice.error&&<p role="alert">{dietNotice.error}</p>}</div><button aria-label="Cerrar aviso de ajuste" disabled={dietNotice.closing} onClick={()=>void dietNotice.close()}><X size={18}/></button></div>}{dietNotice.failed&&<p role="status">No pudimos consultar los avisos de ajustes. Reintentando automáticamente.</p>}<label>Fecha del registro<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>{!data.mealPlans.length&&<p>No hay dietas asignadas.</p>}{data.mealPlans.map(plan=><details key={plan.id} className="care-inset care-diet-plan"><summary>{plan.name} · {plan.total_kcal} kcal</summary><div className="care-diet-columns">{(['normal','rest'] as const).map(type=>{const items=data.mealPlanItems.filter(i=>i.meal_plan_id===plan.id&&(i.day_type??'normal')===type);if(!items.length)return null;return <div key={type} className={`care-diet-column care-diet-column-${type}`}><header>{type==='rest'?<Moon size={19} aria-hidden="true"/>:<Sun size={19} aria-hidden="true"/>}<div><h3>{type==='rest'?'Rest Day':'Plan Normal'}</h3><span>{type==='rest'?'Día de descanso':'Día de entrenamiento'}</span></div><small>{new Set(items.map(i=>i.meal_time)).size} comidas</small></header>{[...new Set(items.map(i=>i.meal_time))].map(time=>{const done=data.activity.some(a=>a.kind==='meal'&&a.data.plan_id===plan.id&&a.data.meal_time===time&&a.data.date===date&&a.data.rest===(type==='rest')&&a.data.completed);return <article className="care-inset care-meal" key={time}><h4><Utensils size={14} aria-hidden="true"/>{mealNames[time]??time.replace(/_/g,' ')}</h4>{items.filter(i=>i.meal_time===time).map(i=>{const food=data.foods.find(f=>f.id===i.food_id);return <p key={i.id}>{food?.name??'Alimento'} · {i.quantity} {i.serving_unit}{food?` · ${Math.round(food.kcal*foodRatio(i.quantity,i.serving_unit,food.serving_size))} kcal`:''}</p>;})}<button className={done?'care-meal-completed':''} aria-pressed={!!done} disabled={busy} onClick={()=>void meal(plan.id,time,type==='rest',!done)}>{done&&<Check size={15}/>} {done?'Completada · desmarcar':'Marcar comida completada'}</button></article>;})}</div>;})}</div></details>)}</section></div>{dietTab==='menus'&&<div role="tabpanel" id="portal-menus-panel" aria-labelledby="portal-menus-tab"><PortalMenus key={`${owner}:${clientId}`} owner={owner} clientId={clientId} coach={coach}/></div>}</>}
 {<div className="care-tab-panel" hidden={tab!=='progress'}><PortalCheckIn key={`${owner}-${clientId}`} owner={owner} clientId={clientId} activity={data.activity} coach={coach} targetId={tab==='progress'?targetCheckIn:undefined} onViewed={markViewed} onSaved={()=>void load()}/>{data.measurements.length>0&&<section className="care-card"><h3>Evaluaciones del coach</h3><div className="care-table-wrap"><table><thead><tr><th>Fecha</th><th>Peso</th><th>Grasa corporal</th></tr></thead><tbody>{data.measurements.map(m=><tr key={m.id}><td>{m.date.slice(0,10)}</td><td>{m.weight} kg</td><td>{m.body_fat!=null?`${m.body_fat}%`:'Sin registrar'}</td></tr>)}</tbody></table></div></section>}</div>}</>}
 </div>;
}
