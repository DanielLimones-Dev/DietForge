import type { TrainingProgram, TrainingExercise, TrainingPrescription } from '@/types';
import { trainingDateValue, trainingDays, validTrainingDate } from './training';

export interface PerformedSet { kg:number; reps:number; rir:number; completed:boolean }
export interface SessionExercise { exercise_id:string; name:string; library_id?:string; target:TrainingPrescription; sets:PerformedSet[] }
export interface TrainingSession { date:string; program_id:number; day_id:string; week:number; completed:boolean; fatigue:number; notes:string; exercises:SessionExercise[] }
export interface Activity { id:string; kind:'session'|'meal'|'checkin'|'event'; data:Record<string,unknown>; updated_at?:string }
export interface VolumeRange { min:number; max:number }
export function makeSession(program:TrainingProgram,dayId:string,week:number):TrainingSession {
 const day=trainingDays(program,week).find(d=>d.id===dayId);
 if(!day)throw new Error('Selecciona un día válido.');
 return {date:trainingDateValue(),program_id:program.id,day_id:dayId,week,completed:false,fatigue:5,notes:'',exercises:day.exercises.map(e=>{
  const target=e.prescriptions.find(p=>p.week===week);if(!target)throw new Error('Falta la prescripción semanal.');
  return {exercise_id:e.id,library_id:e.library_id,name:e.name,target:structuredClone(target),sets:Array.from({length:Math.min(30,Math.max(0,target.sets))},()=>({kg:target.load_kg??0,reps:target.reps_min,rir:target.rir_end,completed:false}))};
 })};
}
export function sessionErrors(s:TrainingSession):string[] {
 const errors:string[]=[];
 if(!validTrainingDate(s.date)||!s.exercises.length)errors.push('La sesión necesita fecha válida y ejercicios.');
 if(!Number.isInteger(s.week)||s.week<1||s.week>12)errors.push('Semana inválida.');
 if(!Number.isFinite(s.fatigue)||s.fatigue<1||s.fatigue>10)errors.push('Fatiga entre 1 y 10.');
 for(const e of s.exercises)for(const v of e.sets)if(!Number.isFinite(v.kg)||v.kg<0||v.kg>1500||!Number.isInteger(v.reps)||v.reps<0||v.reps>200||!Number.isFinite(v.rir)||v.rir<0||v.rir>10)errors.push(`${e.name}: revisa peso, repeticiones y RIR.`);
 if(s.completed&&s.exercises.some(e=>!e.sets.length||e.sets.some(v=>!v.completed)))errors.push('Completa las series antes de cerrar la sesión.');
 return [...new Set(errors)];
}
export function sessionsFromActivity(rows:Activity[]):TrainingSession[]{return rows.filter(r=>r.kind==='session').map(r=>r.data as unknown as TrainingSession);}
export function exerciseHistory(sessions:TrainingSession[],exercise:TrainingExercise){
 return sessions.flatMap(s=>s.exercises.filter(e=>exercise.library_id?e.library_id===exercise.library_id:e.exercise_id===exercise.id).map(e=>({date:s.date,fatigue:s.fatigue,completed:s.completed,...e}))).sort((a,b)=>a.date.localeCompare(b.date));
}
export function performanceSummary(sessions:TrainingSession[]){
 const records=new Map<string,{name:string;kg:number;reps:number;tonnage:number}>();
 for(const s of sessions)for(const e of s.exercises){const key=e.library_id??e.exercise_id;const record=records.get(key)??{name:e.name,kg:0,reps:0,tonnage:0};for(const set of e.sets.filter(x=>x.completed)){record.kg=Math.max(record.kg,set.kg);record.reps=Math.max(record.reps,set.reps);record.tonnage+=set.kg*set.reps;}records.set(key,record);}
 return [...records.values()];
}
export interface ProgressionSuggestion { action:'load'|'reps'|'review'|'hold'; message:string; load_kg?:number; reps_min?:number; reps_max?:number }
// Conservative review rules, not an automatic prescription. Coach explicitly applies proposals.
export function progressionSuggestion(exercise:TrainingExercise,sessions:TrainingSession[],week:number):ProgressionSuggestion {
 // Multiple copies or appearances of an exercise on one date are one exposure.
 const history=[...new Map(exerciseHistory(sessions,exercise).filter(h=>h.completed&&h.sets.length&&h.sets.every(s=>s.completed)).map(h=>[h.date,h])).values()];
 const p=exercise.prescriptions.find(p=>p.week===week);const recent=history.slice(-2);
 if(!p||recent.length<2)return {action:'hold',message:'Registra dos sesiones completas para proponer progresión.'};
 if(recent.some(h=>h.fatigue>=8))return {action:'review',message:'Fatiga elevada: revisa recuperación y volumen antes de aumentar.'};
 if(recent.every(h=>h.sets.every(s=>s.reps>=h.target.reps_max&&s.rir>=h.target.rir_end))){
  const minLoad=Math.min(...recent.at(-1)!.sets.map(s=>s.kg));
  if(minLoad>0){const load=Math.round(minLoad*1.025*2)/2;if(load<=minLoad || load<=(p.load_kg??0))return {action:'hold',message:'La carga propuesta ya está aplicada o el incremento es menor a 0.5 kg. Revisa el ajuste manualmente.'};return {action:'load',message:`Dos sesiones en el máximo del rango: propuesta de ${load} kg (+2.5% aprox.).`,load_kg:load};}
  return {action:'reps',message:'Rango completado sin carga: propuesta de una repetición adicional.',reps_min:p.reps_min+1,reps_max:p.reps_max+1};
 }
 const lastThree=history.slice(-3);
 if(lastThree.length===3&&lastThree.every(h=>h.sets.some(s=>s.reps<h.target.reps_min)))return {action:'review',message:'Tres sesiones bajo el mínimo: revisar carga, técnica o sustituir el ejercicio.'};
 return {action:'hold',message:'Mantener y consolidar el rango antes de aumentar.'};
}
export function detailedVolume(program:TrainingProgram,week:number){
 const map=new Map<string,{muscle:string;direct:number;indirect:number;days:Set<string>}>();
 for(const d of trainingDays(program,week))for(const e of d.exercises){const n=e.prescriptions.find(p=>p.week===week)?.sets??0;if(n<=0)continue;
 for(const [muscle,factor,direct] of [[e.muscle_group,1,true],...(e.secondary_muscles??[]).filter(m=>m!==e.muscle_group).map(m=>[m,e.indirect_factor??0.5,false])] as [string,number,boolean][]){const row=map.get(muscle)??{muscle,direct:0,indirect:0,days:new Set<string>()};row[direct?'direct':'indirect']+=n*factor;row.days.add(d.id);map.set(muscle,row);}}
 return [...map.values()].map(r=>({muscle:r.muscle,direct:r.direct,indirect:r.indirect,total:r.direct+r.indirect,frequency:r.days.size})).sort((a,b)=>b.total-a.total);
}
export function duplicateTraining(program:TrainingProgram,clientId:number,name=program.name):TrainingProgram {
 const clone=structuredClone(program);clone.id=0;clone.client_id=clientId;clone.name=name;clone.status='draft';clone.start_date=trainingDateValue();delete clone.review;clone.approval_history=[];
 const exerciseIds=new Map<string,string>();const dayIds=new Map<string,string>();
 const renew=(days:typeof clone.days)=>days.map(d=>({...d,id:dayIds.get(d.id)??(()=>{const id=crypto.randomUUID();dayIds.set(d.id,id);return id;})(),exercises:d.exercises.map(e=>({...e,id:exerciseIds.get(e.id)??(()=>{const id=crypto.randomUUID();exerciseIds.set(e.id,id);return id;})()}))}));
 clone.days=renew(clone.days);if(clone.week_days)clone.week_days=Object.fromEntries(Object.entries(clone.week_days).map(([week,days])=>[week,renew(days)]));return clone;
}
export function civilAdd(date:string,days:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function sessionDate(program:TrainingProgram,dayIndex:number,week:number){const days=trainingDays(program,week);return civilAdd(program.start_date,(week-1)*7+(days[dayIndex].weekday_offset??dayIndex));}
