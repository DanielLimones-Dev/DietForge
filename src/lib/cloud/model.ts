import type { Client, ClientMeasurement, Competition, CheckIn, PhotoRef, WeekPlan, Food, MealPlan, MealPlanItem, DietTemplate, TrainingProgram, CustomExercise } from '@/types';
export interface Database {
  seed_version?: number;
  clients: Client[]; measurements: ClientMeasurement[]; competitions: Competition[];
  checkins: CheckIn[]; photos: PhotoRef[]; weekPlans: WeekPlan[]; foods: Food[];
  mealPlans: MealPlan[]; mealPlanItems: MealPlanItem[]; trainingPrograms: TrainingProgram[]; exercises: CustomExercise[]; nextId: Record<string, number>;
}
export interface Snapshot { database: Database; templates: DietTemplate[]; preferences: Record<string, string>; }
export const collections = ['clients','measurements','competitions','checkins','photos','weekPlans','foods','mealPlans','mealPlanItems','trainingPrograms','exercises'] as const;
export function emptySnapshot(): Snapshot {
  return { database: {clients:[],measurements:[],competitions:[],checkins:[],photos:[],weekPlans:[],foods:[],mealPlans:[],mealPlanItems:[],trainingPrograms:[],exercises:[],nextId:{}},templates:[],preferences:{} };
}
export function validateSnapshot(value: unknown): Snapshot {
  if (!value || typeof value !== 'object') throw new Error('Respaldo inválido.');
  const s = structuredClone(value) as Snapshot;
  if (!s.database || !Array.isArray(s.templates) || !s.preferences || typeof s.preferences !== 'object') throw new Error('Formato de datos incompleto.');
  for (const key of collections) {
    // Training was added after the first cloud snapshots; older accounts upgrade in place.
    if ((key === 'trainingPrograms' || key === 'exercises') && !Array.isArray(s.database[key])) s.database[key] = [];
    if (!Array.isArray(s.database[key])) throw new Error(`Falta la colección ${key}.`);
    const ids = new Set<number>();
    for (const row of s.database[key]) {
      if (!row || !Number.isSafeInteger(row.id) || row.id < 1 || ids.has(row.id)) throw new Error(`ID inválido o repetido en ${key}.`);
      ids.add(row.id);
    }
  }
  const templateIds = new Set<number>();
  for (const t of s.templates) { if (!Number.isSafeInteger(t.id) || templateIds.has(t.id)) throw new Error('Plantilla con ID inválido o repetido.'); templateIds.add(t.id); }
  s.database.nextId = Object.fromEntries(collections.map(key => [key, Math.max(0,...s.database[key].map(r => r.id)) + 1]));
  return s;
}
export function readLegacy(storage: Storage): Snapshot | null {
  const primary = storage.getItem('dietforge_db');
  const backup = storage.getItem('dietforge_db_backup');
  const raw = primary || backup;
  const templates = storage.getItem('dietforge_templates');
  if (!raw && !templates) return null;
  const base = emptySnapshot();
  if (raw) {
    try { base.database = {...base.database,...JSON.parse(raw)}; validateSnapshot(base); }
    catch (error) {
      if (!backup || backup === raw) throw error;
      base.database = {...emptySnapshot().database,...JSON.parse(backup)};
      validateSnapshot(base);
    }
  }
  if (templates) base.templates = JSON.parse(templates);
  for (let i=0;i<storage.length;i++) { const key=storage.key(i); if (key && (key.startsWith('rd_') || key==='dietforge_trial')) base.preferences[key]=storage.getItem(key)!; }
  return validateSnapshot(base);
}
export function hasData(s: Snapshot): boolean { return collections.some(k => s.database[k].length > 0) || s.templates.length > 0; }

export function sameSnapshot(a:Snapshot,b:Snapshot):boolean {
 const stable=(v:unknown):string=>{
  if(Array.isArray(v))return '['+v.map(stable).join(',')+']';
  if(v && typeof v==='object')return '{'+Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>JSON.stringify(k)+':'+stable(x)).join(',')+'}';
  return JSON.stringify(v);
 };return stable(a)===stable(b);
}
