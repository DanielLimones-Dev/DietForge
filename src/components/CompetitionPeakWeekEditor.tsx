import {PeakCalendar} from "./PeakCalendar";
import {useState} from "react";
import {peakDays} from "@/lib/peak-week";
import type {PeakWeekDayConfig} from "@/types";
interface Props {
  competitionDate?: string;
  competitionName?: string;
  competitionCategory?: string;
  competitionWeight?: string;
  competitionPlacement?: string;
  initialConfig?: PeakWeekDayConfig[];
  baseMacros?: { protein: number; carbs: number; fat: number; tdee: number };
  onChange: (data: {
    name: string;
    date: string;
    category: string;
    weight: string;
    placement: string;
    config: PeakWeekDayConfig[];
  }) => void;
}


export function CompetitionPeakWeekEditor(props:Props){
 const [data,setData]=useState(()=>({name:props.competitionName??"",date:props.competitionDate?.slice(0,10)??"",category:props.competitionCategory??"",weight:props.competitionWeight??"",placement:props.competitionPlacement??"",config:props.initialConfig??[]}));
 const [selectedDate,setSelectedDate]=useState(props.competitionDate?.slice(0,10)??"");
 const update=(change:Partial<typeof data>)=>{const next={...data,...change};setData(next);props.onChange(next);};
 const week=peakDays(data.date,JSON.stringify(data.config));
 const setDay=(day:PeakWeekDayConfig)=>update({config:[...data.config.filter(d=>d.date!==day.date),day].sort((a,b)=>a.date.localeCompare(b.date))});
 return <div className="space-y-5">
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
   {(["name","date","category","weight","placement"] as const).map(field=><label key={field} className="block text-sm font-medium">{{name:"Nombre de la competencia",date:"Fecha del show",category:"Categoría",weight:"Peso de competencia (kg)",placement:"Posición"}[field]}
    <input aria-label={{name:"Nombre de la competencia",date:"Fecha del show",category:"Categoría",weight:"Peso de competencia (kg)",placement:"Posición"}[field]} type={field==="date"?"date":field==="weight"||field==="placement"?"number":"text"} min={field==="placement"?1:0} step={field==="weight"?"any":undefined} value={data[field]} onChange={e=>update({[field]:e.target.value})} className="block w-full mt-2 rounded-xl border p-3 dark:bg-gray-800"/>
   </label>)}
  </div>
  <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 p-4 text-sm"><strong>Semana previa al show</strong><p className="mt-2">La fecha de competencia permanece fija al editar macros o notas. Las fases son etiquetas; los valores vacíos usan la base del atleta. Guarda la competencia y usa Peak Week para crear o actualizar sus 7 dietas.</p></div>
  {week.length>0&&<PeakCalendar key={data.date} showDate={data.date} selected={selectedDate} days={[...week,...data.config.filter(d=>!week.some(w=>w.date===d.date))]} onSelect={date=>{setSelectedDate(date);if(!week.some(d=>d.date===date)&&!data.config.some(d=>d.date===date))setDay({date,phase:"Base",markers:[],notes:""});}}/>}
  <div className="space-y-3">{[...week,...data.config.filter(d=>!week.some(w=>w.date===d.date))].filter(day=>day.date===selectedDate).map(day=><details open key={day.date} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
   <summary className="cursor-pointer font-medium text-sm">{new Date(day.date+"T12:00:00").toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"})} · {day.phase}</summary>
   <label className="block text-sm mt-4">Fase<select value={day.phase} onChange={e=>setDay({...day,phase:e.target.value})} className="ml-3 rounded-lg border p-2 dark:bg-gray-800">{Array.from(new Set(["Base","Descarga","Carga","Puesta a punto","Show",day.phase])).map(p=><option key={p}>{p}</option>)}</select></label>
   <div className="grid grid-cols-3 gap-3 mt-4">{(["protein","carbs","fat"] as const).map(f=><label className="text-xs" key={f}>{{protein:"Proteína",carbs:"Carbohidratos",fat:"Grasas"}[f]} (g)<input aria-label={day.date+" "+f} type="number" min="0" step="any" value={day[f]??""} placeholder={String(props.baseMacros?.[f]??"")} onChange={e=>setDay({...day,[f]:e.target.value===""?undefined:Number(e.target.value)})} className="w-full block rounded-lg border p-2 mt-2 dark:bg-gray-800"/></label>)}</div>
   <label className="block text-sm mt-4">Recordatorio del día<input aria-label="Recordatorio del día" value={day.reminder??""} onChange={e=>setDay({...day,reminder:e.target.value})} placeholder="Ej. ajustar carbohidratos" className="block w-full rounded-lg border p-3 mt-2 dark:bg-gray-800"/></label>
   <textarea aria-label={"Notas "+day.date} placeholder="Notas del día" value={day.notes} onChange={e=>setDay({...day,notes:e.target.value})} className="w-full rounded-lg border p-3 mt-4 dark:bg-gray-800"/>
  </details>)}</div>
  {data.config.some(d=>!week.some(w=>w.date===d.date))&&<p className="text-xs text-gray-500">Se conservan los registros previos que están fuera de estas siete fechas.</p>}
 </div>;
}
