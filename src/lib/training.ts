import type { ExerciseLibraryItem, TrainingDay, TrainingExercise, TrainingPrescription, TrainingProgram } from "@/types";

function key(prefix: string): string {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${id}`;
}

export function trainingDateValue(date = new Date(), timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function blankPrescription(week: number, source?: TrainingPrescription): TrainingPrescription {
  return source
    ? { ...source, week }
    : { week, sets: 3, reps_min: 8, reps_max: 12, rir_start: 2, rir_end: 1 };
}

export function createTrainingDraft(clientId: number, clientName: string, today = trainingDateValue()): Omit<TrainingProgram, "id" | "created_at" | "updated_at"> {
  const days = Array.from({ length: 5 }, (_, index): TrainingDay => ({
    id: key("day"), day_number: index + 1, name: `Día ${index + 1}`, notes: "", exercises: [],
  }));
  return {
    client_id: clientId,
    name: `Bloque de entrenamiento · ${clientName}`,
    objective: "hypertrophy",
    start_date: today,
    duration_weeks: 5,
    mesocycle_number: 1,
    rotation_number: 1,
    priorities: [],
    split: "",
    notes: "",
    status: "draft",
    days,
    review: { session_fatigue: [0, 0, 0, 0, 0] },
  };
}

export function trainingDays(program: Pick<TrainingProgram,"days"|"week_days">, week: number): TrainingDay[] {
  return program.week_days?.[String(week)] ?? program.days;
}

/** Materialize legacy schedules so later changes affect one week only. */
export function independentTrainingProgram(program: TrainingProgram): TrainingProgram {
  const next=structuredClone(program);
  next.week_days=Object.fromEntries(Array.from({length:next.duration_weeks},(_,index)=>{
    const week=String(index+1);
    return [week,structuredClone(next.week_days?.[week]??next.days)];
  }));
  next.days=structuredClone(next.week_days["1"]??next.days);
  return next;
}

export function replaceTrainingDays(program:TrainingProgram,week:number,days:TrainingDay[]):void {
  program.week_days??={};
  program.week_days[String(week)]=days;
  if(week===1)program.days=structuredClone(days);
}

export function exerciseFromLibrary(item: ExerciseLibraryItem, weeks: number): TrainingExercise {
  return {
    id: key("exercise"), library_id: item.id, name: item.name, muscle_group: item.muscle_group,
    video_url: undefined, video_custom: true, notes: "",
    prescriptions: Array.from({ length: weeks }, (_, index) => blankPrescription(index + 1)),
  };
}

export function normalizeTrainingWeeks(weeks: number): number {
  return Number.isFinite(weeks) ? Math.min(12, Math.max(1, Math.round(weeks))) : 1;
}

export function validTrainingDate(value: string): boolean {
  const date = new Date(value + 'T12:00:00Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function resizeProgramWeeks(program: TrainingProgram, weeks: number): TrainingProgram {
  const duration = normalizeTrainingWeeks(weeks);
  const next = {
    ...program,
    duration_weeks: duration,
    days: program.days.map(day => ({
      ...day,
      exercises: day.exercises.map(exercise => ({
        ...exercise,
        prescriptions: Array.from({ length: duration }, (_, index) =>
          blankPrescription(index + 1, exercise.prescriptions[index] ?? exercise.prescriptions[exercise.prescriptions.length - 1])),
      })),
    })),
  };
  const materialized=independentTrainingProgram(next);
  materialized.week_days=Object.fromEntries(Array.from({length:duration},(_,index)=>{
    const week=String(index+1);
    const source=program.week_days?.[week]??program.week_days?.[String(Math.min(index+1,program.duration_weeks))]??program.days;
    return [week,structuredClone(source).map(day=>({...day,exercises:day.exercises.map(exercise=>({...exercise,prescriptions:Array.from({length:duration},(_,i)=>blankPrescription(i+1,exercise.prescriptions[i]??exercise.prescriptions.at(-1)))}))}))];
  }));
  materialized.days=structuredClone(materialized.week_days["1"]);
  return materialized;
}

export function copyTrainingWeek(program: TrainingProgram, fromWeek: number, toWeek: number): TrainingProgram {
  if (fromWeek < 1 || toWeek < 1 || fromWeek > program.duration_weeks || toWeek > program.duration_weeks) return program;
  if(!program.week_days)return {...program,days:program.days.map(day=>({...day,exercises:day.exercises.map(exercise=>{const source=exercise.prescriptions.find(p=>p.week===fromWeek);return source?{...exercise,prescriptions:exercise.prescriptions.map(p=>p.week===toWeek?blankPrescription(toWeek,source):p)}:exercise;})}))};
  const next=independentTrainingProgram(program);
  const copied=trainingDays(next,fromWeek).map(day => ({
      ...structuredClone(day),
      exercises: day.exercises.map(exercise => {
        const source = exercise.prescriptions.find(p => p.week === fromWeek);
        if (!source) return structuredClone(exercise);
        return { ...exercise, prescriptions: exercise.prescriptions.map(p => p.week === toWeek ? blankPrescription(toWeek, source) : p) };
      }),
    }));
  replaceTrainingDays(next,toWeek,copied);
  return next;
}

export interface MuscleVolume {
  muscle_group: string;
  sets: number;
  frequency: number;
}

export function weeklyMuscleVolume(program: TrainingProgram, week: number): MuscleVolume[] {
  const groups = new Map<string, { sets: number; days: Set<string> }>();
  for (const day of trainingDays(program,week)) for (const exercise of day.exercises) {
    const sets = exercise.prescriptions.find(p => p.week === week)?.sets ?? 0;
    if (sets <= 0) continue;
    const current = groups.get(exercise.muscle_group) ?? { sets: 0, days: new Set<string>() };
    current.sets += sets;
    current.days.add(day.id);
    groups.set(exercise.muscle_group, current);
  }
  return [...groups].map(([muscle_group, value]) => ({ muscle_group, sets: value.sets, frequency: value.days.size }))
    .sort((a, b) => b.sets - a.sets || a.muscle_group.localeCompare(b.muscle_group));
}

export function trainingProgramIssues(program: TrainingProgram, week: number): string[] {
  const issues: string[] = [];
  if (!program.name.trim()) issues.push("La rutina necesita un nombre.");
  const days=trainingDays(program,week);
  if (days.every(day => day.exercises.length === 0)) issues.push(`Agrega al menos un ejercicio en la semana ${week}.`);
  for (const day of days) for (const exercise of day.exercises) {
    const p = exercise.prescriptions.find(value => value.week === week);
    if (!p) issues.push(`${exercise.name}: falta la semana ${week}.`);
    else if (p.reps_min > p.reps_max) issues.push(`${exercise.name}: el mínimo de repeticiones supera al máximo.`);
  }
  for (const [muscle,range] of Object.entries(program.volume_ranges??{})) {
    if(range.min>range.max)issues.push(`${muscle}: el mínimo de volumen supera al máximo.`);
  }
  for (const volume of weeklyMuscleVolume(program, week)) {
    if (volume.sets > 25) issues.push(`${volume.muscle_group}: ${volume.sets} series directas requieren revisión del coach.`);
  }
  return issues;
}

// Validate every week before persisting, not just the tab the coach has open.
export function trainingSaveErrors(program: TrainingProgram): string[] {
  const errors: string[] = [];
  if (!validTrainingDate(program.start_date)) errors.push('Selecciona una fecha de inicio válida.');
  if (!Number.isInteger(program.duration_weeks) || program.duration_weeks < 1 || program.duration_weeks > 12) errors.push('La duración debe ser de 1 a 12 semanas.');
  for (let week = 1; week <= program.duration_weeks; week++) for (const day of trainingDays(program,week)) for (const exercise of day.exercises) {
      const p = exercise.prescriptions.find(p => p.week === week);
      if (!p || !Number.isInteger(p.sets) || p.sets < 0 || p.sets > 30 || !Number.isInteger(p.reps_min) || !Number.isInteger(p.reps_max) || p.reps_min < 0 || p.reps_max > 200 || p.reps_min > p.reps_max || !Number.isFinite(p.rir_start) || !Number.isFinite(p.rir_end) || p.rir_start < 0 || p.rir_start > 10 || p.rir_end < 0 || p.rir_end > 10 || (p.load_kg != null && (!Number.isFinite(p.load_kg) || p.load_kg < 0 || p.load_kg > 1500))) errors.push(`${exercise.name}, semana ${week}: revisa series, repeticiones, RIR y carga.`);
  }
  for (const [muscle, range] of Object.entries(program.volume_ranges ?? {})) if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || range.min < 0 || range.max > 100 || range.min > range.max) errors.push(`${muscle}: revisa el rango de volumen.`);
  return errors;
}
