import type { PortalData } from './client-portal';
import type { Activity } from './training-tracking';
import { civilAdd } from './training-tracking';
import { validTrainingDate } from './training';

/** A client books a follow-up; the coach confirms or cancels it in the same agenda. */
export type AppointmentStatus = 'requested' | 'confirmed' | 'cancelled';
export interface AppointmentData extends Record<string, unknown> {
  date: string;
  /** Civil local time in 24h HH:MM, not an instant. */
  time: string;
  note: string;
  status: AppointmentStatus;
}
export interface AppointmentDraft { date:string; time:string; note:string }
export type AgendaKind = 'peak' | 'checkin' | 'appointment';
export type AgendaState = 'pending' | 'late' | 'done' | 'cancelled' | 'confirmed';
export interface AgendaEvent {
  id: string;
  date: string;
  time?: string;
  title: string;
  client?: string;
  kind: AgendaKind;
  state: AgendaState;
  stateLabel: string;
  /** The coach can confirm or cancel an upcoming appointment. */
  appointment?: AppointmentData;
}
export const appointmentStatusLabels: Record<AppointmentStatus,string> = {
  requested: 'Solicitada',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
};
export const agendaKindLabels: Record<AgendaKind,string> = {
  peak: 'Peak Week',
  checkin: 'Check-in',
  appointment: 'Cita',
};
export const appointmentWindow = { open: 7*60, close: 21*60, step: 15 } as const;

export function appointmentTimeError(time:string):string|null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return 'Elige una hora válida.';
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (minutes < appointmentWindow.open || minutes > appointmentWindow.close) return 'La cita debe estar entre 07:00 y 21:00.';
  if (minutes % appointmentWindow.step !== 0) return 'Usa intervalos de 15 minutos.';
  return null;
}

/** Everything a booking needs to be stored, validated before it reaches the RPC. */
export function validateAppointment(draft:AppointmentDraft, options:{today:string; activity:Activity[]; id?:string}):{errors:string[];data:AppointmentData|null} {
  const errors:string[]=[];
  if (!validTrainingDate(draft.date)) errors.push('Selecciona una fecha válida.');
  else if (draft.date < options.today) errors.push('No puedes agendar en una fecha pasada.');
  else if (draft.date > civilAdd(options.today,365)) errors.push('Agenda dentro de los próximos 12 meses.');
  const timeError = appointmentTimeError(draft.time);
  if (timeError) errors.push(timeError);
  const note = draft.note.trim();
  if (note.length > 300) errors.push('El motivo admite hasta 300 caracteres.');
  const duplicate = options.activity.some(item=>item.kind==='appointment'&&item.id!==options.id&&item.data.date===draft.date&&item.data.time===draft.time&&item.data.status!=='cancelled');
  if (!errors.length && duplicate) errors.push('Ya existe una cita a esa hora. Elige otra.');
  if (errors.length) return {errors,data:null};
  return {errors,data:{date:draft.date,time:draft.time,note,status:'requested'}};
}

export function appointmentStatus(appointment:AppointmentData):Pick<AgendaEvent,'state'|'stateLabel'> {
  if (appointment.status === 'cancelled') return {state:'cancelled',stateLabel:'Cancelada'};
  if (appointment.status === 'confirmed') return {state:'confirmed',stateLabel:'Confirmada'};
  return {state:'pending',stateLabel:'Solicitada'};
}

function mealsCompleted(data:PortalData,plan:number,date:string,rest=false):boolean {
  const times = [...new Set(data.mealPlanItems.filter(item=>item.meal_plan_id===plan&&(item.day_type??'normal')===(rest?'rest':'normal')).map(item=>item.meal_time))];
  return times.length>0 && times.every(time=>data.activity.some(entry=>entry.kind==='meal'&&entry.data.plan_id===plan&&entry.data.date===date&&entry.data.rest===rest&&entry.data.meal_time===time&&entry.data.completed===true));
}

/** Peak Week, check-ins and client-booked appointments; planning data stays out of the agenda. */
export function agendaEvents(data:PortalData|null):AgendaEvent[] {
  if (!data) return [];
  const result:AgendaEvent[]=[];
  for (const plan of data.mealPlans.filter(item=>item.peak_week_date)) {
    const date = (plan.peak_week_date??plan.date).slice(0,10);
    const done = mealsCompleted(data,plan.id,date);
    result.push({id:`meal-${plan.id}`,date,title:plan.name,kind:'peak',state:done?'done':'pending',stateLabel:done?'Completada':'Pendiente'});
  }
  if (data.client.next_check_in_date) {
    const date = data.client.next_check_in_date.slice(0,10);
    const done = data.activity.some(entry=>entry.kind==='checkin'&&String(entry.data.date)>=date);
    result.push({id:'checkin',date,title:'Revisión de progreso',kind:'checkin',state:done?'done':'pending',stateLabel:done?'Completado':'Pendiente'});
  }
  for (const entry of data.activity.filter(item=>item.kind==='appointment')) {
    const appointment = entry.data as unknown as AppointmentData;
    if (!validTrainingDate(appointment.date)||typeof appointment.time!=='string') continue;
    result.push({id:entry.id,date:appointment.date,time:appointment.time,title:appointment.note||'Consulta de seguimiento',client:data.client.name,kind:'appointment',appointment,...appointmentStatus(appointment)});
  }
  return result.sort((a,b)=>a.date.localeCompare(b.date)||(a.time??'').localeCompare(b.time??'')||a.title.localeCompare(b.title,'es'));
}

/** Local calendar state for an event; appointments keep their confirmation state. */
export function agendaState(event:AgendaEvent,today:string):AgendaState {
  if (event.appointment) {
    if (event.appointment.status==='cancelled') return 'cancelled';
    if (event.appointment.status==='confirmed') return 'confirmed';
    return event.date<today?'late':'pending';
  }
  if (event.state==='done') return 'done';
  return event.date<today?'late':'pending';
}

export function agendaStateLabel(event:AgendaEvent,today:string):string {
  const state = agendaState(event,today);
  if (event.appointment) {
    if (state==='cancelled') return 'Cancelada';
    if (state==='confirmed') return 'Confirmada';
    return state==='late'?'Sin confirmar':'Solicitada';
  }
  return state==='done'?'Completado':state==='late'?'Atrasado':'Pendiente';
}

export function agendaMonthDays(month:string):string[] {
  const first = month+'-01';
  const offset = (new Date(first+'T12:00:00Z').getUTCDay()+6)%7;
  return Array.from({length:42},(_,index)=>civilAdd(first,index-offset));
}

export function monthShift(month:string,amount:number):string {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth()+amount);
  return date.toISOString().slice(0,7);
}

export function formatAgendaDate(date:string):string {
  return new Intl.DateTimeFormat('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
}
