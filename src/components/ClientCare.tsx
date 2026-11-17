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
import type {Activity} from '@/lib/training-tracking';
import {usePortalSync} from '@/lib/use-portal-sync';
import {PortalFailure,portalFailure} from '@/lib/portal-errors';
import {PortalCheckIn} from './PortalCheckIn';
import {CoachCheckInInbox} from './CoachCheckInInbox';
import {useDietNotice} from '@/lib/use-diet-notice';
import {PortalMesocycle} from './PortalMesocycle';
import {PortalDietCard,PortalPublishDrafts,PortalTabs} from './portal/PortalParts';
import {CalendarDays,Salad,TrendingUp} from 'lucide-react';
type ClientCareProps={clientId:number;owner?:string;coach?:boolean;initialTab?:string;showAccess?:boolean;agendaOnly?:boolean;targetCheckIn?:string};
export function ClientCare(props:ClientCareProps){
 return <ClientCareContent key={`${props.owner??'coach'}:${props.clientId}:${!!props.coach}:${props.showAccess!==false}`} {...props}/>;
}
function ClientCareContent({clientId,owner:providedOwner,coach=false,initialTab,showAccess=true,agendaOnly=false,targetCheckIn}:ClientCareProps){
 const [dietTab,setDietTab]=useState<'plan'|'menus'>('plan');
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [email,setEmail]=useState(coach?db.getClient(clientId)?.email??'':'');const [enabled,setEnabled]=useState(false);const [tab,setTab]=useState(initialTab??(coach?'training':'diet'));const [date,setDate]=useState(trainingDateValue());
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
 // Entering Comida revalidates immediately: foods the coach just saved appear without a reload,
 // even if the polling lane was paused (hidden tab, terminal read error or backoff).
 // The first render is already covered by the initial read, so it does not duplicate it.
 const dietLoaded=useRef(false);
 useEffect(()=>{
  if(!dietLoaded.current){dietLoaded.current=true;return;}
  if(tab==='diet')void load();
 },[tab,load]);
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
 const saveActivity=useCallback(async(activity:Activity)=>{await writeActivity(owner,clientId,activity);},[owner,clientId]);
 async function access(enable:boolean){accessVersion.current++;setBusy(true);try{await retryCloudSave();await grantPortal(clientId,email,enable);setEnabled(enable);setMessage(enable?'Acceso habilitado. Comparte el enlace del portal con el cliente.':'Acceso revocado.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 async function publishProgram(id:number){
  // Drafts stay hidden from the portal until the coach publishes them.
  setBusy(true);setMessage('');
  try{const saved=db.updateTrainingProgram(id,{status:'active'});if(!saved)throw new Error('No encontramos la rutina. Recarga el expediente.');await retryCloudSave();await load();setMessage('Rutina publicada. El cliente ya puede verla en su portal.');}
  catch(e){setMessage((e as Error).message);}
  finally{setBusy(false);}
 }
 async function meal(plan:number,mealTime:string,rest:boolean,complete:boolean){setBusy(true);try{const existing=data?.activity.find(a=>a.kind==='meal'&&a.data.plan_id===plan&&a.data.meal_time===mealTime&&a.data.date===date&&a.data.rest===rest);await writeActivity(owner,clientId,{id:existing?.id??crypto.randomUUID(),kind:'meal',data:{date,plan_id:plan,meal_time:mealTime,rest,completed:complete}});await load();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 const syncNotice=<div role="status" className={sync.needsAttention?'care-notice':undefined}><span>{sync.message}</span>{sync.needsAttention&&!sync.offline&&<button onClick={()=>void load()}>Reintentar sincronización</button>}{sync.error?.kind==='session'&&<Link href="/">Ir a iniciar sesión</Link>}</div>;
 if(agendaOnly)return <>{sync.needsAttention?syncNotice:<div role="status" className="care-sync-status">{sync.message}</div>}{message&&<p role="status" className="care-notice">{message}</p>}{!sync.restricted&&<CareAgenda data={data} clientName={coach?db.getClient(clientId)?.name:undefined} coach={coach} onSaved={()=>void load()} onSave={saveActivity} entrance/>}</>;
 const today=trainingDateValue();
 const facts=!coach&&data?(()=>{
  const meals=data.activity.filter(a=>a.kind==='meal'&&a.data.date===date&&a.data.completed).length;
  const lastCheckIn=data.activity.filter(a=>a.kind==='checkin').map(a=>String(a.data.date)).sort().at(-1);
  const next=data.activity.filter(a=>a.kind==='appointment'&&a.data.status!=='cancelled'&&String(a.data.date)>=today).sort((a,b)=>String(a.data.date).localeCompare(String(b.data.date)))[0];
  return [
   {key:'diet' as const,icon:Salad,label:'Dieta de hoy',value:meals?meals===1?'1 comida marcada':meals+' comidas marcadas':'Sin comidas marcadas'},
   {key:'progress' as const,icon:TrendingUp,label:'Último check-in',value:lastCheckIn??'Aún sin enviar'},
   {key:'agenda' as const,icon:CalendarDays,label:'Próxima cita',value:next?(String(next.data.date)+(next.data.time?' · '+String(next.data.time):'')):'Sin agendar'},
  ];
 })():[];
 return <div className={`care-page portal-page${coach?' is-coach':''}`}>
  <header className="care-card portal-hero">
   <div className="portal-hero-copy">
    <span className="portal-kicker">{coach?'Seguimiento del cliente':'Mi espacio'}</span>
    <h1>{data?.client.name??(sync.error?'Expediente no disponible':'Cargando expediente…')}</h1>
    <p>{coach?'Dieta, entrenamiento, progreso y agenda del cliente en un solo lugar.':'Tu dieta, tu rutina y tu progreso. Marca tus comidas y envía tu check-in cuando quieras.'}</p>
    {syncNotice}
   </div>
   {!!facts.length&&<div className="portal-facts">{facts.map(fact=><button type="button" key={fact.label} className="portal-fact" onClick={()=>setTab(fact.key)}><span className="portal-fact-icon" aria-hidden="true"><fact.icon size={17}/></span><span className="portal-fact-copy"><small>{fact.label}</small><strong>{fact.value}</strong></span></button>)}</div>}
  </header>
  {coach&&showAccess&&<section className="care-card portal-access-card">
   <header className="portal-section-head"><div><span className="portal-kicker">Acceso del cliente</span><h2>Portal del cliente</h2><p>El cliente entra con su correo autorizado para ver su dieta, rutina y registrar su avance. Solo tú modificas la planificación.</p></div><span className={enabled?'portal-status is-on':'portal-status is-off'}>{enabled?'Acceso habilitado':'Sin acceso activo'}</span></header>
   <ol className="care-access-steps"><li><b>1</b><span>Confirma el correo y pulsa <strong>Habilitar acceso</strong>.</span></li><li><b>2</b><span>Copia y comparte el enlace del portal.</span></li><li><b>3</b><span>El cliente valida su correo una vez; después entra con contraseña.</span></li></ol>
   <div className="care-form care-access-form"><label>Correo autorizado<input type="email" value={email} onChange={e=>{emailEdited.current=true;setEmail(e.target.value);}}/></label><button disabled={busy||!email} onClick={()=>void access(true)}>Habilitar acceso</button><button disabled={busy||!enabled} onClick={()=>void access(false)}>Revocar acceso</button><a className="care-portal-link" href="/portal" target="_blank" rel="noopener noreferrer">Abrir portal</a><button type="button" onClick={()=>void navigator.clipboard.writeText(window.location.origin+'/portal').then(()=>setMessage('Enlace copiado.')).catch(()=>setMessage('Copia el enlace desde Abrir portal.'))}>Copiar enlace</button></div>
   <p className="portal-access-note">Este paso es independiente de la Agenda.</p>
  </section>}
  {message&&<p role="status" className="care-notice">{message}</p>}
  <PortalTabs tab={tab} onChange={setTab} dietPending={dietNotice.pending} animate={!coach}/>
  {data&&<>{<div className="care-tab-panel portal-panel" id="portal-panel-training" aria-labelledby="portal-tab-training" tabIndex={-1} hidden={tab!=='training'}>{(!coach||data.trainingPrograms.length>0)&&<PortalMesocycle programs={data.trainingPrograms} coach={coach}/>}{coach&&<PortalPublishDrafts programs={data.trainingPrograms} busy={busy} onPublish={id=>void publishProgram(id)} clientId={clientId}/>}<SessionTracker key={`${owner}-${clientId}`} owner={owner} clientId={clientId} programs={data.trainingPrograms} activity={data.activity} onSaved={()=>void load()} clientMode={!coach}/></div>}
  {tab==='agenda'&&<div className="portal-panel" id="portal-panel-agenda" aria-labelledby="portal-tab-agenda" tabIndex={-1}><CareAgenda data={data} coach={coach} onSaved={()=>void load()} onSave={saveActivity}/></div>}
  {tab==='diet'&&<div className="portal-panel" id="portal-panel-diet" aria-labelledby="portal-tab-diet" tabIndex={-1}><nav className="dm-diet-tabs" aria-label="Opciones de alimentación" role="tablist" onKeyDown={tabKeys}><button role="tab" id="portal-plan-tab" aria-selected={dietTab==='plan'} aria-controls="portal-plan-panel" tabIndex={dietTab==='plan'?0:-1} onClick={()=>setDietTab('plan')}>Plan de alimentación</button><button role="tab" id="portal-menus-tab" aria-selected={dietTab==='menus'} aria-controls="portal-menus-panel" tabIndex={dietTab==='menus'?0:-1} onClick={()=>setDietTab('menus')}>Mis menús</button></nav><div role="tabpanel" id="portal-plan-panel" aria-labelledby="portal-plan-tab" hidden={dietTab!=='plan'}><PortalDietCard plans={data.mealPlans} items={data.mealPlanItems} foods={data.foods} activity={data.activity} date={date} onDate={setDate} busy={busy} onMeal={meal} notice={{pending:dietNotice.pending,error:dietNotice.error,failed:dietNotice.failed,closing:dietNotice.closing,close:()=>void dietNotice.close()}}/></div>{dietTab==='menus'&&<div role="tabpanel" id="portal-menus-panel" aria-labelledby="portal-menus-tab"><PortalMenus key={`${owner}:${clientId}`} owner={owner} clientId={clientId} coach={coach}/></div>}</div>}
  {<div className="care-tab-panel portal-panel" id="portal-panel-progress" aria-labelledby="portal-tab-progress" tabIndex={-1} hidden={tab!=='progress'}>{coach?<CoachCheckInInbox key={`${owner}-${clientId}`} clientId={clientId} clientName={data.client.name} activity={data.activity} canImport={coach} targetId={tab==='progress'?targetCheckIn:undefined} onViewed={markViewed}/>:<PortalCheckIn key={`${owner}-${clientId}`} owner={owner} clientId={clientId} activity={data.activity} targetId={tab==='progress'?targetCheckIn:undefined} onViewed={markViewed} onSaved={()=>void load()}/>}{data.measurements.length>0&&<section className="care-card portal-section"><header className="portal-section-head"><div><span className="portal-kicker">Historial</span><h2>Evaluaciones del coach</h2><p>Peso y composición registrados en cada evaluación.</p></div></header><div className="care-table-wrap"><table><thead><tr><th>Fecha</th><th>Peso</th><th>Grasa corporal</th></tr></thead><tbody>{data.measurements.map(m=><tr key={m.id}><td>{m.date.slice(0,10)}</td><td>{m.weight} kg</td><td>{m.body_fat!=null?`${m.body_fat}%`:'Sin registrar'}</td></tr>)}</tbody></table></div></section>}</div>}</>}
 </div>;
}
