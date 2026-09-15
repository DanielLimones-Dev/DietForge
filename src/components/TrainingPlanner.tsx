"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Copy, Dumbbell, Plus, Printer, Save, Search, Trash2 } from "lucide-react";
import exerciseData from "@/data/training-exercises.json";
import { mergedExerciseLibrary } from "@/lib/exercise-library";
import { db } from "@/lib/db";
import { copyTrainingWeek, createTrainingDraft, exerciseFromLibrary, independentTrainingProgram, replaceTrainingDays, resizeProgramWeeks, normalizeTrainingWeeks, trainingDays, trainingSaveErrors, trainingProgramIssues } from "@/lib/training";
import { printTrainingProgram } from "@/lib/training-pdf";
import type { ExerciseLibraryItem, TrainingExercise, TrainingGoal, TrainingProgram } from "@/types";
import { useToast } from "./Toast";
import { ConfirmDialog } from "./ui";
import {TrainingRepRange} from "./TrainingRepRange";
import {TrainingLiveFeedback} from "./TrainingLiveFeedback";
import {TrainingTools} from "./TrainingTools";
import {TrainingVideoEditor} from './TrainingMedia';
import {exerciseVideo} from '@/lib/training-media';
import {detailedVolume} from '@/lib/training-tracking';

const baseLibrary = exerciseData as ExerciseLibraryItem[];
const goals: { value: TrainingGoal; label: string }[] = [
  { value: "hypertrophy", label: "Hipertrofia" }, { value: "strength", label: "Fuerza" },
  { value: "recomposition", label: "Recomposición" }, { value: "conditioning", label: "Acondicionamiento" },
  { value: "maintenance", label: "Mantenimiento" },
];

function asProgram(clientId: number, clientName: string): TrainingProgram {
  const now = new Date().toISOString();
  return { ...createTrainingDraft(clientId, clientName), id: 0, created_at: now, updated_at: now };
}

