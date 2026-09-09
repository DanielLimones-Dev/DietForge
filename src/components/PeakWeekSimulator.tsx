import {PeakCalendar} from "./PeakCalendar";
import {useState} from "react";
import {db} from "@/lib/db";
import {peakDates,peakDays,dailyMacros,savePeakPlans,mergePeakConfig} from "@/lib/peak-week";
import type {Competition,MacroResult,PeakWeekDayConfig,PeakWeekMarker} from "@/types";

interface Props {clientId:number;competition?:Competition;latestMacros?:MacroResult}
const fields=["protein","carbs","fat"] as const;
const labels={protein:"Proteína",carbs:"Carbohidratos",fat:"Grasas"};
const markers: [PeakWeekMarker,string][]=[["macro_adjust","Ajuste de macros"],["carb_load","Carga de carbohidratos"],["puesta_punto","Ensayo / puesta a punto"],["water_manip","Registro de agua"],["sodium_manip","Registro de sodio"]];
export function PeakWeekSimulator(props:Props){
 if(!props.competition)return <div className="p-5 rounded-xl border text-sm">Registra una competencia con fecha para preparar su Peak Week.</div>;
 return <PeakEditor key={props.competition.id+":"+props.competition.date+":"+(props.competition.peak_week_config??"")} {...props} competition={props.competition}/>;
}
function PeakEditor({clientId,competition,latestMacros}:Props & {competition:Competition}){
 const [days,setDays]=useState(()=>{
  const config=db.getCompetitions(clientId).find(c=>c.id===competition.id)?.peak_week_config??competition.peak_week_config;
  const week=peakDays(competition.date,config);
  try{const saved=JSON.parse(config??"[]");if(Array.isArray(saved))return [...week,...saved.filter(d=>d&&typeof d.date==="string"&&!week.some(w=>w.date===d.date)).map(d=>({...d,markers:Array.isArray(d.markers)?d.markers:[],notes:d.notes??""}))] as PeakWeekDayConfig[];}catch{}return week;
 });
 const [selected,setSelected]=useState(0);
 const [message,setMessage]=useState("");
 const [dirty,setDirty]=useState(false);
 const [guide,setGuide]=useState(false);
 const base=latestMacros??{protein:0,carbs:0,fat:0,tmb:0,tdee:0,fiber:0,antioxidants:0};
 if(!days.length)return <p role="alert">La fecha de competencia no es válida. Corrígela para abrir el calendario.</p>;

 const day=days[selected];
 const update=(change:Partial<PeakWeekDayConfig>)=>{setDays(prev=>prev.map((d,i)=>i===selected?{...d,...change}:d));setDirty(true);setMessage("");};
 const resolved=days.map(d=>{try{return dailyMacros(d,base);}catch{return null;}});
 const save=(generate:boolean)=>{try{
   days.forEach(d=>dailyMacros(d,base));
   if(generate){savePeakPlans(clientId,competition,peakDates(competition.date).map(date=>days.find(d=>d.date===date)!),base);db.updateCompetition(competition.id,{peak_week_config:mergePeakConfig(competition,days)});}
   else db.updateCompetition(competition.id,{peak_week_config:mergePeakConfig(competition,days)});
   setDirty(false);setMessage(generate?"Los 7 planes están actualizados. Se conservaron sus alimentos.":"Configuración guardada.");
 }catch(error){setMessage(error instanceof Error?error.message:"No se pudo guardar.");}};
 const dateLabel=(date:string,full=false)=>new Date(date+"T12:00:00").toLocaleDateString("es-MX",{weekday:full?"long":"short",day:"numeric",month:"short"});
 return <section aria-label="Calendario Peak Week" className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
  <header className="p-6 bg-gradient-to-br from-indigo-950 to-slate-800 text-white">
   <p className="text-xs uppercase tracking-widest text-indigo-200">Preparación de competencia</p>
   <h3 className="text-xl font-semibold mt-2">Peak Week · {competition.name}</h3>
   <p className="text-sm text-slate-300 mt-2">{dateLabel(days[0].date)} → {dateLabel(days[6].date)} · 7 días, incluido el show</p>
  </header>
  <div className="p-4 sm:p-6 space-y-5">
   {!latestMacros&&<p className="text-sm text-amber-600">Puedes guardar recordatorios. Calcula los macros base del atleta antes de crear sus dietas.</p>}
   <p className="text-sm text-gray-500">Selecciona una fecha. Ajusta gramos o porcentaje de la base; las calorías se calculan con 4 kcal/g de proteína y carbohidratos y 9 kcal/g de grasa.</p>
   <PeakCalendar showDate={competition.date} days={days} selected={day.date} onSelect={date=>{const index=days.findIndex(d=>d.date===date);if(index>=0)setSelected(index);else{setDays(prev=>[...prev,{date,phase:"Base",markers:[],notes:""}]);setSelected(days.length);}}}/>
   <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 space-y-4">
    <div className="flex flex-wrap justify-between gap-3"><h4 className="font-semibold capitalize">{dateLabel(day.date,true)}</h4>
     <label className="text-sm">Fase <select aria-label="Fase del día" value={day.phase} onChange={e=>update({phase:e.target.value})} className="ml-2 border rounded-lg p-2 dark:bg-gray-800">
      {Array.from(new Set(["Base","Descarga","Carga","Puesta a punto","Show",day.phase])).map(p=><option key={p}>{p}</option>)}
     </select></label></div>
    <p className="text-xs text-gray-500">La fase y los marcadores son etiquetas: no cambian los macros automáticamente. 100% conserva la base del atleta.</p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
     {fields.map(field=><div key={field} className="rounded-xl p-4 bg-gray-50 dark:bg-gray-800">
      <p className="font-medium text-sm">{labels[field]}</p><p className="text-xs text-gray-500 mt-1">Base: {base[field]} g</p>
      <label className="block text-xs mt-3">Gramos<input aria-label={labels[field]+" gramos"} type="number" min="0" step="any" value={day[field]??""} placeholder={String(base[field])} onChange={e=>update({[field]:e.target.value===""?undefined:Number(e.target.value)})} className="block w-full mt-1 border rounded-lg p-2 dark:bg-gray-900"/></label>
      <label className="block text-xs mt-2">% de la base<input aria-label={labels[field]+" porcentaje"} type="number" min="0" step="any" disabled={base[field]===0} value={base[field]>0?Number((((day[field]??base[field])/base[field])*100).toFixed(2)):""} onChange={e=>update({[field]:Math.round(base[field]*Number(e.target.value))/100})} className="block w-full mt-1 border rounded-lg p-2 dark:bg-gray-900"/></label>
     </div>)}
    </div>
    <div className="flex flex-wrap gap-2">{markers.map(([id,label])=><button key={id} aria-pressed={day.markers.includes(id)} onClick={()=>update({markers:day.markers.includes(id)?day.markers.filter(m=>m!==id):[...day.markers,id]})} className={`rounded-full border px-3 py-2 text-xs ${day.markers.includes(id)?"bg-indigo-600 text-white border-indigo-600":"border-gray-300 dark:border-gray-600"}`}>{label}</button>)}</div>
    <label className="block text-sm">Recordatorio del día<input aria-label="Recordatorio del día" value={day.reminder??""} onChange={e=>update({reminder:e.target.value})} placeholder="Ej. revisar respuesta y ajustar carbohidratos" className="block w-full mt-2 border rounded-xl p-3 dark:bg-gray-800"/></label>
    <p className="text-xs text-gray-500">El recordatorio aparece en esta fecha del calendario. Guarda la configuración para conservarlo.</p>
    <label className="block text-sm">Notas y respuesta del atleta<textarea aria-label="Notas del día" value={day.notes} onChange={e=>update({notes:e.target.value})} rows={3} className="block w-full mt-2 border rounded-xl p-3 dark:bg-gray-800" placeholder="Peso, digestión, apariencia, entrenamiento y observaciones…"/></label>
   </div>
   <div className="overflow-x-auto"><table className="w-full text-sm whitespace-nowrap"><caption className="text-left font-semibold py-3">Resumen de fechas planificadas</caption><thead><tr className="text-gray-500 border-b">{["Fecha","Fase","Proteína","Carbohidratos","Grasas","Calorías"].map(h=><th key={h} className="text-left p-3">{h}</th>)}</tr></thead><tbody>{days.map((d,i)=><tr key={d.date} className="border-b border-gray-100 dark:border-gray-800"><td className="p-3">{dateLabel(d.date)}</td><td className="p-3">{d.phase}</td>{fields.map(f=><td key={f} className="p-3 tabular-nums">{resolved[i]?.[f]??"—"} g</td>)}<td className="p-3 tabular-nums">{resolved[i]?Math.round(resolved[i]!.kcal):"Inválido"}</td></tr>)}</tbody></table></div>
   <button onClick={()=>setGuide(!guide)} className="text-sm text-indigo-600 hover:underline">Cómo planificar los ajustes</button>
   {guide&&<div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 p-4 text-sm space-y-2"><p>La carga de carbohidratos busca aumentar el glucógeno muscular. La respuesta individual y digestiva varía: ensaya previamente y registra resultados antes de repetir una estrategia.</p><p>La app inicia con tus macros base. Cambia cada nutriente de forma explícita y revisa las calorías resultantes. No existe un multiplicador universal para descarga o carga. Agua y sodio se registran en notas, sin recortes automáticos.</p><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC10787737/" target="_blank" rel="noreferrer" className="underline">Revisión científica de Peak Week (2024)</a></div>}
   <div className="flex flex-wrap gap-3 items-center">
    <button onClick={()=>save(false)} className="rounded-xl border px-4 py-2 text-sm">Guardar configuración</button>
    <button disabled={!latestMacros} onClick={()=>save(true)} className="rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm disabled:opacity-40">Crear / actualizar 7 planes</button>
    {dirty&&<span className="text-xs text-amber-600">Cambios sin guardar</span>}
   </div>
   <p role="status" className="text-sm text-indigo-600">{message}</p>
  </div>
 </section>;
}
