'use client';
import {useMemo,useState} from 'react';
import {CalendarCheck2,CalendarPlus,Check,X} from 'lucide-react';
import type {PortalData} from '@/lib/client-portal';
import type {Activity} from '@/lib/training-tracking';
import {trainingDateValue} from '@/lib/training';
import {agendaEvents,agendaKindLabels,agendaMonthDays,agendaState,agendaStateLabel,formatAgendaDate,monthShift,validateAppointment,type AgendaEvent,type AgendaKind,type AppointmentDraft,type AppointmentStatus} from '@/lib/agenda';

type CareAgendaProps={data:PortalData|null;clientName?:string;entrance?:boolean;coach:boolean;onSaved:()=>void;onSave:(activity:Activity)=>Promise<void>};

function BookingCard({data,date,onBook,onBooked}:{data:PortalData;date:string;onBook:(activity:Activity)=>Promise<void>;onBooked:(message:string,date:string)=>void}){
 const today=trainingDateValue();
 const [draft,setDraft]=useState<AppointmentDraft>({date:date>=today?date:today,time:'09:00',note:''});
 const [errors,setErrors]=useState<string[]>([]);const [busy,setBusy]=useState(false);
 async function book(){
  const result=validateAppointment(draft,{today,activity:data.activity});
  if(!result.data){setErrors(result.errors);return;}
  setBusy(true);setErrors([]);
  try{
   await onBook({id:crypto.randomUUID(),kind:'appointment',data:result.data});
   setDraft(current=>({...current,note:''}));
   onBooked('Cita solicitada. Tu coach la verá en su agenda.',result.data.date);
  }catch(error){setErrors([(error as Error).message]);}
  finally{setBusy(false);}
 }
 return <section className="agenda-booking" aria-label="Solicitar una cita">
  <header><span className="agenda-booking-icon" aria-hidden="true"><CalendarPlus size={19}/></span><div><strong>Solicitar una cita</strong><p>Elige fecha y hora; tu coach confirma desde la agenda.</p></div></header>
  <div className="agenda-booking-form">
   <label>Fecha<input type="date" min={today} value={draft.date} onChange={event=>setDraft({...draft,date:event.target.value})}/></label>
   <label>Hora<input type="time" min="07:00" max="21:00" step="900" value={draft.time} onChange={event=>setDraft({...draft,time:event.target.value})}/></label>
   <label>Motivo (opcional)<input maxLength={300} placeholder="Ej. revisión de medidas" value={draft.note} onChange={event=>setDraft({...draft,note:event.target.value})}/></label>
   <button type="button" className="portal-button portal-button-primary" disabled={busy} onClick={()=>void book()}>{busy?'Agendando…':'Solicitar cita'}</button>
  </div>
  {errors.length>0&&<div role="alert" className="agenda-booking-errors">{errors.map(error=><p key={error}>{error}</p>)}</div>}
 </section>;
}