export function TrainingPlanner() {
  const { id } = useParams<{ id?: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const clientId = Number(id);
  const client = db.getClient(clientId);
  const [programs, setPrograms] = useState(() => db.getTrainingPrograms(clientId));
  const [draft, setDraft] = useState<TrainingProgram | null>(() => {const loaded=db.getTrainingPrograms(clientId)[0];return loaded?independentTrainingProgram(loaded):null;});
  const [dirty, setDirty] = useState(false);
  const [week, setWeek] = useState(1);
  const [dayId, setDayId] = useState(() => db.getTrainingPrograms(clientId)[0]?.days[0]?.id ?? "");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [replacing,setReplacing]=useState<string|null>(null);
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState("Todos");
  const [addedExerciseCount, setAddedExerciseCount] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!libraryOpen) return;
    const root = document.documentElement;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setLibraryOpen(false); setReplacing(null); }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      root.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.paddingRight = previousBodyPaddingRight;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [libraryOpen]);

  const mutate = (change: (program: TrainingProgram) => void) => {
    setDraft(current => {
      if (!current) return current;
      const next = structuredClone(current); change(next); replaceTrainingDays(next,week,trainingDays(next,week)); return next;
    });
    setDirty(true);
  };

  const currentDays = draft ? trainingDays(draft,week) : [];
  const library = useMemo<ExerciseLibraryItem[]>(() => mergedExerciseLibrary(db.getExercises(), baseLibrary), []);
  const selectedDay = currentDays.find(day => day.id === dayId) ?? currentDays[0];
  const weeklySeries = useMemo(() => draft ? detailedVolume(draft, week) : [], [draft, week]);
  const issues = useMemo(() => draft ? trainingProgramIssues(draft, week) : [], [draft, week]);
  const muscleGroups = useMemo(() => ["Todos", ...Array.from(new Set(library.map(item => item.muscle_group))).sort()], [library]);
  const allWeeklySeries = useMemo(() => Array.from(new Set([...muscleGroups.filter(group=>group!=="Todos"),...weeklySeries.map(item=>item.muscle),...Object.keys(draft?.weekly_volume_targets?.[String(week)]??{})])).sort().map(muscle=>weeklySeries.find(item=>item.muscle===muscle)??{muscle,direct:0,indirect:0,total:0,frequency:0}),[muscleGroups,weeklySeries,draft,week]);
  const weeklyTargetTotal=allWeeklySeries.reduce((sum,item)=>sum+(draft?.weekly_volume_targets?.[String(week)]?.[item.muscle]??item.direct),0);
  const weeklyDirectTotal=allWeeklySeries.reduce((sum,item)=>sum+item.direct,0);
  const weeklyProgress=weeklyTargetTotal>0?Math.min(100,Math.round(weeklyDirectTotal/weeklyTargetTotal*100)):0;
  const filteredLibrary = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return library.filter(item => (muscle === "Todos" || item.muscle_group === muscle) && (!query || `${item.name} ${item.muscle_group}`.toLocaleLowerCase("es").includes(query))).slice(0, 80);
  }, [search, muscle, library]);

  if (!client) return <div className="training-page"><button className="training-back" onClick={() => router.push("/clients")}><ArrowLeft size={16}/>Volver a clientes</button><div className="training-empty"><h1>Cliente no encontrado</h1></div></div>;

  const startNew = () => {
    if(dirty&&!window.confirm("Hay cambios sin guardar. ¿Abrir una rutina nueva y descartarlos?"))return;
    const next = independentTrainingProgram(asProgram(clientId, client.name)); setDraft(next); setDayId(trainingDays(next,1)[0].id); setWeek(1); setDirty(true);
  };
  const chooseProgram = (program: TrainingProgram) => { if(dirty&&!window.confirm("¿Cambiar de rutina y descartar los cambios sin guardar?"))return; const next=independentTrainingProgram(program);setDraft(next); setDayId(trainingDays(next,1)[0]?.id ?? ""); setWeek(1); setDirty(false); };
  const save = () => {
    if (!draft || !draft.name.trim()) { toast("Escribe un nombre para la rutina.", "error"); return; }
    const errors = trainingSaveErrors(draft);
    if (errors.length) { toast(errors[0], "error"); return; }
    if (draft.id === 0) {
      const data = {
        client_id: draft.client_id, name: draft.name, objective: draft.objective, start_date: draft.start_date,
        duration_weeks: draft.duration_weeks, mesocycle_number: draft.mesocycle_number, rotation_number: draft.rotation_number,
        priorities: draft.priorities, split: draft.split, notes: draft.notes, status: draft.status, days: draft.days, week_days:draft.week_days, weekly_volume_targets:draft.weekly_volume_targets, review: draft.review, volume_ranges:draft.volume_ranges, approval_history:draft.approval_history, resources:draft.resources,
      };
      const saved = db.saveTrainingProgram(data); setDraft(saved); setPrograms(db.getTrainingPrograms(clientId)); setDirty(false); toast("Rutina creada. Sincronizando cambios…");
    } else {
      const saved = db.updateTrainingProgram(draft.id, draft);
      if (saved) { setDraft(saved); setPrograms(db.getTrainingPrograms(clientId)); setDirty(false); toast("Rutina actualizada."); }
    }
  };
  const removeProgram = () => {
    if (!draft || draft.id === 0) { setDraft(programs[0] ?? null); setDeleteOpen(false); return; }
    db.deleteTrainingProgram(draft.id); const remaining = db.getTrainingPrograms(clientId); setPrograms(remaining); setDraft(remaining[0] ?? null); setDayId(remaining[0]?.days[0]?.id ?? ""); setDeleteOpen(false); toast("Rutina eliminada.");
  };
  const addExercise = (item: ExerciseLibraryItem) => {
    if (!selectedDay || !draft) return;
    const isReplacement = Boolean(replacing);
    mutate(program => {const day=trainingDays(program,week).find(day=>day.id===selectedDay.id);if(!day)return;const trustedVideo=item.id.startsWith("coach-")?(item.video_url??undefined):undefined;if(replacing){const ex=day.exercises.find(e=>e.id===replacing);if(ex){ex.name=item.name;ex.library_id=item.id;ex.muscle_group=item.muscle_group;ex.video_url=trustedVideo;ex.video_custom=true;ex.notes=item.notes??"";ex.secondary_muscles=[];}}else{const exercise=exerciseFromLibrary(item,program.duration_weeks);exercise.video_url=trustedVideo;exercise.notes=item.notes??"";day.exercises.push(exercise);}});
    setReplacing(null);
    if (isReplacement) { setLibraryOpen(false); toast(`${item.name} sustituyó al ejercicio anterior.`); }
    else { setAddedExerciseCount(value => value + 1); toast(`${item.name} agregado. Puedes elegir otro.`); }
  };
  const openExerciseDatabase = () => {
    if (dirty && !window.confirm("Guarda primero la rutina si quieres conservar estos cambios. ¿Abrir la base de ejercicios ahora?")) return;
    setLibraryOpen(false); setReplacing(null); router.push("/exercises");
  };
  const updateExercise = (exerciseId: string, change: (exercise: TrainingExercise) => void) => mutate(program => {
    const exercise = trainingDays(program,week).find(day => day.id === selectedDay?.id)?.exercises.find(item => item.id === exerciseId); if (exercise) change(exercise);
  });
  const applyPrescriptionToAllWeeks = (exerciseId: string, source: TrainingExercise["prescriptions"][number]) => mutate(program => {
    for (let targetWeek = 1; targetWeek <= program.duration_weeks; targetWeek += 1) {
      for (const day of trainingDays(program, targetWeek)) {
        const exercise = day.exercises.find(item => item.id === exerciseId);
        if (!exercise) continue;
        exercise.prescriptions = exercise.prescriptions.map(value => value.week === targetWeek ? { ...source, week: targetWeek } : value);
      }
    }
  });
  const moveExercise = (exerciseId: string, direction: -1 | 1) => mutate(program => {
    const exercises = trainingDays(program,week).find(day => day.id === selectedDay?.id)?.exercises; if (!exercises) return;
    const index = exercises.findIndex(item => item.id === exerciseId); const target = index + direction;
    if (index >= 0 && target >= 0 && target < exercises.length) [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
  });
  const removeExercise = (exerciseId: string) => mutate(program => {
    const day = trainingDays(program,week).find(item => item.id === selectedDay?.id); if (day) day.exercises = day.exercises.filter(item => item.id !== exerciseId);
  });
  const addDay = () => mutate(program => {
    const days=trainingDays(program,week);if (days.length >= 7) return;
    const next = days.length + 1; const newDay = { id: `day-${crypto.randomUUID()}`, day_number: next, name: `Día ${next}`, notes: "", exercises: [] };
    days.push(newDay); setDayId(newDay.id);
  });
  const removeDay = () => {
    if (!draft || currentDays.length <= 1 || !selectedDay) return;
    const fallback = currentDays.find(day => day.id !== selectedDay.id)?.id ?? "";
    mutate(program => { replaceTrainingDays(program,week,trainingDays(program,week).filter(day => day.id !== selectedDay.id).map((day, index) => ({ ...day, day_number: index + 1 }))); }); setDayId(fallback);
  };

  return <div className="training-page">
    <header className="training-hero">
      <div><button className="training-back" onClick={() => router.push(`/clients/${clientId}`)}><ArrowLeft size={16}/>Expediente</button><span className="training-kicker"><Dumbbell size={14}/> PROGRAMACIÓN DE ENTRENAMIENTO</span><h1>{client.name}</h1><p>Rutinas por bloques, progresión semanal, volumen por músculo y videos técnicos.</p></div>
      <div className="training-hero-actions"><button onClick={startNew}><Plus size={16}/>Nueva rutina</button>{draft&&<><button onClick={() => { try { printTrainingProgram(draft, client); } catch (error) { toast(error instanceof Error ? error.message : "No se pudo imprimir.", "error"); } }}><Printer size={16}/>PDF</button><button className="primary" onClick={save}><Save size={16}/>{dirty ? "Guardar cambios" : "Guardado"}</button></>}</div>
    </header>

    {draft&&<section className="training-media-section" aria-label="Material de apoyo"><h2>Videos y material de apoyo</h2><p>Agrega tus propias explicaciones de RIR, calentamiento o uso del programa para mostrarlas en el portal.</p>{(draft.resources??[]).map(resource=><div className="training-media-resource" key={resource.id}><input aria-label="Título del material" value={resource.title} onChange={e=>mutate(p=>{const r=p.resources?.find(r=>r.id===resource.id);if(r)r.title=e.target.value;})}/><TrainingVideoEditor value={resource.url} label={`Video de ${resource.title||'apoyo'}`} onChange={url=>mutate(p=>{const r=p.resources?.find(r=>r.id===resource.id);if(r)r.url=url;})}/><button onClick={()=>mutate(p=>{p.resources=p.resources?.filter(r=>r.id!==resource.id);})}>Eliminar material</button></div>)}<button onClick={()=>mutate(p=>{p.resources=[...(p.resources??[]),{id:crypto.randomUUID(),title:'Mi explicación',url:''}];})}>+ Agregar mi explicación</button></section>}

    {programs.length > 0 && <nav className="training-program-tabs" aria-label="Rutinas del cliente">{programs.map(program => <button key={program.id} className={draft?.id === program.id ? "active" : ""} onClick={() => chooseProgram(program)}><span>{program.name}</span><small>{program.duration_weeks} sem · {program.status === "active" ? "Activa" : program.status === "draft" ? "Borrador" : "Archivada"}</small></button>)}</nav>}

    {!draft ? <section className="training-empty"><span><Dumbbell size={28}/></span><h2>Crea la primera rutina personalizada</h2><p>Empieza con cinco días y cinco semanas. Puedes adaptar cada ejercicio, serie, rango de repeticiones y RIR.</p><button onClick={startNew}><Plus size={16}/>Crear rutina</button></section> : <>
      <TrainingTools program={draft} week={week} onChange={p=>{setDraft(independentTrainingProgram(p));setDirty(true);}} onOpen={p=>{if(dirty&&!window.confirm("¿Cargar esta rutina y descartar los cambios sin guardar?"))return;const next=independentTrainingProgram(p);setDraft(next);setDayId(trainingDays(next,1)[0]?.id??"");setWeek(1);setDirty(p.id===0);setPrograms(db.getTrainingPrograms(clientId));}}/>
      <section className="training-setup">
        <label className="wide">Nombre del bloque<input value={draft.name} onChange={event => mutate(program => { program.name = event.target.value; })}/></label>
        <label>Objetivo<select value={draft.objective} onChange={event => mutate(program => { program.objective = event.target.value as TrainingGoal; })}>{goals.map(goal => <option key={goal.value} value={goal.value}>{goal.label}</option>)}</select></label>
        <label>Inicio<input type="date" value={draft.start_date} onChange={event => mutate(program => { program.start_date = event.target.value; })}/></label>
        <label>Semanas<input type="number" min="1" max="12" value={draft.duration_weeks} onChange={event => { const value = normalizeTrainingWeeks(Number(event.target.value)); setDraft(current => current ? resizeProgramWeeks(current, value) : current); setDirty(true); setWeek(current => Math.min(current, value)); }}/></label>
        <label>Mesociclo<input type="number" min="1" value={draft.mesocycle_number} onChange={event => mutate(program => { program.mesocycle_number = Number(event.target.value) || 1; })}/></label>
        <label>Rotación<input type="number" min="1" value={draft.rotation_number} onChange={event => mutate(program => { program.rotation_number = Number(event.target.value) || 1; })}/></label>
        <label className="wide">Split / distribución<input value={draft.split} placeholder="Ej. Upper · Lower · Descanso · Push · Pull" onChange={event => mutate(program => { program.split = event.target.value; })}/></label>
        <label className="wide">Prioridades<input value={draft.priorities.join(", ")} placeholder="Ej. Brazos, espalda, cuádriceps" onChange={event => mutate(program => { program.priorities = event.target.value.split(",").map(value => value.trim()).filter(Boolean).slice(0, 5); })}/></label>
        <label>Estado<select value={draft.status} onChange={event => mutate(program => { program.status = event.target.value as TrainingProgram["status"]; })}><option value="draft">Borrador</option><option value="active">Activa</option><option value="archived">Archivada</option></select></label>
        <label className="full">Indicaciones generales<textarea rows={2} value={draft.notes ?? ""} onChange={event => mutate(program => { program.notes = event.target.value; })}/></label>
      </section>

      <section className="training-volume-overview training-volume-minimal" aria-labelledby="weekly-series-title">
        <header><div><span>SEMANA {week} · VOLUMEN PROGRAMADO</span><h2 id="weekly-series-title">Distribución de series</h2></div><div className="series-week-nav"><button type="button" aria-label="Semana anterior de volumen" disabled={week<=1} onClick={()=>{setWeek(week-1);setDayId(trainingDays(draft,week-1)[0]?.id??"");}}><ArrowLeft size={16}/></button><span>Semana {week} / {draft.duration_weeks}</span><button type="button" aria-label="Semana siguiente de volumen" disabled={week>=draft.duration_weeks} onClick={()=>{setWeek(week+1);setDayId(trainingDays(draft,week+1)[0]?.id??"");}}><ArrowRight size={16}/></button></div></header>
        <div className="series-summary"><div><span>Series directas / meta</span><strong>{weeklyDirectTotal} <small>/ {weeklyTargetTotal}</small></strong><span>{weeklyTargetTotal>0?`${weeklyProgress}%`:"Sin meta activa"}</span></div><div className="series-summary-meta"><span>{allWeeklySeries.reduce((sum,item)=>sum+item.indirect,0).toFixed(1)} indirectas</span><span>{allWeeklySeries.reduce((sum,item)=>sum+item.total,0).toFixed(1)} efectivas</span><span>{currentDays.length} días</span></div><progress aria-label={`Cumplimiento general semana ${week}`} max="100" value={weeklyProgress}/><p>Suma todos los días de esta semana. Cada semana conserva sus propias metas.</p></div>
        <div className="series-groups">
          {[
            {name:"Torso",match:/(pectoral|pecho|espalda|dorsal|trapecio|hombro|deltoide)/},
            {name:"Brazos y core",match:/(biceps|triceps|antebrazo|abdomen|abdominal|core|oblicuo)/},
            {name:"Pierna",match:/(cuadriceps|isquio|femoral|gluteo|aductor|abductor|pantorrilla|gemelo|soleo|tibial|pierna)/},
          ].map((group,index,groups)=>{
            const items=allWeeklySeries.filter(item=>{const name=item.muscle.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();const matched=groups.findIndex(candidate=>candidate.match?.test(name));return matched===index;});
            if(!items.length)return null;
            return <section className="series-group" key={group.name}><header><h3>{group.name}</h3><span>{items.length} grupos</span></header>{items.map(item=>{
              const target=draft.weekly_volume_targets?.[String(week)]?.[item.muscle]??item.direct;
              const progress=target>0?Math.min(100,Math.round(item.direct/target*100)):0;
              const difference=item.direct-target;
              const muscleName=item.muscle.toLocaleLowerCase("es");
              const priority=draft.priorities.some(value=>muscleName.includes(value.toLocaleLowerCase("es"))||value.toLocaleLowerCase("es").includes(muscleName));
              const setTarget=(value:number)=>mutate(program=>{program.weekly_volume_targets??={};program.weekly_volume_targets[String(week)]??={};program.weekly_volume_targets[String(week)][item.muscle]=Math.min(100,Math.max(0,Number.isFinite(value)?value:0));});
              return <article className="series-row" key={item.muscle}>
                <div className="series-row-main"><strong>{item.muscle}{priority&&<small className="series-priority" title="Grupo prioritario"> · Prioridad</small>}</strong><div className="series-target"><span title="Series directas">{item.direct}</span><span aria-hidden="true">/</span><button type="button" aria-label={`Reducir meta de ${item.muscle}`} disabled={target<=0} onClick={()=>setTarget(target-1)}>−</button><input data-plain-number aria-label={`Meta de ${item.muscle} semana ${week}`} type="number" min="0" max="100" step="1" value={target} onChange={event=>setTarget(Number(event.target.value))}/><button type="button" aria-label={`Aumentar meta de ${item.muscle}`} disabled={target>=100} onClick={()=>setTarget(target+1)}>+</button><small>{target>0?`${progress}%`:"—"}</small></div></div>
                <progress className="series-progress" aria-label={`Progreso de ${item.muscle} semana ${week}`} max="100" value={progress}/>
                <details className="series-detail"><summary>Detalle <span>{target===0?"Sin meta activa":difference===0?"En meta":`${difference>0?"+":""}${difference} series`}</span></summary><dl><div><dt>Directas</dt><dd>{item.direct}</dd></div><div><dt>Indirectas</dt><dd>{item.indirect.toFixed(1)}</dd></div><div><dt>Efectivas</dt><dd>{item.total.toFixed(1)}</dd></div><div><dt>Frecuencia</dt><dd>{item.frequency} días</dd></div></dl></details>
              </article>;
            })}</section>;
          })}
        </div>
        <p>Las indirectas se consultan en Detalle; la barra compara series directas con la meta semanal.</p>
      </section>

      <div className="training-workspace">
        <main className="training-builder">
          <div className="training-switcher"><div className="training-week-tabs" aria-label="Semana">{Array.from({ length: draft.duration_weeks }, (_, index) => index + 1).map(value => <button key={value} className={week === value ? "active" : ""} onClick={() => {setWeek(value);setDayId(trainingDays(draft,value)[0]?.id??"");}}>Semana {value}<small>{trainingDays(draft,value).length} días</small></button>)}</div>{week > 1 && <button className="copy-week" onClick={() => { const next=copyTrainingWeek(draft, week - 1, week);setDraft(next);setDayId(trainingDays(next,week)[0]?.id??"");setDirty(true);toast(`Semana ${week - 1} copiada completa a semana ${week}.`); }}><Copy size={14}/>Copiar anterior</button>}</div>
          <div className="training-day-tabs" aria-label={`Días de entrenamiento de semana ${week}`}>{currentDays.map(day => <button key={day.id} className={selectedDay?.id === day.id ? "active" : ""} onClick={() => setDayId(day.id)}><span>{String(day.day_number).padStart(2, "0")}</span>{day.name}<small>{day.exercises.length} ejercicios</small></button>)}<button className="add-day" onClick={addDay} disabled={currentDays.length >= 7}><Plus size={16}/>Día</button></div>

          {selectedDay && <section className="training-day-editor">
            <div className="training-day-head"><div><label>Día dentro de la semana {week}<select value={selectedDay.weekday_offset??selectedDay.day_number-1} onChange={event=>mutate(program=>{const day=trainingDays(program,week).find(d=>d.id===selectedDay.id);if(day)day.weekday_offset=Number(event.target.value);})}>{Array.from({length:7},(_,i)=><option key={i} value={i}>Día {i+1}</option>)}</select></label><input aria-label="Nombre del día" value={selectedDay.name} onChange={event => mutate(program => { const day = trainingDays(program,week).find(item => item.id === selectedDay.id); if (day) day.name = event.target.value; })}/><input aria-label="Notas del día" value={selectedDay.notes ?? ""} placeholder="Enfoque, calentamiento o indicaciones del día" onChange={event => mutate(program => { const day = trainingDays(program,week).find(item => item.id === selectedDay.id); if (day) day.notes = event.target.value; })}/></div><div><button onClick={() => { setReplacing(null); setAddedExerciseCount(0); setLibraryOpen(true); }}><Plus size={15}/>Agregar ejercicio</button><button className="danger" onClick={removeDay} disabled={currentDays.length <= 1}><Trash2 size={15}/>Eliminar día</button></div></div>
            {selectedDay.exercises.length === 0 ? <div className="training-day-empty"><Dumbbell size={25}/><p>Agrega ejercicios desde tu biblioteca.</p><button onClick={() => { setReplacing(null); setAddedExerciseCount(0); setLibraryOpen(true); }}><Plus size={15}/>Elegir ejercicio</button></div> : <><div className="training-exercise-columns" aria-hidden="true"><span>#</span><span>Ejercicio</span><span>Series · repeticiones · RIR</span><span/></div><div className="training-exercises">{selectedDay.exercises.map((exercise, index) => {
              const prescription = exercise.prescriptions.find(item => item.week === week)!;
              return <article className="training-exercise" key={exercise.id}>
                <div className="training-order"><strong>{String(index + 1).padStart(2, "0")}</strong><button aria-label={`Subir ${exercise.name}`} disabled={index === 0} onClick={() => moveExercise(exercise.id, -1)}><ChevronUp size={14}/></button><button aria-label={`Bajar ${exercise.name}`} disabled={index === selectedDay.exercises.length - 1} onClick={() => moveExercise(exercise.id, 1)}><ChevronDown size={14}/></button></div>
                <div className="training-exercise-main"><button onClick={()=>{setAddedExerciseCount(0);setReplacing(exercise.id);setLibraryOpen(true);}}>Sustituir ejercicio</button><span>{exercise.muscle_group}</span><input aria-label="Nombre del ejercicio" value={exercise.name} onChange={event => updateExercise(exercise.id, item => { item.name = event.target.value; })}/><TrainingVideoEditor iconOnly key={`${draft.id}-${exercise.id}`} label={`Agregar mi video · ${exercise.name}`} value={exerciseVideo(exercise)} onChange={url=>updateExercise(exercise.id,item=>{item.video_url=url;item.video_custom=true;})}/></div>
                <div className="training-prescription training-prescription-compact"><label>Carga (kg)<input type="number" min="0" step="0.5" value={prescription.load_kg??""} onChange={event=>updateExercise(exercise.id,item=>{item.prescriptions[week-1].load_kg=event.target.value===""?undefined:Number(event.target.value);})}/></label><label>Series<input aria-label={`Series de ${exercise.name}`} type="number" min="0" max="20" value={prescription.sets} onChange={event => updateExercise(exercise.id, item => { item.prescriptions[week - 1].sets = Number(event.target.value) || 0; })}/></label><TrainingRepRange key={`${exercise.id}-${week}`} label={`Repeticiones de ${exercise.name}`} min={prescription.reps_min} max={prescription.reps_max} onCommit={(min,max)=>updateExercise(exercise.id,item=>{item.prescriptions[week-1].reps_min=min;item.prescriptions[week-1].reps_max=max;})}/><label>RIR<input aria-label={`RIR de ${exercise.name}`} title={prescription.rir_start!==prescription.rir_end?`Este ejercicio conservaba RIR inicial ${prescription.rir_start} y final ${prescription.rir_end}. Se muestra el final; al editar se aplicará el nuevo RIR a ambos.`:"Repeticiones en reserva"} type="number" min="0" max="10" value={prescription.rir_end} onChange={event=>updateExercise(exercise.id,item=>{const value=Math.min(10,Math.max(0,Number(event.target.value)||0));item.prescriptions[week-1].rir_start=value;item.prescriptions[week-1].rir_end=value;})}/></label><button title="Aplicar esta prescripción a las apariciones del ejercicio en todas las semanas" onClick={() => applyPrescriptionToAllWeeks(exercise.id, prescription)}><Copy size={14}/><span>Aplicar a todas</span></button></div>
                <button className="training-remove-exercise" aria-label={`Eliminar ${exercise.name}`} onClick={() => removeExercise(exercise.id)}><Trash2 size={15}/></button>
              </article>;
            })}</div></>}
          </section>}
        </main>

        <aside className="training-analysis"><TrainingLiveFeedback key={`${clientId}-${draft.id}`} clientId={clientId} programId={draft.id} week={week}/><div className="training-analysis-head"><span>SEMANA {week}</span><h2>Feedback y revisión</h2><p>Control del bloque junto a los ejercicios de la semana.</p></div><div className={`training-quality ${issues.length ? "warning" : "ok"}`}>{issues.length ? <AlertTriangle size={17}/> : <CheckCircle2 size={17}/>}<div><strong>{issues.length ? `${issues.length} puntos por revisar` : "Semana consistente"}</strong>{issues.map(issue => <p key={issue}>{issue}</p>)}{!issues.length && <p>Rangos y estructura listos para revisión del coach.</p>}</div></div><section className="training-review training-review-side"><div><span>CIERRE DEL BLOQUE</span><h2>Decisiones para la siguiente rotación</h2><p>Registra sensaciones y cambios mientras revisas la rutina.</p></div><div className="training-review-grid"><label>Fatiga general (1–10)<input type="number" min="1" max="10" value={draft.review?.general_fatigue || ""} onChange={event => mutate(program => { program.review ??= { session_fatigue: [] }; program.review.general_fatigue = Number(event.target.value) || undefined; })}/></label><label>Tolerancia al volumen (1–10)<input type="number" min="1" max="10" value={draft.review?.volume_tolerance || ""} onChange={event => mutate(program => { program.review ??= { session_fatigue: [] }; program.review.volume_tolerance = Number(event.target.value) || undefined; })}/></label><label>Dolor muscular o molestias<textarea rows={2} value={draft.review?.soreness ?? ""} onChange={event => mutate(program => { program.review ??= { session_fatigue: [] }; program.review.soreness = event.target.value; })}/></label><label>Sesión más demandante<textarea rows={2} value={draft.review?.hardest_session ?? ""} onChange={event => mutate(program => { program.review ??= { session_fatigue: [] }; program.review.hardest_session = event.target.value; })}/></label><label>Ejercicios incómodos o con mala técnica<textarea rows={2} value={draft.review?.uncomfortable_exercises ?? ""} onChange={event => mutate(program => { program.review ??= { session_fatigue: [] }; program.review.uncomfortable_exercises = event.target.value; })}/></label><label>Ejercicios que conviene mantener<textarea rows={2} value={draft.review?.keep_exercises ?? ""} onChange={event => mutate(program => { program.review ??= { session_fatigue: [] }; program.review.keep_exercises = event.target.value; })}/></label></div></section><div className="training-rir-note"><strong>CRITERIO RIR</strong><p>RIR indica cuántas repeticiones adicionales estimas poder realizar. El valor de RIR indica la reserva objetivo del ejercicio. Acercarse al fallo no obliga a llegar al fallo en todas las series.</p></div><p className="training-evidence">La evidencia favorece volumen suficiente y progresión gradual. DietForge ordena los datos; el coach toma la decisión final.</p></aside>
      </div>

      <div className="training-footer-actions"><button className="danger" onClick={() => setDeleteOpen(true)}><Trash2 size={15}/>Eliminar rutina</button><button className="primary" onClick={save}><Save size={16}/>Guardar rutina</button></div>
    </>}

    {libraryOpen && <div className="training-library-layer">
      <button className="training-library-backdrop" aria-label="Cerrar biblioteca" onClick={() => { setLibraryOpen(false); setReplacing(null); }}/>
      <aside className="training-library" role="dialog" aria-modal="true" aria-labelledby="training-library-title">
        <header><div><span>MI BIBLIOTECA DE EJERCICIOS</span><h2 id="training-library-title">{replacing ? "Sustituir ejercicio" : "Agregar ejercicios"}</h2><p>{db.getExercises().length + baseLibrary.length} ejercicios disponibles</p></div><button aria-label="Cerrar biblioteca" onClick={() => { setLibraryOpen(false); setReplacing(null); }}>×</button></header>
        <div className="training-library-search"><Search size={16}/><input autoFocus value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar ejercicio o músculo"/></div>
        <div className="training-library-filters">{muscleGroups.map(group => <button key={group} className={muscle === group ? "active" : ""} onClick={() => setMuscle(group)}>{group}</button>)}</div>
        {!replacing && <div className="training-library-manage"><div><strong>¿No aparece el ejercicio?</strong><span>Créalo una vez con músculo, indicaciones y video para reutilizarlo en todos tus clientes.</span></div><button type="button" onClick={openExerciseDatabase}><Plus size={14}/>Administrar base</button></div>}
        <div className="training-library-results">{filteredLibrary.map(item => <button key={item.id} onClick={() => addExercise(item)}><span><strong>{item.name}</strong><small>{item.muscle_group}</small></span><Plus size={16}/></button>)}</div>
        {!replacing && <footer><span>{addedExerciseCount ? `${addedExerciseCount} agregado${addedExerciseCount===1?"":"s"} al día` : "Puedes añadir varios sin cerrar la biblioteca"}</span><button type="button" onClick={() => setLibraryOpen(false)}>Listo</button></footer>}
      </aside>
    </div>}
    <ConfirmDialog open={deleteOpen} title="Eliminar rutina" message="Se eliminará este bloque de entrenamiento. Los datos nutricionales del cliente no cambian." onCancel={() => setDeleteOpen(false)} onConfirm={removeProgram}/>
  </div>;
}
