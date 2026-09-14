'use client';
import {useCallback,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {readPortal} from '@/lib/client-portal';
import {useAutoRefresh} from '@/lib/use-auto-refresh';
import {sessionsFromActivity,type TrainingSession} from '@/lib/training-tracking';
export function TrainingLiveFeedback({clientId,programId,week}:{clientId:number;programId:number;week:number}){
 const [sessions,setSessions]=useState<TrainingSession[]>([]);
 const read=useCallback(async()=>{const {data}=await supabase.auth.getUser();if(!data.user)throw new Error('Sin sesión');return readPortal(data.user.id,clientId);},[clientId]);
 const apply=useCallback((value:Awaited<ReturnType<typeof readPortal>>)=>setSessions(sessionsFromActivity(value.activity)),[]);
 const failed=useAutoRefresh(read,apply);
 const selected=sessions.filter(s=>s.program_id===programId&&s.week===week).sort((a,b)=>b.date.localeCompare(a.date));
 return <section className="care-card"><h3>Feedback del cliente</h3><p role="status">{failed?'No se pudo sincronizar. Reintentando…':'Actualización automática cada 5 s'}</p>{!selected.length&&<p>Aún no hay registros guardados para esta semana.</p>}{selected.map((s,i)=><details key={`${s.day_id}-${s.date}-${i}`} className="care-inset"><summary>{s.date} · Fatiga {s.fatigue}/10 · {s.completed?'Completada':'En curso'}</summary><p>{s.notes||'Sin comentarios.'}</p>{s.exercises.map(e=><div key={e.exercise_id}><strong>{e.name}</strong>{e.sets.map((set,j)=><p key={j}>Serie {j+1}: {set.kg} kg · {set.reps} reps · RIR {set.rir} {set.completed?'✓':''}</p>)}</div>)}</details>)}</section>;
}