export function CareAgenda({data,clientName,entrance=false,coach,onSaved,onSave}:CareAgendaProps){
 const today=trainingDateValue();
 const [month,setMonth]=useState(today.slice(0,7));const [selected,setSelected]=useState(today);
 const [feedback,setFeedback]=useState('');const [busyId,setBusyId]=useState('');
 const events=useMemo(()=>agendaEvents(data),[data]);
 const days=agendaMonthDays(month);
 const monthEvents=events.filter(event=>event.date.slice(0,7)===month);const selectedEvents=events.filter(event=>event.date===selected);
 const appointments=monthEvents.filter(event=>event.kind==='appointment'&&event.appointment?.status!=='cancelled').length;
 const pending=monthEvents.filter(event=>event.kind!=='appointment'&&event.state!=='done'&&event.date>=today).length;
 const overdue=monthEvents.filter(event=>event.kind!=='appointment'&&event.state!=='done'&&event.date<today).length;
 const completed=monthEvents.filter(event=>event.kind!=='appointment'&&event.state==='done').length;
 function selectDay(date:string){setSelected(date);setFeedback('');}
 function goToday(){setMonth(today.slice(0,7));setSelected(today);}
 async function setStatus(event:AgendaEvent,status:AppointmentStatus){
  if(!event.appointment)return;
  setBusyId(event.id);setFeedback('');
  try{
   await onSave({id:event.id,kind:'appointment',data:{...event.appointment,status}});
   setFeedback(status==='confirmed'?'Cita confirmada.':status==='cancelled'?'Cita cancelada.':'Solicitud reabierta.');
   onSaved();
  }catch(error){setFeedback((error as Error).message);}
  finally{setBusyId('');}
 }
 return <section className="care-card agenda-workspace portal-section" data-cascade={entrance?'1':undefined}>
  <header className="agenda-calendar-head"><div><span className="portal-kicker">Mi agenda</span><h2>{coach?`Agenda de ${data?.client.name??clientName??'cliente'}`:'Citas y seguimiento'}</h2><p>Citas, Peak Week y check-ins del mes. Selecciona un día para ver el detalle.</p></div><div className="agenda-month-controls"><button type="button" aria-label="Mes anterior" onClick={()=>setMonth(current=>monthShift(current,-1))}>←</button><input aria-label="Mes del calendario" type="month" value={month} onChange={event=>{if(event.target.value)setMonth(event.target.value);}}/><button type="button" aria-label="Mes siguiente" onClick={()=>setMonth(current=>monthShift(current,1))}>→</button><button type="button" onClick={goToday}>Hoy</button></div></header>
  {data&&!coach&&<BookingCard key={selected} data={data} date={selected} onBook={onSave} onBooked={(message,date)=>{setFeedback(message);setMonth(date.slice(0,7));setSelected(date);onSaved();}}/>}
  <div className="agenda-summary" aria-label="Resumen del mes"><article><strong>{data?appointments:'—'}</strong><span>{appointments===1?'Cita':'Citas'}</span></article><article><strong>{data?pending:'—'}</strong><span>{pending===1?'Pendiente':'Pendientes'}</span></article><article className="late"><strong>{data?overdue:'—'}</strong><span>{overdue===1?'Atrasado':'Atrasados'}</span></article><article className="done"><strong>{data?completed:'—'}</strong><span>{completed===1?'Completado':'Completados'}</span></article></div>
  <div className="agenda-legend" aria-label="Tipos de eventos">{(Object.keys(agendaKindLabels) as AgendaKind[]).map(kind=><span key={kind} className={`agenda-kind ${kind}`}><i/>{agendaKindLabels[kind]}</span>)}</div>
  <div className="care-calendar">{['L','M','X','J','V','S','D'].map((day,index)=><strong key={index}>{day}</strong>)}{days.map(date=>{const dayEvents=events.filter(event=>event.date===date);return <button type="button" aria-label={`${formatAgendaDate(date)}${!data?', actividades pendientes de cargar':dayEvents.length?`, ${dayEvents.length} actividades`: ', sin actividades'}`} key={date} className={`${date===selected?'selected':''} ${date.slice(0,7)!==month?'muted':''} ${date===today?'today':''}`} onClick={()=>selectDay(date)}><span>{Number(date.slice(-2))}</span><div className="agenda-day-dots">{[...new Set(dayEvents.map(event=>event.kind))].slice(0,4).map(kind=><i key={kind} className={kind}/>)}</div>{dayEvents.length>0&&<small>{dayEvents.length}</small>}</button>;})}</div>
  <section className="agenda-day-panel"><header><div><h3>{formatAgendaDate(selected)}</h3><p>{data?'Citas, Peak Week y check-ins de este día.':''}</p></div><strong>{data?selectedEvents.length:'—'} {selectedEvents.length===1?'actividad':'actividades'}</strong></header>
   {feedback&&<p role="status" className="agenda-feedback">{feedback}</p>}
   <div className="care-list agenda-event-list" aria-busy={!data}>{!data&&<div className="agenda-empty" role="status"><strong>Cargando actividades…</strong><p>Puedes consultar el mes mientras llegan las fechas del cliente.</p></div>}{selectedEvents.map(event=>{const state=agendaState(event,today);const label=agendaStateLabel(event,today);const upcoming=event.date>=today;const appointment=event.appointment;return <article key={event.id} className={`agenda-event ${event.kind} ${state}`}><i/><div>{event.time&&<time dateTime={`${event.date}T${event.time}`}>{event.time}</time>}<small>{agendaKindLabels[event.kind]}{coach&&event.client?` · ${event.client}`:''}</small><strong>{event.title}</strong></div><span className={`agenda-status ${state}`}>{label}</span><div className="agenda-event-actions">{appointment&&appointment.status!=='cancelled'&&upcoming&&(coach?<><button type="button" disabled={busyId===event.id||appointment.status==='confirmed'} onClick={()=>void setStatus(event,'confirmed')}><Check size={14} aria-hidden="true"/>Confirmar</button><button type="button" disabled={busyId===event.id} onClick={()=>void setStatus(event,'cancelled')}><X size={14} aria-hidden="true"/>Cancelar</button></>:<button type="button" disabled={busyId===event.id} onClick={()=>void setStatus(event,'cancelled')}><X size={14} aria-hidden="true"/>Cancelar</button>)}</div></article>;})}{data&&!selectedEvents.length&&<div className="agenda-empty"><span className="agenda-empty-icon" aria-hidden="true"><CalendarCheck2 size={22}/></span><strong>Día libre</strong><p>No hay citas, Peak Week ni check-ins programados.</p></div>}</div>
   <p className="agenda-state-help">Las citas las solicita el cliente desde su portal y el coach las confirma aquí. La Peak Week se completa al registrar sus comidas y el check-in al enviarse.</p>
  </section>
 </section>;
}
