'use client';

import {useState,type CSSProperties,type MouseEvent} from 'react';
import type {TrainingProgram} from '@/types';
import {firstTrainingWeek,trainingDays} from '@/lib/training';
import {TrainingVideo} from './TrainingMedia';
import {exerciseVideo} from '@/lib/training-media';

const DAY_INITIALS=['L','M','M','J','V','S','D'];
const DAY_NAMES=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

function dayShortLetter(dayNumber:number,index:number){
 const pos=(dayNumber>0?dayNumber-1:index);
 return DAY_INITIALS[pos]??`D${dayNumber||index+1}`;
}

function dayFullLabel(dayNumber:number,index:number){
 const pos=(dayNumber>0?dayNumber-1:index);
 return DAY_NAMES[pos]??`Día ${dayNumber||index+1}`;
}

export function PortalMesocycle({programs,coach=false}:{programs:TrainingProgram[];coach?:boolean}){
 const list=programs??[];
 const [programId,setProgramId]=useState(list[0]?.id??0);
 const program=list.find(item=>item.id===programId)??list[0];
 const [week,setWeek]=useState(()=>firstTrainingWeek(list[0]));
 const [selectedDayId,setSelectedDayId]=useState<string>('');
 const [ripple,setRipple]=useState<{dayId:string;x:number;y:number;panelY:number;key:number}>({
  dayId:'',
  x:50,
  y:50,
  panelY:18,
  key:0,
 });

 if(!list.length)return <section className="care-card portal-section"><header className="portal-section-head"><div><span className="portal-kicker">Mi rutina</span><h2>Tu rutina</h2><p>{coach?'Este cliente todavía no tiene una rutina. Créala en Planificación › Rutinas.':'Tu coach todavía no ha publicado tu rutina. Aparecerá aquí con tus días y ejercicios en cuanto la active.'}</p></div></header></section>;

 const totalWeeks=Math.max(1,program.duration_weeks||1);
 const selectedWeek=Math.min(Math.max(1,week),totalWeeks);
 const days=trainingDays(program,selectedWeek)??[];
 const activeDay=days.find(d=>d.id===selectedDayId)??days[0]??null;
 const activeDayIndex=activeDay?days.findIndex(d=>d.id===activeDay.id):0;

 const handleSelectDay=(dayId:string,index:number,event:MouseEvent<HTMLButtonElement>)=>{
  const rect=event.currentTarget.getBoundingClientRect();
  const hasPointer=event.clientX!==0||event.clientY!==0;
  const x=hasPointer&&rect.width>0?Math.min(100,Math.max(0,((event.clientX-rect.left)/rect.width)*100)):50;
  const y=hasPointer&&rect.height>0?Math.min(100,Math.max(0,((event.clientY-rect.top)/rect.height)*100)):50;
  const panelY=days.length>1?Math.round(((index+0.5)/days.length)*68+8):18;
  setSelectedDayId(dayId);
  setRipple(prev=>({dayId,x,y,panelY,key:prev.key+1}));
 };

 return <section className="care-card portal-mesocycle" aria-labelledby="portal-mesocycle-title">
  <header><div className="portal-mesocycle-title"><div><span className="training-kicker">RUTINA ASIGNADA</span><h2 id="portal-mesocycle-title">{program.name}</h2><p>Mesociclo {program.mesocycle_number} · Rotación {program.rotation_number}{program.split?` · ${program.split}`:''}</p>{program.status!=='active'&&<span className="portal-status is-off">Borrador · el cliente aún no la ve</span>}</div></div>{list.length>1&&<label>Rutina<select value={program.id} onChange={event=>{const next=list.find(item=>item.id===Number(event.target.value));setProgramId(Number(event.target.value));setWeek(firstTrainingWeek(next??program));setSelectedDayId('');}}>{list.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}</header>
  {program.notes&&<p className="portal-mesocycle-note">{program.notes}</p>}
  <nav className="portal-week-tabs" aria-label="Semanas del mesociclo">{Array.from({length:totalWeeks},(_,index)=>index+1).map(value=>{const count=(trainingDays(program,value)??[]).length;return <button type="button" key={value} aria-current={selectedWeek===value?'page':undefined} className={selectedWeek===value?'selected':''} onClick={()=>{setWeek(value);setSelectedDayId('');}}>Semana {value}<small>{count===1?'1 día':`${count} días`}</small></button>;})}</nav>

  <section className="portal-training-week" aria-labelledby={`portal-week-${selectedWeek}`}>
   <header>
    <h3 id={`portal-week-${selectedWeek}`}>Semana {selectedWeek}</h3>
    <span>{days.length===1?'1 día programado':`${days.length} días programados`}</span>
   </header>

   {!days.length?(
    <p className="portal-training-empty">Esta semana aún no tiene días programados.</p>
   ):(
    <div className="portal-days-layout">
     <nav className="portal-day-rail" aria-label="Días de la semana">
      {days.map((day,index)=>{
       const active=activeDay?.id===day.id;
       const letter=dayShortLetter(day.day_number,index);
       const dayLabel=dayFullLabel(day.day_number,index);
       const isRest=day.exercises.length===0;
       const isRippling=ripple.dayId===day.id&&ripple.key>0;
       const btnStyle=isRippling
        ?({'--drop-x':`${ripple.x}%`,'--drop-y':`${ripple.y}%`} as CSSProperties)
        :undefined;
       return (
        <button
         key={day.id}
         type="button"
         onClick={e=>handleSelectDay(day.id,index,e)}
         aria-pressed={active}
         aria-label={`${dayLabel}: ${day.name} (${day.exercises.length===1?'1 ejercicio':`${day.exercises.length} ejercicios`})`}
         title={`${dayLabel} · ${day.name}`}
         style={btnStyle}
         className={`portal-day-pill ${active?'is-active':''} ${isRest?'is-rest':''}`}
        >
         {isRippling&&(
          <span key={ripple.key} className="portal-day-ripple" aria-hidden="true">
           <i className="portal-day-drop"/>
           <i className="portal-day-ring is-one"/>
           <i className="portal-day-ring is-two"/>
           <i className="portal-day-ring is-three"/>
          </span>
         )}
         <strong className="portal-day-letter">{letter}</strong>
        </button>
       );
      })}
     </nav>

     {activeDay&&(
      <article
       key={`${selectedWeek}-${activeDay.id}-${ripple.dayId===activeDay.id?ripple.key:0}`}
       style={{'--panel-ripple-y':`${ripple.dayId===activeDay.id?ripple.panelY:Math.round(((activeDayIndex+0.5)/Math.max(1,days.length))*68+8)}%`} as CSSProperties}
       className="portal-training-day portal-day-stage"
      >
       <header>
        <div>
         <strong>{String(activeDay.day_number).padStart(2,'0')}</strong>
         <div>
          <h4>{activeDay.name}</h4>
          {activeDay.notes&&<p>{activeDay.notes}</p>}
         </div>
        </div>
        <span>{activeDay.exercises.length===1?'1 ejercicio':`${activeDay.exercises.length} ejercicios`}</span>
       </header>
       {activeDay.exercises.length?(
        <div className="portal-training-exercises">
         {activeDay.exercises.map((exercise,exIdx)=>{
          const prescription=exercise.prescriptions.find(item=>item.week===selectedWeek);
          return (
           <article
            className="portal-training-exercise portal-day-exercise-item"
            style={{'--ex-i':exIdx} as CSSProperties}
            key={exercise.id}
           >
            <div>
             <strong>{exercise.name}</strong>
             <span>{exercise.muscle_group}</span>
             {exercise.notes&&<p>{exercise.notes}</p>}
            </div>
            {prescription?(
             <dl>
              <div><dt>Series</dt><dd>{prescription.sets}</dd></div>
              <div><dt>Reps</dt><dd>{prescription.reps_min}–{prescription.reps_max}</dd></div>
              <div><dt>RIR</dt><dd>{prescription.rir_end}</dd></div>
              {prescription.load_kg!=null&&<div><dt>Carga</dt><dd>{prescription.load_kg} kg</dd></div>}
             </dl>
            ):(
             <p className="portal-training-empty">Sin prescripción para esta semana.</p>
            )}
            {exerciseVideo(exercise)&&<TrainingVideo key={`${program.id}-${selectedWeek}-${exercise.id}-${exerciseVideo(exercise)}`} value={exerciseVideo(exercise)} label={`Ver técnica: ${exercise.name}`}/>}
           </article>
          );
         })}
        </div>
       ):(
        <p className="portal-training-empty">Día de descanso.</p>
       )}
      </article>
     )}
    </div>
   )}
  </section>
 </section>;
}
