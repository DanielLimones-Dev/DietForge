import {useState} from 'react';
import type {PeakWeekDayConfig} from '@/types';

/** Calendar dates are civil dates, independent of the browser timezone. */
export function calendarCells(month:string){
 const first=new Date(month+'-01T12:00:00Z');
 const offset=(first.getUTCDay()+6)%7;
 return Array.from({length:42},(_,i)=>{const d=new Date(first);d.setUTCDate(1-offset+i);return d.toISOString().slice(0,10);});
}
export function PeakCalendar({showDate,days,selected,onSelect}:{showDate:string;days:PeakWeekDayConfig[];selected:string;onSelect:(date:string)=>void}){
 const [month,setMonth]=useState(showDate.slice(0,7));
 const shift=(n:number)=>{const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);setMonth(d.toISOString().slice(0,7));};
 return <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800"><button type="button" aria-label="Mes anterior" onClick={()=>shift(-1)} className="p-2">←</button><h4 className="font-semibold capitalize">{new Date(month+'-01T12:00:00').toLocaleDateString('es-MX',{month:'long',year:'numeric'})}</h4><button type="button" aria-label="Mes siguiente" onClick={()=>shift(1)} className="p-2">→</button></div>
  <div className="overflow-x-auto"><div className="min-w-[560px] grid grid-cols-7">
   {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(label=><div key={label} className="p-2 text-xs text-center text-gray-500 border-b">{label}</div>)}
   {calendarCells(month).map(date=>{const d=days.find(d=>d.date===date);return <button type="button" key={date} aria-label={`Seleccionar ${date}`} aria-pressed={selected===date} onClick={()=>onSelect(date)} className={`min-h-28 p-2 flex flex-col items-start justify-start text-left border-b border-r border-gray-200 dark:border-gray-700 text-xs ${selected===date?'bg-indigo-100 dark:bg-indigo-950 ring-2 ring-inset ring-indigo-500':date.startsWith(month)?'bg-white dark:bg-gray-900':'bg-gray-50 text-gray-400 dark:bg-gray-800'}`}>
    <span className="font-semibold">{Number(date.slice(-2))}</span>
    {date===showDate.slice(0,10)&&<span className="block text-emerald-600 font-semibold">Competencia</span>}
    {d?.reminder&&<span className="block mt-1 rounded bg-amber-100 text-amber-900 p-1 break-words">{d.reminder}</span>}
    {d?.carbs!==undefined&&<span className="block mt-1 text-indigo-500">Carbos: {d.carbs} g</span>}
    {d?.markers.includes('macro_adjust')&&<span className="block text-indigo-500">Ajuste de macros</span>}
    {d?.notes&&<span className="block text-gray-500">• Notas</span>}
   </button>;})}
  </div></div>
 </div>;
}
