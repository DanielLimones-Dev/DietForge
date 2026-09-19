'use client';

import {useState} from 'react';
import type {TrainingProgram} from '@/types';
import {trainingDays} from '@/lib/training';
import {TrainingVideo} from './TrainingMedia';
import {exerciseVideo} from '@/lib/training-media';

export function PortalMesocycle({programs}:{programs:TrainingProgram[]}){
 const [programId,setProgramId]=useState(programs[0]?.id??0);
 const program=programs.find(item=>item.id===programId)??programs[0];
 const [week,setWeek]=useState(1);
 if(!programs.length)return <section className="care-card"><h2>Rutina asignada</h2><p>Tu coach aún no ha asignado una rutina.</p></section>;
 const selectedWeek=Math.min(Math.max(1,week),program.duration_weeks);
 const days=trainingDays(program,selectedWeek);
 return <section className="care-card portal-mesocycle" aria-labelledby="portal-mesocycle-title">
  <header><div><span className="training-kicker">RUTINA ASIGNADA</span><h2 id="portal-mesocycle-title">{program.name}</h2><p>Mesociclo {program.mesocycle_number} · Rotación {program.rotation_number}{program.split?` · ${program.split}`:''}</p></div>{programs.length>1&&<label>Rutina<select value={program.id} onChange={event=>{setProgramId(Number(event.target.value));setWeek(1);}}>{programs.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}</header>
  {program.notes&&<p className="portal-mesocycle-note">{program.notes}</p>}
  <nav className="portal-week-tabs" aria-label="Semanas del mesociclo">{Array.from({length:program.duration_weeks},(_,index)=>index+1).map(value=><button type="button" key={value} aria-current={selectedWeek===value?'page':undefined} className={selectedWeek===value?'selected':''} onClick={()=>setWeek(value)}>Semana {value}<small>{trainingDays(program,value).length} días</small></button>)}</nav>
  <section className="portal-training-week" aria-labelledby={`portal-week-${selectedWeek}`}><header><h3 id={`portal-week-${selectedWeek}`}>Semana {selectedWeek}</h3><span>{days.length} días programados</span></header>{days.length?days.map(day=><article className="portal-training-day" key={day.id}><header><div><strong>{String(day.day_number).padStart(2,'0')}</strong><div><h4>{day.name}</h4>{day.notes&&<p>{day.notes}</p>}</div></div><span>{day.exercises.length} ejercicios</span></header>{day.exercises.length?<div className="portal-training-exercises">{day.exercises.map(exercise=>{const prescription=exercise.prescriptions.find(item=>item.week===selectedWeek);return <article className="portal-training-exercise" key={exercise.id}><div><strong>{exercise.name}</strong><span>{exercise.muscle_group}</span>{exercise.notes&&<p>{exercise.notes}</p>}</div>{prescription?<dl><div><dt>Series</dt><dd>{prescription.sets}</dd></div><div><dt>Reps</dt><dd>{prescription.reps_min}–{prescription.reps_max}</dd></div><div><dt>RIR</dt><dd>{prescription.rir_end}</dd></div>{prescription.load_kg!=null&&<div><dt>Carga</dt><dd>{prescription.load_kg} kg</dd></div>}</dl>:<p className="portal-training-empty">Sin prescripción para esta semana.</p>}{exerciseVideo(exercise)&&<TrainingVideo key={`${program.id}-${selectedWeek}-${exercise.id}-${exerciseVideo(exercise)}`} value={exerciseVideo(exercise)} label={`Ver técnica: ${exercise.name}`}/>}</article>;})}</div>:<p className="portal-training-empty">Día de descanso.</p>}</article>):<p className="portal-training-empty">Esta semana aún no tiene días programados.</p>}</section>
 </section>;
}
