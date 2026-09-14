'use client';
import {useMemo,useState} from 'react';
import type {PortalData} from '@/lib/client-portal';
import {civilAdd} from '@/lib/training-tracking';
import {trainingDateValue} from '@/lib/training';

type AgendaKind='peak'|'checkin';
type AgendaEvent={id:string;date:string;title:string;done:boolean;kind:AgendaKind};
const kindLabels:Record<AgendaKind,string>={peak:'Peak Week',checkin:'Check-in'};

function formatDate(date:string){return new Intl.DateTimeFormat('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));}
function monthShift(month:string,amount:number){const date=new Date(`${month}-01T12:00:00Z`);date.setUTCMonth(date.getUTCMonth()+amount);return date.toISOString().slice(0,7);}

export function CareAgenda({data}:{owner:string;data:PortalData;coach:boolean;onSaved:()=>void}){
 const today=trainingDateValue();
 const [month,setMonth]=useState(today.slice(0,7));const [selected,setSelected]=useState(today);
 const events=useMemo(()=>{
  const result:AgendaEvent[]=[];
  const mealsDone=(plan:number,date:string,rest=false)=>{const times=[...new Set(data.mealPlanItems.filter(i=>i.meal_plan_id===plan&&(i.day_type??'normal')===(rest?'rest':'normal')).map(i=>i.meal_time))];return times.length>0&&times.every(time=>data.activity.some(a=>a.kind==='meal'&&a.data.plan_id===plan&&a.data.date===date&&a.data.rest===rest&&a.data.meal_time===time&&a.data.completed===true));};
  for(const p of data.mealPlans.filter(plan=>plan.peak_week_date)){const date=(p.peak_week_date??p.date).slice(0,10);result.push({id:`meal-${p.id}`,date,title:p.name,done:mealsDone(p.id,date),kind:'peak'});}
  if(data.client.next_check_in_date)result.push({id:'checkin',date:data.client.next_check_in_date.slice(0,10),title:'Revisión de progreso',done:data.activity.some(a=>a.kind==='checkin'&&String(a.data.date)>=data.client.next_check_in_date!.slice(0,10)),kind:'checkin'});
  return result.sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title,'es'));
 },[data]);
 const first=month+'-01';const offset=(new Date(first+'T12:00:00Z').getUTCDay()+6)%7;const days=Array.from({length:42},(_,i)=>civilAdd(first,i-offset));
 const monthEvents=events.filter(event=>event.date.slice(0,7)===month);const selectedEvents=events.filter(event=>event.date===selected);
 const pending=monthEvents.filter(event=>!event.done&&event.date>=today).length;const overdue=monthEvents.filter(event=>!event.done&&event.date<today).length;const completed=monthEvents.filter(event=>event.done).length;
 function goToday(){setMonth(today.slice(0,7));setSelected(today);}
 return <section className="care-card agenda-workspace">
  <header className="agenda-calendar-head"><div><span className="training-kicker">PASO 2 · REVISA EL MES</span><h2>Calendario de {data.client.name}</h2><p>Selecciona un día para consultar la Peak Week y los check-ins programados.</p></div><div className="agenda-month-controls"><button type="button" aria-label="Mes anterior" onClick={()=>setMonth(current=>monthShift(current,-1))}>←</button><input aria-label="Mes del calendario" type="month" value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value);}}/><button type="button" aria-label="Mes siguiente" onClick={()=>setMonth(current=>monthShift(current,1))}>→</button><button type="button" onClick={goToday}>Hoy</button></div></header>
  <div className="agenda-summary" aria-label="Resumen del mes"><article><strong>{pending}</strong><span>Pendientes</span></article><article className="late"><strong>{overdue}</strong><span>Atrasados</span></article><article className="done"><strong>{completed}</strong><span>Completados</span></article></div>
  <div className="agenda-legend" aria-label="Tipos de eventos">{(Object.keys(kindLabels) as AgendaKind[]).map(kind=><span key={kind} className={`agenda-kind ${kind}`}><i/>{kindLabels[kind]}</span>)}</div>
  <div className="care-calendar">{['L','M','X','J','V','S','D'].map((d,i)=><strong key={i}>{d}</strong>)}{days.map(date=>{const dayEvents=events.filter(e=>e.date===date);return <button type="button" aria-label={`${formatDate(date)}${dayEvents.length?`, ${dayEvents.length} actividades`: ', sin actividades'}`} key={date} className={`${date===selected?'selected':''} ${date.slice(0,7)!==month?'muted':''} ${date===today?'today':''}`} onClick={()=>setSelected(date)}><span>{Number(date.slice(-2))}</span><div className="agenda-day-dots">{[...new Set(dayEvents.map(event=>event.kind))].slice(0,4).map(kind=><i key={kind} className={kind}/>)}</div>{dayEvents.length>0&&<small>{dayEvents.length}</small>}</button>;})}</div>
  <section className="agenda-day-panel"><header><div><span className="training-kicker">PASO 3 · DETALLE DEL DÍA</span><h3>{formatDate(selected)}</h3></div><strong>{selectedEvents.length} {selectedEvents.length===1?'actividad':'actividades'}</strong></header>
   <div className="care-list agenda-event-list">{selectedEvents.map(event=>{const status=event.done?'Completado':event.date<today?'Atrasado':'Pendiente';return <article key={event.id} className={`agenda-event ${event.kind}`}><i/><div><small>{kindLabels[event.kind]}</small><strong>{event.title}</strong></div><span className={`agenda-status ${event.done?'done':event.date<today?'late':'pending'}`}>{status}</span></article>})}{!selectedEvents.length&&<div className="agenda-empty"><strong>Día libre</strong><p>No hay Peak Week ni check-ins programados.</p></div>}</div>
   <p className="agenda-state-help">La Peak Week se completa al registrar sus comidas. El check-in cambia de estado cuando el cliente envía su avance.</p>
  </section>
 </section>;
}
