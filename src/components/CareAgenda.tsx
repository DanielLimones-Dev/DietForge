'use client';
import {useMemo,useState} from 'react';
import type {PortalData} from '@/lib/client-portal';
import {writeActivity} from '@/lib/client-portal';
import {civilAdd,sessionDate,type Activity} from '@/lib/training-tracking';
import {trainingDateValue,trainingDays} from '@/lib/training';

type AgendaKind='training'|'diet'|'peak'|'checkin'|'reminder';
type AgendaEvent={id:string;date:string;title:string;done:boolean;kind:AgendaKind;manual?:Activity};
const kindLabels:Record<AgendaKind,string>={training:'Entrenamiento',diet:'Alimentación',peak:'Peak Week',checkin:'Check-in',reminder:'Recordatorio'};

function formatDate(date:string){return new Intl.DateTimeFormat('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));}
function monthShift(month:string,amount:number){const date=new Date(`${month}-01T12:00:00Z`);date.setUTCMonth(date.getUTCMonth()+amount);return date.toISOString().slice(0,7);}

export function CareAgenda({owner,data,coach,onSaved}:{owner:string;data:PortalData;coach:boolean;onSaved:()=>void}){
 const today=trainingDateValue();
 const [month,setMonth]=useState(today.slice(0,7));const [selected,setSelected]=useState(today);const [title,setTitle]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 const events=useMemo(()=>{
  const result:AgendaEvent[]=[];
  const mealsDone=(plan:number,date:string,rest=false)=>{const times=[...new Set(data.mealPlanItems.filter(i=>i.meal_plan_id===plan&&(i.day_type??'normal')===(rest?'rest':'normal')).map(i=>i.meal_time))];return times.length>0&&times.every(time=>data.activity.some(a=>a.kind==='meal'&&a.data.plan_id===plan&&a.data.date===date&&a.data.rest===rest&&a.data.meal_time===time&&a.data.completed===true));};
  for(const p of data.trainingPrograms.filter(p=>p.status==='active'))for(let w=1;w<=p.duration_weeks;w++)trainingDays(p,w).forEach((d,i)=>{if(d.exercises.length)result.push({id:`training-${p.id}-${w}-${d.id}`,date:sessionDate(p,i,w),title:`${p.name} · ${d.name}`,done:data.activity.some(a=>a.kind==='session'&&a.data.program_id===p.id&&a.data.week===w&&a.data.day_id===d.id&&a.data.completed===true),kind:'training'});});
  for(const p of data.mealPlans){const date=(p.peak_week_date??p.date).slice(0,10);result.push({id:`meal-${p.id}`,date,title:p.name,done:mealsDone(p.id,date),kind:p.peak_week_date?'peak':'diet'});}
  for(const week of data.weekPlans)for(const day of week.day_plans){const date=civilAdd(week.start_date.slice(0,10),day.day);result.push({id:`week-${week.id}-${day.day}`,date,title:`${day.rest_day?'Rest Day':'Plan normal'} · ${week.name}`,done:day.meal_plan_id?mealsDone(day.meal_plan_id,date,!!day.rest_day):false,kind:'diet'});}
  if(data.client.next_check_in_date)result.push({id:'checkin',date:data.client.next_check_in_date.slice(0,10),title:'Revisión de progreso',done:data.activity.some(a=>a.kind==='checkin'&&String(a.data.date)>=data.client.next_check_in_date!.slice(0,10)),kind:'checkin'});
  for(const a of data.activity.filter(a=>a.kind==='event'))result.push({id:a.id,date:String(a.data.date),title:String(a.data.title),done:a.data.completed===true,kind:'reminder',manual:a});
  return result.sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title,'es'));
 },[data]);
 const first=month+'-01';const offset=(new Date(first+'T12:00:00Z').getUTCDay()+6)%7;const days=Array.from({length:42},(_,i)=>civilAdd(first,i-offset));
 const monthEvents=events.filter(event=>event.date.slice(0,7)===month);const selectedEvents=events.filter(event=>event.date===selected);
 const pending=monthEvents.filter(event=>!event.done&&event.date>=today).length;const overdue=monthEvents.filter(event=>!event.done&&event.date<today).length;const completed=monthEvents.filter(event=>event.done).length;
 async function add(){if(!title.trim())return;setBusy(true);setMessage('');try{await writeActivity(owner,data.client.id,{id:crypto.randomUUID(),kind:'event',data:{date:selected,title:title.trim().slice(0,300),completed:false}});setTitle('');onSaved();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 async function toggle(a:Activity){setBusy(true);setMessage('');try{await writeActivity(owner,data.client.id,{...a,data:{...a.data,completed:!a.data.completed}});onSaved();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 function goToday(){setMonth(today.slice(0,7));setSelected(today);}
 return <section className="care-card agenda-workspace">
  <header className="agenda-calendar-head"><div><span className="training-kicker">PASO 2 · REVISA EL MES</span><h2>Calendario de {data.client.name}</h2><p>Haz clic en un día para ver lo programado o añadir una nota interna.</p></div><div className="agenda-month-controls"><button type="button" aria-label="Mes anterior" onClick={()=>setMonth(current=>monthShift(current,-1))}>←</button><input aria-label="Mes del calendario" type="month" value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value);}}/><button type="button" aria-label="Mes siguiente" onClick={()=>setMonth(current=>monthShift(current,1))}>→</button><button type="button" onClick={goToday}>Hoy</button></div></header>
  <div className="agenda-summary" aria-label="Resumen del mes"><article><strong>{pending}</strong><span>Pendientes</span></article><article className="late"><strong>{overdue}</strong><span>Atrasados</span></article><article className="done"><strong>{completed}</strong><span>Completados</span></article></div>
  <div className="agenda-legend" aria-label="Tipos de eventos">{(Object.keys(kindLabels) as AgendaKind[]).map(kind=><span key={kind} className={`agenda-kind ${kind}`}><i/>{kindLabels[kind]}</span>)}</div>
  <div className="care-calendar">{['L','M','X','J','V','S','D'].map((d,i)=><strong key={i}>{d}</strong>)}{days.map(date=>{const dayEvents=events.filter(e=>e.date===date);return <button type="button" aria-label={`${formatDate(date)}${dayEvents.length?`, ${dayEvents.length} actividades`: ', sin actividades'}`} key={date} className={`${date===selected?'selected':''} ${date.slice(0,7)!==month?'muted':''} ${date===today?'today':''}`} onClick={()=>setSelected(date)}><span>{Number(date.slice(-2))}</span><div className="agenda-day-dots">{[...new Set(dayEvents.map(event=>event.kind))].slice(0,4).map(kind=><i key={kind} className={kind}/>)}</div>{dayEvents.length>0&&<small>{dayEvents.length}</small>}</button>;})}</div>
  <section className="agenda-day-panel"><header><div><span className="training-kicker">PASO 3 · DETALLE DEL DÍA</span><h3>{formatDate(selected)}</h3></div><strong>{selectedEvents.length} {selectedEvents.length===1?'actividad':'actividades'}</strong></header>
   <div className="care-list agenda-event-list">{selectedEvents.map(event=>{const status=event.done?'Completado':event.date<today?'Atrasado':'Pendiente';return <article key={event.id} className={`agenda-event ${event.kind}`}><i/><div><small>{kindLabels[event.kind]}</small><strong>{event.title}</strong></div><span className={`agenda-status ${event.done?'done':event.date<today?'late':'pending'}`}>{status}</span>{coach&&event.manual&&<button disabled={busy} onClick={()=>void toggle(event.manual!)}>{event.done?'Reabrir':'Completar'}</button>}</article>})}{!selectedEvents.length&&<div className="agenda-empty"><strong>Día libre</strong><p>No hay entrenamiento, alimentación, check-in ni recordatorios programados.</p></div>}</div>
   {coach&&<div className="agenda-reminder"><div><strong>Añadir recordatorio interno</strong><p>Ejemplos: revisar peso, ajustar carbohidratos, llamada o día de descanso.</p></div><div className="care-form"><label>Qué debes recordar<input value={title} maxLength={300} onChange={e=>setTitle(e.target.value)} placeholder="Ej. Revisar fotos y ajustar el plan"/></label><button disabled={busy||!title.trim()} onClick={()=>void add()}>Agregar al día</button></div><small>Los recordatorios se ven en DietForge; no envían correo ni notificación automática.</small></div>}
   <p className="agenda-state-help">Entrenamientos, comidas y check-ins cambian de estado cuando el cliente registra su avance. Los recordatorios los completas tú desde aquí.</p>
  </section>
  {message&&<p role="alert" className="care-notice">{message}</p>}
 </section>;
}
