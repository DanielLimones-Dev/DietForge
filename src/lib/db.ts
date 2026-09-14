import type { Client, ClientMeasurement, Food, MealPlan, MealPlanItem, DietTemplate, Competition, CheckIn, PhotoRef, WeekPlan, TrainingProgram, CustomExercise } from '@/types';
import { classifyCarbs } from '@/lib/nutrition';
import { readRemote, writeRemote } from './cloud/repository';
import { emptySnapshot, validateSnapshot, type Snapshot, type Database, sameSnapshot } from './cloud/model';
import { SaveQueue, type SaveState } from './cloud/engine';
const SEED_VERSION=2;
export const QUOTA_WARNING_KEY='dietforge_quota_warned';
export function checkStorageQuota(){return {used:0,limit:0,percent:0,ok:true};}
let cache:Database=emptySnapshot().database;
let templatesCache:DietTemplate[]=[];
let preferences:Record<string,string>={};
let owner='';
let accountEpoch=0;
let queue:SaveQueue|null=null;
let state:SaveState={phase:'ready',message:'Conectando con Supabase…'};
const listeners=new Set<()=>void>();
export function subscribeStorage(fn:()=>void){listeners.add(fn);return ()=>{listeners.delete(fn);};}
export function getStorageState(){return state;}
function setState(s:SaveState){state=s;listeners.forEach(fn=>fn());}
function snapshot():Snapshot{return structuredClone({database:cache,templates:templatesCache,preferences});}
function adopt(s:Snapshot){cache=s.database;templatesCache=s.templates;preferences=s.preferences;}
function localKey(kind:string){return `dietforge_cloud_${owner}_${kind}`;}
export function exportCloudBackup(){
 const blob=new Blob([JSON.stringify({format:'dietforge-v1',owner,snapshot:snapshot()},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='dietforge-respaldo.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function retryCloudSave(){await queue?.flush();}
export function hasPendingCloudWrites(){return !!queue?.pending;}
export function getPreference(key:string){return preferences[key]??null;}
export function setPreference(key:string,value:string){assertWritable();preferences[key]=value;persist();}
export async function saveTrialStart(date:string){setPreference('dietforge_trial',date);}
function assertWritable(){if(!queue || state.phase==='error')throw new Error('El guardado está detenido. Resuelve el aviso de sincronización antes de editar.');}
function persist(){
 if(!queue)return;
 try{queue.enqueue(snapshot());}catch{setState({phase:'error',message:'No hay espacio para el respaldo de recuperación. Descárgalo antes de continuar.'});}
}
function genId(table:string){const id=cache.nextId[table]||1;cache.nextId[table]=id+1;return id;}
export async function initializeCloud(userId:string):Promise<void>{
 const epoch=++accountEpoch;
 const assertCurrent=()=>{if(epoch!==accountEpoch)throw new Error('La cuenta cambió durante la carga.');};
 owner=userId;queue=null;setState({phase:'ready',message:'Cargando tus datos…'});
 const remote=await readRemote(userId);
 assertCurrent();
 const pending=localStorage.getItem(localKey('pending'));
 const operation=localStorage.getItem(localKey('operation'));
 if(operation){
  const op=JSON.parse(operation);const committed=await writeRemote(validateSnapshot(op.snapshot),op.revision,op.id,userId);
  assertCurrent();
  if(pending){const saved=JSON.parse(pending);localStorage.setItem(localKey('pending'),JSON.stringify({...saved,revision:committed}));}
  localStorage.removeItem(localKey('operation'));
  // If that request committed, reload its new revision before offering any unsent changes.
  return initializeCloud(userId);
 }
 if(pending){
  const saved=JSON.parse(pending);const s=validateSnapshot(saved.snapshot);
  if(remote && sameSnapshot(s,remote.snapshot)){localStorage.removeItem(localKey('pending'));}
  else if((remote?.revision??0)===saved.revision){
   const rev=await writeRemote(s,saved.revision,crypto.randomUUID(),userId);
   assertCurrent();
   localStorage.removeItem(localKey('pending'));adopt(s);startQueue(rev);return;
  }else{
   adopt(s);throw new Error('Hay cambios locales pendientes y una versión distinta en Supabase. Descarga el respaldo antes de recargar; no se sobrescribirá ninguna versión.');
  }
 }
 if(remote){adopt(remote.snapshot);startQueue(remote.revision);return;}
 // Unowned legacy browser data must never be adopted by an authenticated account.
 adopt(emptySnapshot());const rev=await writeRemote(snapshot(),0,crypto.randomUUID(),userId);assertCurrent();startQueue(rev);return;
}
function startQueue(revision:number){
 const queueOwner=owner;const epoch=accountEpoch;
 const key=(kind:string)=>`dietforge_cloud_${queueOwner}_${kind}`;
 queue=new SaveQueue(revision,(s,r,id)=>{
  if(epoch!==accountEpoch)return Promise.reject(new Error('La cuenta cambió. Los cambios pendientes se conservaron en su cuenta original.'));
  return writeRemote(s,r,id,queueOwner);
 },s=>{
  if(s.phase==='ready')localStorage.removeItem(key('pending'));
  if(epoch!==accountEpoch)return;
  setState(s);
 },(s,r)=>{localStorage.setItem(key('pending'),JSON.stringify({revision:r,snapshot:s}));},op=>{
  if(op)localStorage.setItem(key('operation'),JSON.stringify(op));else localStorage.removeItem(key('operation'));
 });setState({phase:'ready',message:'Guardado en Supabase'});
}
export function disconnectCloud(){accountEpoch++;queue=null;owner='';adopt(emptySnapshot());}
export async function init(){/* The authenticated CloudGate initializes the data before mounting the app. */}
const localDb = {
  init,

  getClients: (): Client[] => cache.clients,

  getClient: (id: number): Client | undefined =>
    cache.clients.find((c) => c.id === id),

  saveClient: (data: Omit<Client, "id" | "created_at" | "updated_at">): Client => {
    const now = new Date().toISOString();
    const c: Client = { ...data, check_in_interval_days: data.check_in_interval_days || 7, id: genId("clients"), created_at: now, updated_at: now };
    cache.clients.push(c);
    persist();
    return c;
  },

  updateClient: (id: number, data: Partial<Client>): Client | undefined => {
    const idx = cache.clients.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    if ("check_in_interval_days" in data) {
      const days = data.check_in_interval_days || 7;
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + days);
      data.next_check_in_date = nextDate.toISOString();
    }
    cache.clients[idx] = { ...cache.clients[idx], ...data, updated_at: new Date().toISOString() };
    persist();
    return cache.clients[idx];
  },

  deleteClient: (id: number): void => {
    const checkIds=new Set(cache.checkins.filter(c=>c.client_id===id).map(c=>c.id));
    const planIds=new Set(cache.mealPlans.filter(p=>p.client_id===id).map(p=>p.id));
    cache.clients=cache.clients.filter(c=>c.id!==id);
    cache.measurements=cache.measurements.filter(c=>c.client_id!==id);
    cache.competitions=cache.competitions.filter(c=>c.client_id!==id);
    cache.checkins=cache.checkins.filter(c=>c.client_id!==id);
    cache.photos=cache.photos.filter(p=>!checkIds.has(p.checkin_id));
    cache.weekPlans=cache.weekPlans.filter(p=>p.client_id!==id);
    cache.mealPlans=cache.mealPlans.filter(p=>p.client_id!==id);
    cache.mealPlanItems=cache.mealPlanItems.filter(p=>!planIds.has(p.meal_plan_id));
    cache.trainingPrograms=cache.trainingPrograms.filter(p=>p.client_id!==id);
    persist();
  },

  getMeasurements: (clientId: number): ClientMeasurement[] =>
    cache.measurements
      .filter((m) => m.client_id === clientId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),

  getLatestMeasurement: (clientId: number): ClientMeasurement | undefined =>
    cache.measurements
      .filter((m) => m.client_id === clientId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0],

  saveMeasurement: (data: Omit<ClientMeasurement, "id">): ClientMeasurement => {
    const m: ClientMeasurement = { ...data, id: genId("measurements") };
    cache.measurements.push(m);
    persist();
    return m;
  },

  updateMeasurement: (id: number, data: Partial<ClientMeasurement>): void => {
    const idx = cache.measurements.findIndex((m) => m.id === id);
    if (idx !== -1) {
      cache.measurements[idx] = { ...cache.measurements[idx], ...data };
      persist();
    }
  },

  getFoods: (search?: string): Food[] => {
    if (!search) return cache.foods;
    const q = search.toLowerCase();
    return cache.foods.filter(
      (f) => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q) || f.barcode?.includes(q),
    );
  },

  getFood: (id: number): Food | undefined => cache.foods.find((f) => f.id === id),

  saveFood: (data: Omit<Food, "id">): Food => {
    const f: Food = { ...data, id: genId("foods") };
    cache.foods.push(f);
    persist();
    return f;
  },

  deleteFood: (id: number): void => {
    if (cache.mealPlanItems.some(item => item.food_id === id)) throw new Error('Este alimento se utiliza en un plan. Retíralo del plan antes de eliminarlo.');
    cache.foods = cache.foods.filter((f) => f.id !== id);
    persist();
  },

  getExercises: (search?: string): CustomExercise[] => {
    const exercises = [...cache.exercises].sort((a, b) => a.name.localeCompare(b.name, "es"));
    if (!search) return exercises;
    const q = search.toLocaleLowerCase("es");
    return exercises.filter(item => `${item.name} ${item.muscle_group}`.toLocaleLowerCase("es").includes(q));
  },

  saveExercise: (data: Omit<CustomExercise, "id" | "created_at" | "updated_at">): CustomExercise => {
    const now = new Date().toISOString();
    const exercise: CustomExercise = { ...data, id: genId("exercises"), created_at: now, updated_at: now };
    cache.exercises.push(exercise);
    persist();
    return exercise;
  },

  updateExercise: (id: number, data: Partial<Omit<CustomExercise, "id" | "created_at">>): CustomExercise | undefined => {
    const index = cache.exercises.findIndex(item => item.id === id);
    if (index === -1) return undefined;
    cache.exercises[index] = { ...cache.exercises[index], ...data, updated_at: new Date().toISOString() };
    persist();
    return cache.exercises[index];
  },

  deleteExercise: (id: number): void => {
    cache.exercises = cache.exercises.filter(item => item.id !== id);
    persist();
  },

  getMealPlans: (clientId: number): MealPlan[] =>
    cache.mealPlans
      .filter((p) => p.client_id === clientId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),

  getMealPlan: (id: number): { plan: MealPlan; items: MealPlanItem[] } | undefined => {
    const plan = cache.mealPlans.find((p) => p.id === id);
    if (!plan) return undefined;
    return { plan, items: cache.mealPlanItems.filter((i) => i.meal_plan_id === id) };
  },

  saveMealPlan: (data: Omit<MealPlan, "id">, items: Omit<MealPlanItem, "id" | "meal_plan_id">[]): MealPlan => {
    const plan: MealPlan = { ...data, id: genId("mealPlans") };
    cache.mealPlans.push(plan);
    for (const item of items) {
      cache.mealPlanItems.push({
        ...item,
        id: genId("mealPlanItems"),
        meal_plan_id: plan.id,
      });
    }
    persist();
    return plan;
  },

  updateMealPlan: (id: number, data: Partial<MealPlan>): MealPlan | undefined => {
    const idx = cache.mealPlans.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    cache.mealPlans[idx] = { ...cache.mealPlans[idx], ...data };
    persist();
    return cache.mealPlans[idx];
  },

  deleteMealPlan: (id: number): void => {
    cache.weekPlans = cache.weekPlans.map(week => ({...week, day_plans: week.day_plans.filter(day => day.meal_plan_id !== id)}));
    cache.mealPlans = cache.mealPlans.filter((p) => p.id !== id);
    cache.mealPlanItems = cache.mealPlanItems.filter((i) => i.meal_plan_id !== id);
    persist();
  },

  addMealPlanItem: (item: Omit<MealPlanItem, "id">): MealPlanItem => {
    const newItem: MealPlanItem = { ...item, id: genId("mealPlanItems") };
    cache.mealPlanItems.push(newItem);
    persist();
    return newItem;
  },

  deleteMealPlanItem: (id: number): void => {
    cache.mealPlanItems = cache.mealPlanItems.filter((i) => i.id !== id);
    persist();
  },

  updateMealPlanItem: (id: number, data: Partial<Omit<MealPlanItem, "id">>): void => {
    const idx = cache.mealPlanItems.findIndex((i) => i.id === id);
    if (idx !== -1) {
      cache.mealPlanItems[idx] = { ...cache.mealPlanItems[idx], ...data };
      persist();
    }
  },

  getCompetitions: (clientId: number): Competition[] =>
    cache.competitions.filter((c) => c.client_id === clientId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),

  saveCompetition: (data: Omit<Competition, "id">): Competition => {
    const c: Competition = { ...data, id: genId("competitions") };
    cache.competitions.push(c);
    persist();
    return c;
  },

  updateCompetition: (id: number, data: Partial<Competition>): Competition | undefined => {
    const idx = cache.competitions.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    cache.competitions[idx] = { ...cache.competitions[idx], ...data };
    persist();
    return cache.competitions[idx];
  },

  deleteCompetition: (id: number): void => {
    cache.competitions = cache.competitions.filter((c) => c.id !== id);
    persist();
  },

  getCheckIns: (clientId: number): CheckIn[] =>
    cache.checkins
      .filter((c) => c.client_id === clientId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),

  getLatestCheckIn: (clientId: number): CheckIn | undefined =>
    cache.checkins
      .filter((c) => c.client_id === clientId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0],

  updateNextCheckIn: (clientId: number): void => {
    const client = cache.clients.find((c) => c.id === clientId);
    if (!client) return;
    const days = client.check_in_interval_days || 7;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + days);
    client.next_check_in_date = nextDate.toISOString();
    client.updated_at = new Date().toISOString();
    persist();
  },

  saveCheckIn: (data: Omit<CheckIn, "id">): CheckIn => {
    const c: CheckIn = { ...data, id: genId("checkins") };
    cache.checkins.push(c);
    persist();
    return c;
  },

  updateCheckIn: (id: number, data: Partial<CheckIn>): CheckIn | undefined => {
    const idx = cache.checkins.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    cache.checkins[idx] = { ...cache.checkins[idx], ...data };
    persist();
    return cache.checkins[idx];
  },

  getPhotosForCheckIn: (checkinId: number): PhotoRef[] =>
    cache.photos.filter((p) => p.checkin_id === checkinId),

  savePhoto: (data: Omit<PhotoRef, "id">): PhotoRef => {
    const p: PhotoRef = { ...data, id: genId("photos") };
    cache.photos.push(p);
    persist();
    return p;
  },

  deletePhoto: (id: number): void => {
    cache.photos = cache.photos.filter((p) => p.id !== id);
    persist();
  },

  deletePhotosForCheckIn: (checkinId: number): void => {
    cache.photos = cache.photos.filter((p) => p.checkin_id !== checkinId);
    persist();
  },

  deleteCheckIn: (id: number): void => {
    cache.photos = cache.photos.filter((p) => p.checkin_id !== id);
    cache.checkins = cache.checkins.filter((c) => c.id !== id);
    persist();
  },

  getWeekPlans: (clientId: number): WeekPlan[] =>
    cache.weekPlans.filter((w) => w.client_id === clientId).sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()),

  getWeekPlan: (id: number): WeekPlan | undefined =>
    cache.weekPlans.find((w) => w.id === id),

  saveWeekPlan: (data: Omit<WeekPlan, "id">): WeekPlan => {
    const w: WeekPlan = { ...data, id: genId("weekPlans") };
    cache.weekPlans.push(w);
    persist();
    return w;
  },

  updateWeekPlan: (id: number, data: Partial<WeekPlan>): WeekPlan | undefined => {
    const idx = cache.weekPlans.findIndex((w) => w.id === id);
    if (idx === -1) return undefined;
    cache.weekPlans[idx] = { ...cache.weekPlans[idx], ...data };
    persist();
    return cache.weekPlans[idx];
  },

  deleteWeekPlan: (id: number): void => {
    const plan = cache.weekPlans.find((w) => w.id === id);
    if (plan) {
      const shared = new Set(cache.weekPlans.filter(w => w.id !== id).flatMap(w => w.day_plans.map(d => d.meal_plan_id)));
      const removed = new Set(plan.day_plans.map(d => d.meal_plan_id).filter(planId => !shared.has(planId)));
      cache.mealPlans = cache.mealPlans.filter(mp => !removed.has(mp.id));
      cache.mealPlanItems = cache.mealPlanItems.filter(item => !removed.has(item.meal_plan_id));
    }
    cache.weekPlans = cache.weekPlans.filter((w) => w.id !== id);
    persist();
  },

  getTrainingPrograms: (clientId?: number): TrainingProgram[] =>
    cache.trainingPrograms
      .filter((program) => clientId === undefined || program.client_id === clientId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),

  getTrainingProgram: (id: number): TrainingProgram | undefined =>
    cache.trainingPrograms.find((program) => program.id === id),

  saveTrainingProgram: (data: Omit<TrainingProgram, "id" | "created_at" | "updated_at">): TrainingProgram => {
    const now = new Date().toISOString();
    const program: TrainingProgram = { ...data, id: genId("trainingPrograms"), created_at: now, updated_at: now };
    cache.trainingPrograms.push(program);
    persist();
    return program;
  },

  updateTrainingProgram: (id: number, data: Partial<Omit<TrainingProgram, "id" | "client_id" | "created_at">>): TrainingProgram | undefined => {
    const idx = cache.trainingPrograms.findIndex((program) => program.id === id);
    if (idx === -1) return undefined;
    cache.trainingPrograms[idx] = { ...cache.trainingPrograms[idx], ...data, updated_at: new Date().toISOString() };
    persist();
    return cache.trainingPrograms[idx];
  },

  deleteTrainingProgram: (id: number): void => {
    cache.trainingPrograms = cache.trainingPrograms.filter((program) => program.id !== id);
    persist();
  },

  getStats: () => ({
    clients: cache.clients.length,
    mealPlans: cache.mealPlans.length,
    foods: cache.foods.length,
    competitions: cache.competitions.length,
    checkins: cache.checkins.length,
    trainingPrograms: cache.trainingPrograms.length,
    activeClients: new Set(cache.checkins.filter((c) => {
      const daysSince = (Date.now() - new Date(c.date).getTime()) / 86400000;
      return daysSince <= 14;
    }).map((c) => c.client_id)).size,
  }),

  seedFoods: () => {
    if (cache.seed_version === SEED_VERSION) return;
    cache.seed_version = SEED_VERSION;
    // Imported/custom catalogs and their IDs must survive a seed-version upgrade.
    if (cache.foods.length > 0) { persist(); return; }
    const defaultFoods: Omit<Food, "id">[] = [
      { name: "Pechuga de pollo", category: "protein", protein: 31, carbs: 0, fat: 3.6, fiber: 0, antioxidants: 0, kcal: 165, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Muslo de pollo sin piel", category: "protein", protein: 26, carbs: 0, fat: 8, fiber: 0, antioxidants: 0, kcal: 175, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Pierna de pollo", category: "protein", protein: 28, carbs: 0, fat: 5, fiber: 0, antioxidants: 0, kcal: 158, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Pechuga de pavo", category: "protein", protein: 29, carbs: 0, fat: 1, fiber: 0, antioxidants: 0, kcal: 135, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Huevo entero", category: "protein", protein: 12.6, carbs: 1.1, fat: 8.9, fiber: 0, antioxidants: 0, kcal: 143, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Clara de huevo", category: "protein", protein: 10.9, carbs: 0.7, fat: 0.2, fiber: 0, antioxidants: 0, kcal: 52, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Atún en agua", category: "protein", protein: 23, carbs: 0, fat: 0.7, fiber: 0, antioxidants: 0, kcal: 99, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Salmón", category: "protein", protein: 20, carbs: 0, fat: 13, fiber: 0, antioxidants: 0, kcal: 208, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Res magra (sirloin)", category: "protein", protein: 26, carbs: 0, fat: 5, fiber: 0, antioxidants: 0, kcal: 158, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Res molida 93/7", category: "protein", protein: 21, carbs: 0, fat: 7, fiber: 0, antioxidants: 0, kcal: 152, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Filete de cerdo", category: "protein", protein: 25, carbs: 0, fat: 3.5, fiber: 0, antioxidants: 0, kcal: 136, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Pescado blanco (tilapia)", category: "protein", protein: 20, carbs: 0, fat: 1.5, fiber: 0, antioxidants: 0, kcal: 96, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Camarón", category: "protein", protein: 20, carbs: 0, fat: 0.5, fiber: 0, antioxidants: 0, kcal: 85, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Brócoli", category: "vegetables", protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6, antioxidants: 0, kcal: 34, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Espinaca", category: "vegetables", protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, antioxidants: 0, kcal: 23, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Zanahoria", category: "vegetables", protein: 0.9, carbs: 9.6, fat: 0.2, fiber: 2.8, antioxidants: 0, kcal: 41, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Cebolla", category: "vegetables", protein: 0.9, carbs: 7.7, fat: 0.1, fiber: 1.2, antioxidants: 0, kcal: 35, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Jitomate", category: "vegetables", protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, antioxidants: 0, kcal: 18, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Pimiento morrón", category: "vegetables", protein: 1, carbs: 6, fat: 0.3, fiber: 2.1, antioxidants: 0, kcal: 26, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Calabacita", category: "vegetables", protein: 1.2, carbs: 3.1, fat: 0.3, fiber: 1, antioxidants: 0, kcal: 17, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Nopal", category: "vegetables", protein: 1.4, carbs: 3.3, fat: 0.1, fiber: 2, antioxidants: 0, kcal: 15, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Lechuga", category: "vegetables", protein: 1.2, carbs: 3.3, fat: 0.3, fiber: 2.1, antioxidants: 0, kcal: 17, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Coliflor", category: "vegetables", protein: 2, carbs: 5, fat: 0.3, fiber: 2.5, antioxidants: 0, kcal: 25, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Elote", category: "vegetables", protein: 3.3, carbs: 21, fat: 1.2, fiber: 2.4, antioxidants: 0, kcal: 96, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Champiñón", category: "vegetables", protein: 3.1, carbs: 3.3, fat: 0.3, fiber: 1, antioxidants: 0, kcal: 22, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Aguacate", category: "vegetables", protein: 2, carbs: 8.6, fat: 15.4, fiber: 6.8, antioxidants: 0, kcal: 167, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Pepino", category: "vegetables", protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5, antioxidants: 0, kcal: 16, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Plátano", category: "fruits", protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, antioxidants: 0, kcal: 89, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Manzana", category: "fruits", protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4, antioxidants: 0, kcal: 52, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Naranja", category: "fruits", protein: 0.9, carbs: 11.8, fat: 0.1, fiber: 2.4, antioxidants: 0, kcal: 47, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Fresa", category: "fruits", protein: 0.7, carbs: 7.7, fat: 0.3, fiber: 2, antioxidants: 0, kcal: 32, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Mango", category: "fruits", protein: 0.8, carbs: 15, fat: 0.4, fiber: 1.6, antioxidants: 0, kcal: 60, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Papaya", category: "fruits", protein: 0.5, carbs: 10.8, fat: 0.3, fiber: 1.7, antioxidants: 0, kcal: 43, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Sandía", category: "fruits", protein: 0.6, carbs: 7.6, fat: 0.2, fiber: 0.4, antioxidants: 0, kcal: 30, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Piña", category: "fruits", protein: 0.5, carbs: 13.1, fat: 0.1, fiber: 1.4, antioxidants: 0, kcal: 50, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Uva", category: "fruits", protein: 0.7, carbs: 18.1, fat: 0.2, fiber: 0.9, antioxidants: 0, kcal: 69, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Arándano", category: "fruits", protein: 0.7, carbs: 14.5, fat: 0.3, fiber: 2.4, antioxidants: 0, kcal: 57, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Frambuesa", category: "fruits", protein: 1.2, carbs: 11.9, fat: 0.7, fiber: 6.5, antioxidants: 0, kcal: 52, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Leche entera", category: "dairy", protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0, antioxidants: 0, kcal: 61, serving_size: 100, serving_unit: "ml", source: "manual" },
      { name: "Leche descremada", category: "dairy", protein: 3.4, carbs: 5, fat: 0.2, fiber: 0, antioxidants: 0, kcal: 35, serving_size: 100, serving_unit: "ml", source: "manual" },
      { name: "Yogurt natural", category: "dairy", protein: 3.5, carbs: 4.7, fat: 3.3, fiber: 0, antioxidants: 0, kcal: 61, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Yogurt griego natural", category: "dairy", protein: 9, carbs: 4, fat: 5, fiber: 0, antioxidants: 0, kcal: 97, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Yogurt de fresa", category: "dairy", protein: 5.4, carbs: 15.6, fat: 3.4, fiber: 0, antioxidants: 0, kcal: 115, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Yogurt light natural", category: "dairy", protein: 5, carbs: 6, fat: 0.5, fiber: 0, antioxidants: 0, kcal: 48, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Queso panela", category: "dairy", protein: 20, carbs: 3.5, fat: 22, fiber: 0, antioxidants: 0, kcal: 290, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Queso fresco", category: "dairy", protein: 18.1, carbs: 3, fat: 23.8, fiber: 0, antioxidants: 0, kcal: 299, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Queso cottage", category: "dairy", protein: 12.5, carbs: 2.7, fat: 4.5, fiber: 0, antioxidants: 0, kcal: 103, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Queso Oaxaca", category: "dairy", protein: 22, carbs: 2, fat: 28, fiber: 0, antioxidants: 0, kcal: 350, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Crema ácida", category: "dairy", protein: 2.5, carbs: 3.5, fat: 19, fiber: 0, antioxidants: 0, kcal: 190, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Arroz blanco", category: "grains", protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4, antioxidants: 0, kcal: 130, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Arroz integral", category: "grains", protein: 2.7, carbs: 23, fat: 0.8, fiber: 1.8, antioxidants: 0, kcal: 111, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Avena", category: "grains", protein: 13.5, carbs: 58.5, fat: 6.5, fiber: 10.1, antioxidants: 0, kcal: 379, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Tortilla de maíz", category: "grains", protein: 5.7, carbs: 46, fat: 2.5, fiber: 4.5, antioxidants: 0, kcal: 218, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Pan blanco", category: "grains", protein: 8.3, carbs: 45.2, fat: 2.2, fiber: 2.4, antioxidants: 0, kcal: 242, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Pan integral", category: "grains", protein: 12.8, carbs: 43.6, fat: 5.2, fiber: 6.8, antioxidants: 0, kcal: 272, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Pasta seca", category: "grains", protein: 13, carbs: 75, fat: 1.5, fiber: 3.2, antioxidants: 0, kcal: 371, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Galletas Marías", category: "grains", protein: 7, carbs: 78, fat: 9, fiber: 2.5, antioxidants: 0, kcal: 426, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Galletas de avena", category: "grains", protein: 8, carbs: 69, fat: 12, fiber: 4, antioxidants: 0, kcal: 420, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Cereal de caja (Corn Flakes)", category: "grains", protein: 7, carbs: 84, fat: 0.9, fiber: 3, antioxidants: 0, kcal: 378, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Granola", category: "grains", protein: 11, carbs: 65, fat: 12, fiber: 8, antioxidants: 0, kcal: 400, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Hot cakes", category: "grains", protein: 6, carbs: 30, fat: 5, fiber: 1, antioxidants: 0, kcal: 195, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Frijoles refritos", category: "legumes", protein: 5, carbs: 14, fat: 2, fiber: 3.7, antioxidants: 0, kcal: 90, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Frijoles negros cocidos", category: "legumes", protein: 8.9, carbs: 23.7, fat: 0.5, fiber: 8.7, antioxidants: 0, kcal: 132, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Lentejas cocidas", category: "legumes", protein: 9, carbs: 20, fat: 0.4, fiber: 7.9, antioxidants: 0, kcal: 116, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Garbanzo cocido", category: "legumes", protein: 8.9, carbs: 27.4, fat: 2.6, fiber: 7.6, antioxidants: 0, kcal: 164, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Soya texturizada seca", category: "legumes", protein: 51, carbs: 33, fat: 1, fiber: 18, antioxidants: 0, kcal: 335, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Edamame", category: "legumes", protein: 11, carbs: 8.9, fat: 5.2, fiber: 5.2, antioxidants: 0, kcal: 121, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Papa cocida", category: "carbs", protein: 2, carbs: 17.5, fat: 0.1, fiber: 2.2, antioxidants: 0, kcal: 77, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Batata cocida", category: "carbs", protein: 1.6, carbs: 20.1, fat: 0.1, fiber: 3, antioxidants: 0, kcal: 86, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Almendra", category: "nuts", protein: 21.2, carbs: 21.6, fat: 49.9, fiber: 12.5, antioxidants: 0, kcal: 579, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Nuez", category: "nuts", protein: 15.2, carbs: 13.7, fat: 65.2, fiber: 6.7, antioxidants: 0, kcal: 654, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Cacahuate", category: "nuts", protein: 25.8, carbs: 16.1, fat: 49.2, fiber: 8.5, antioxidants: 0, kcal: 567, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Chía", category: "seeds", protein: 16.5, carbs: 42.1, fat: 30.7, fiber: 34.4, antioxidants: 0, kcal: 486, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Semillas de calabaza", category: "seeds", protein: 30, carbs: 10.7, fat: 49, fiber: 6, antioxidants: 0, kcal: 559, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Ajonjolí", category: "seeds", protein: 17.7, carbs: 23.5, fat: 49.7, fiber: 11.8, antioxidants: 0, kcal: 573, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Aceite de oliva", category: "fats", protein: 0, carbs: 0, fat: 100, fiber: 0, antioxidants: 0, kcal: 884, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Aceite de coco", category: "fats", protein: 0, carbs: 0, fat: 100, fiber: 0, antioxidants: 0, kcal: 884, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Mantequilla", category: "fats", protein: 0.9, carbs: 0.1, fat: 81, fiber: 0, antioxidants: 0, kcal: 717, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Mayonesa", category: "fats", protein: 1, carbs: 0.6, fat: 75, fiber: 0, antioxidants: 0, kcal: 680, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Crema de cacahuate", category: "fats", protein: 25, carbs: 20, fat: 50, fiber: 6, antioxidants: 0, kcal: 588, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Whey protein", category: "supplements", protein: 82, carbs: 5, fat: 3, fiber: 0, antioxidants: 0, kcal: 375, serving_size: 30, serving_unit: "g", source: "manual" },
      { name: "Creatina monohidratada", category: "supplements", protein: 0, carbs: 0, fat: 0, fiber: 0, antioxidants: 0, kcal: 0, serving_size: 5, serving_unit: "g", source: "manual" },
      { name: "Caseína", category: "supplements", protein: 80, carbs: 4, fat: 2, fiber: 0, antioxidants: 0, kcal: 354, serving_size: 30, serving_unit: "g", source: "manual" },
      { name: "Barra de proteína", category: "supplements", protein: 20, carbs: 30, fat: 8, fiber: 5, antioxidants: 0, kcal: 270, serving_size: 60, serving_unit: "g", source: "manual" },
      { name: "Arroz con leche", category: "other", protein: 2.7, carbs: 20.8, fat: 3.3, fiber: 0.5, antioxidants: 0, kcal: 124, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Flan", category: "other", protein: 4.5, carbs: 23, fat: 4, fiber: 0, antioxidants: 0, kcal: 145, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Chocolate amargo 70%", category: "other", protein: 7.8, carbs: 46, fat: 43, fiber: 11, antioxidants: 0, kcal: 598, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Chocolate con leche", category: "other", protein: 7, carbs: 57, fat: 30, fiber: 2, antioxidants: 0, kcal: 535, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Miel de abeja", category: "other", protein: 0.3, carbs: 82, fat: 0, fiber: 0, antioxidants: 0, kcal: 304, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Cajeta", category: "other", protein: 6, carbs: 68, fat: 9, fiber: 0, antioxidants: 0, kcal: 380, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Mermelada de fresa", category: "other", protein: 0.4, carbs: 49, fat: 0, fiber: 0.4, antioxidants: 0, kcal: 196, serving_size: 100, serving_unit: "g", source: "manual" },
      { name: "Agua natural", category: "beverages", protein: 0, carbs: 0, fat: 0, fiber: 0, antioxidants: 0, kcal: 0, serving_size: 250, serving_unit: "ml", source: "manual" },
      { name: "Café negro", category: "beverages", protein: 0.1, carbs: 0, fat: 0, fiber: 0, antioxidants: 0, kcal: 2, serving_size: 250, serving_unit: "ml", source: "manual" },
      { name: "Jugo de naranja natural", category: "beverages", protein: 0.7, carbs: 10.4, fat: 0.1, fiber: 0.2, antioxidants: 0, kcal: 45, serving_size: 100, serving_unit: "ml", source: "manual" },
      { name: "Horchata", category: "beverages", protein: 0.8, carbs: 12, fat: 1, fiber: 0.1, antioxidants: 0, kcal: 60, serving_size: 100, serving_unit: "ml", source: "manual" },
      { name: "Agua de jamaica (endulzada)", category: "beverages", protein: 0.1, carbs: 8, fat: 0, fiber: 0.1, antioxidants: 0, kcal: 32, serving_size: 100, serving_unit: "ml", source: "manual" },
    ];
    for (const f of defaultFoods) {
      const carb_type = classifyCarbs(f);
      cache.foods.push({ ...f, id: genId("foods"), carb_type: carb_type || undefined });
    }
    persist();
  },

  getTemplates: (): DietTemplate[] => templatesCache,

  saveTemplate: (t: Omit<DietTemplate, "id" | "created_at">): DietTemplate => {
    const tmpl: DietTemplate = { ...t, id: Date.now(), created_at: new Date().toISOString() };
    templatesCache.push(tmpl);
    persist();
    return tmpl;
  },

  deleteTemplate: (id: number): void => {
    templatesCache = templatesCache.filter((t) => t.id !== id);
    persist();
  },
};

// Preserve existing synchronous view-model APIs while every mutation is durably queued.
export const db = new Proxy(localDb, {
 get(target,key: keyof typeof localDb){
  const value=target[key];
  if(typeof value!=='function')return value;
  if(key==='init'||String(key).startsWith('get'))return value;
  return (...args:unknown[])=>{assertWritable();return (value as (...a:unknown[])=>unknown)(...args);};
 }
});
