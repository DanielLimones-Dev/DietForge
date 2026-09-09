import type {PeakWeekDayConfig, MacroResult, Competition} from '@/types';
import {db} from '@/lib/db';
export function peakDates(date:string):string[]{
 date=date.slice(0,10);
 const base=new Date(date+'T12:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(base.getTime())||base.toISOString().slice(0,10)!==date)return [];
 return Array.from({length:7},(_,i)=>{const d=new Date(base);d.setUTCDate(d.getUTCDate()-6+i);return d.toISOString().slice(0,10);});
}
export function peakDays(date:string,config?:string):PeakWeekDayConfig[]{
 let saved:PeakWeekDayConfig[]=[];
 try{const p=JSON.parse(config||'[]');if(Array.isArray(p))saved=p.filter(d=>d&&typeof d.date==='string');}catch{}
 return peakDates(date).map((date,i)=>{
  const old=saved.find(d=>d.date===date);
  return {...old,date,phase:typeof old?.phase==='string'?old.phase:i===6?'Show':'Base',markers:Array.isArray(old?.markers)?old.markers:[],notes:typeof old?.notes==='string'?old.notes:''};
 });
}
export function dailyMacros(day:PeakWeekDayConfig,base:Pick<MacroResult,'protein'|'carbs'|'fat'>){
 const protein=day.protein??base.protein,carbs=day.carbs??base.carbs,fat=day.fat??base.fat;
 if(![protein,carbs,fat].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0))throw new Error('Los macros deben ser números iguales o mayores que cero.');
 return {protein,carbs,fat,kcal:protein*4+carbs*4+fat*9};
}
export function savePeakPlans(clientId:number,competition:Competition,days:PeakWeekDayConfig[],base:MacroResult,storage:Pick<typeof db,"getMealPlans"|"getLatestMeasurement"|"saveMealPlan"|"updateMealPlan"|"updateCompetition"|"getCompetitions">=db){
 const expected=peakDates(competition.date);
 if(days.length!==7||days.some((d,i)=>d.date!==expected[i]))throw new Error('Revisa las fechas de la semana.');
 const resolved=days.map(d=>dailyMacros(d,base));
 const existing=storage.getMealPlans(clientId);
 const measurement=storage.getLatestMeasurement(clientId);
 days.forEach((day,i)=>{
  const m=resolved[i];
  const data={client_id:clientId,competition_id:competition.id,peak_week_date:day.date,measurement_id:measurement?.id??null,date:day.date,name:`${competition.name} — Peak Week ${day.date} [${day.phase}]`,total_kcal:m.kcal,total_protein:m.protein,total_carbs:m.carbs,total_fat:m.fat,total_fiber:base.fiber,total_antioxidants:base.antioxidants};
  const plan=existing.find(p=>p.competition_id===competition.id&&p.peak_week_date===day.date);
  if(plan)storage.updateMealPlan(plan.id,data);else storage.saveMealPlan(data,[]);
 });
 storage.updateCompetition(competition.id,{peak_week_config:mergePeakConfig(competition,days,storage)});
}
export function mergePeakConfig(competition:Competition,days:PeakWeekDayConfig[],storage:Pick<typeof db,"getCompetitions">=db){
 let previous:PeakWeekDayConfig[]=[];
 try{const parsed=JSON.parse(storage.getCompetitions(competition.client_id).find(c=>c.id===competition.id)?.peak_week_config??competition.peak_week_config??'[]');if(Array.isArray(parsed))previous=parsed.filter(d=>d&&typeof d.date==='string');}catch{}
 return JSON.stringify([...previous.filter(p=>!days.some(d=>d.date===p.date)),...days].sort((a,b)=>a.date.localeCompare(b.date)));
}
