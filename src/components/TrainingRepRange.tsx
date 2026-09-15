"use client";
import {useState} from 'react';
export function parseTrainingRepRange(value:string):{min:number;max:number}|null {
 const match=value.trim().match(/^(\d{1,3})\s*(?:[-–]\s*(\d{1,3}))?$/);
 if(!match)return null;
 const min=Number(match[1]),max=Number(match[2]??match[1]);
 return min>=0&&max<=200&&min<=max?{min,max}:null;
}
export function TrainingRepRange({min,max,label,onCommit}:{min:number;max:number;label:string;onCommit:(min:number,max:number)=>void}){
 const [draft,setDraft]=useState<string|null>(null);const [error,setError]=useState('');
 const formatted=`${min} - ${max}`;
 function commit(){if(draft===null)return;const range=parseTrainingRepRange(draft);if(range){onCommit(range.min,range.max);setError('');}else setError('Usa un rango de 0 a 200, como 12 - 15. Se conservó el anterior.');setDraft(null);}
 return <label>Reps<input type="text" aria-label={label} aria-invalid={!!error} value={draft??formatted} onFocus={()=>setDraft(formatted)} onChange={event=>{setDraft(event.target.value);setError('');}} onBlur={commit} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}if(event.key==='Escape'){event.preventDefault();setDraft(null);setError('');}}}/>{error&&<small className="training-range-error" role="alert">{error}</small>}</label>;
}
