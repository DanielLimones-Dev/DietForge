import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as pause } from "node:timers/promises";
import { JSDOM } from "jsdom";
import { act, createElement, StrictMode } from "react";
import { emptySnapshot } from "../src/lib/cloud/model";
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PathParamsContext, PathnameContext, SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';

test("account changes hide old screens and scope cloud requests to their owner", { timeout: 15_000 }, async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:3000" });
  const keys = ["self", "window", "document", "navigator", "localStorage", "WebSocket", "BroadcastChannel"] as const;
  const original = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const {createRoot}=await import("react-dom/client");
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture-public-key";
  const originalFetch = globalThis.fetch;
  const originalResizeObserver = globalThis.ResizeObserver;
  // JSDOM has no layout engine; this smoke test checks mounting, not chart geometry.
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  const ids = { a: "00000000-0000-4000-8000-000000000001", b: "00000000-0000-4000-8000-000000000002" };
  const user = (id: string) => ({ id, aud: "authenticated", email: `${id}@example.invalid`, created_at: new Date().toISOString(), app_metadata: {}, user_metadata: {} });
  const token = (id: string) => `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`;
  const data = (id: string) => {
    const snapshot = emptySnapshot();
    snapshot.database.seed_version = id === ids.b ? 1 : 2;
    snapshot.database.clients = [{ id: 1, name: `Cuenta ${id}`, created_at: "2026-09-01", updated_at: "2026-09-01" }];
    snapshot.database.foods = [{ id: 1, name: "Alimento de prueba", category: "protein", protein: 1, carbs: 1, fat: 1, fiber: 0, antioxidants: 0, kcal: 17, serving_size: 100, serving_unit: "g", source: "manual" }];
    return snapshot;
  };
  const loads: string[] = [];
  const writes: string[] = [];
  const activities: Record<string,unknown>[]=[];
  let releaseB!: () => void;
  const waitB = new Promise<void>(resolve => { releaseB = resolve; });
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    assert.equal(url.origin, "https://fixture.supabase.co", "no live services allowed");
    const jwt = request.headers.get("Authorization")!.replace("Bearer ", "");
    const id = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).sub as string;
    if (url.pathname === "/auth/v1/user") return Response.json(user(id));
    if (url.pathname === "/auth/v1/logout") return new Response(null, { status: 204 });
    if (url.pathname.endsWith('dietforge_my_access')) return Response.json({active:true,status:'admin',isAdmin:true,email:'fixture@example.invalid',expiresAt:null});
    if (url.pathname.endsWith('dietforge_admin_list')) return Response.json({coaches:[],history:[]});
    if (url.pathname.endsWith("dietforge_load")) {
      loads.push(id);
      if (id === ids.b) await waitB;
      return Response.json({ revision: 1, snapshot: data(id) });
    }
    if (url.pathname.endsWith("dietforge_activity_save")) { activities.push(await request.json());return Response.json(null); }
    if (url.pathname.endsWith("dietforge_save")) { writes.push(id); return Response.json(2); }
    throw new Error(`Unexpected fixture endpoint ${url.pathname}`);
  };
  const { supabase } = await import("../src/lib/supabase");
  const { CloudGate, CloudDataGate } = await import("../src/components/CloudGate");
  const { db, retryCloudSave } = await import("../src/lib/db");
  const root = createRoot(dom.window.document.getElementById("root")!);
  const content = () => dom.window.document.body.textContent || "";
  const flushUntil = async (condition: () => boolean) => {
    for (let i = 0; i < 100 && !condition(); i++) await act(async () => { await pause(5); });
    assert.ok(condition(), "expected account state was rendered");
  };
  function PrivateScreen() { return createElement("main", null, db.getClients().map(client => client.name).join(",")); }
  try {
    await act(async () => { root.render(createElement(StrictMode, null, createElement(CloudGate, null, createElement(CloudDataGate, null, createElement(PrivateScreen))))); });
    await flushUntil(() => content().includes("Iniciar sesión"));
    assert.equal(loads.length, 0);
    await act(async () => { const { error } = await supabase.auth.setSession({ access_token: token(ids.a), refresh_token: "fixture-a" }); assert.equal(error, null); });
    await flushUntil(() => content().includes(`Cuenta ${ids.a}`));
    assert.deepEqual(loads, [ids.a], "StrictMode initializes only once");
    await act(async () => { db.saveClient({ name: "Nuevo cliente de prueba" }); await retryCloudSave(); });
    assert.deepEqual(writes, [ids.a]);
    await act(async () => {
      const client = db.saveClient({name:'Cliente de regresión'});
      db.updateClient(client.id,{name:'Cliente actualizado'});
      assert.equal(db.getClient(client.id)?.name,'Cliente actualizado');
      const food = db.saveFood({name:'Alimento de regresión',category:'protein',protein:20,carbs:5,fat:2,fiber:0,antioxidants:0,kcal:118,serving_size:100,serving_unit:'g',source:'manual'});
      const exercise=db.saveExercise({name:'Remo personal',muscle_group:'Espalda',notes:'Pausa escapular',video_url:'https://www.youtube.com/watch?v=C8rcH2DJxp0'});
      assert.equal(db.getExercises('espalda')[0]?.name,'Remo personal');
      db.updateExercise(exercise.id,{name:'Remo personal actualizado'});
      assert.equal(db.getExercises()[0]?.name,'Remo personal actualizado');
      db.deleteExercise(exercise.id);assert.equal(db.getExercises().length,0);
      const plan = db.saveMealPlan({client_id:client.id,measurement_id:null,date:'2026-09-06',name:'Plan',total_kcal:118,total_protein:20,total_carbs:5,total_fat:2,total_fiber:0,total_antioxidants:0},[{meal_time:'meal1',food_id:food.id,quantity:100,serving_unit:'g'}]);
      assert.throws(()=>db.deleteFood(food.id),/se utiliza/);
      assert.ok(db.getFood(food.id));
      const week = db.saveWeekPlan({client_id:client.id,name:'Semana A',start_date:'2026-09-06',day_plans:[{day:1,carb_day:'moderate',meal_plan_id:plan.id}]});
      const shared = db.saveWeekPlan({client_id:client.id,name:'Semana B',start_date:week.start_date,day_plans:week.day_plans});
      db.deleteWeekPlan(week.id);
      assert.ok(db.getMealPlan(plan.id),'plan shared with another week is preserved');
      db.deleteWeekPlan(shared.id);
      assert.equal(db.getMealPlan(plan.id),undefined);
      db.deleteFood(food.id);assert.equal(db.getFood(food.id),undefined,'no orphan items block removal');
      const second = db.saveMealPlan({...plan,name:'Individual'},[]);
      const nextWeek = db.saveWeekPlan({client_id:client.id,name:'Semana C',start_date:'2026-09-06',day_plans:[{day:1,carb_day:'moderate',meal_plan_id:second.id}]});
      db.deleteMealPlan(second.id);
      assert.deepEqual(db.getWeekPlan(nextWeek.id)?.day_plans,[],'week no longer links to deleted plan');
      db.deleteClient(client.id);
      assert.equal(db.getClient(client.id),undefined);assert.equal(db.getWeekPlans(client.id).length,0);
      await retryCloudSave();
    });
    const nativeSetItem=dom.window.Storage.prototype.setItem;
    dom.window.Storage.prototype.setItem=function(key,value){
      if(key==='dietforge_email')throw new dom.window.DOMException('Quota exceeded','QuotaExceededError');
      nativeSetItem.call(this,key,value);
    };
    await act(async () => { const { error } = await supabase.auth.setSession({ access_token: token(ids.b), refresh_token: "fixture-b" }); assert.equal(error, null); });
    dom.window.Storage.prototype.setItem=nativeSetItem;
    await flushUntil(() => loads.includes(ids.b));
    assert.doesNotMatch(content(), /Cuenta /, "old account is hidden during loading");
    await act(async () => { releaseB(); });
    await flushUntil(() => content().includes(`Cuenta ${ids.b}`));
    assert.ok(!content().includes(ids.a));
    assert.equal(db.getFood(1)?.name,'Alimento de prueba','seed upgrades preserve custom foods and IDs');
    assert.equal(db.getFoods().length,1,'opening a legacy catalog does not replace it with seed foods');
    await act(async()=>{
      db.saveMealPlan({client_id:1,measurement_id:null,date:'2026-09-06',name:'Plan de prueba Rest Day',total_kcal:2000,total_protein:150,total_carbs:250,total_fat:60,total_fiber:25,total_antioxidants:1},[{meal_time:'meal1',food_id:1,quantity:100,serving_unit:'g'}]);
      await retryCloudSave();
    });
    const {ToastProvider}=await import('../src/components/Toast');
    const {SubscriptionProvider}=await import('../src/contexts/SubscriptionContext');
    const screens=[
      (await import('../src/components/Dashboard')).Dashboard,
      (await import('../src/components/CoachDashboard')).CoachDashboard,
      (await import('../src/components/ClientList')).ClientList,
      (await import('../src/components/ClientForm')).ClientForm,
      (await import('../src/components/ClientDetail')).ClientDetail,
      (await import('../src/components/WeekPlanView')).WeekPlanView,
      (await import('../src/components/MealPlanner')).MealPlanner,
      (await import('../src/components/FoodDB')).FoodDB,
      (await import('../src/components/ExerciseDB')).ExerciseDB,
      (await import('../src/components/CalculatorPage')).CalculatorPage,
      (await import('../src/components/Reports')).Reports,
      (await import('../src/components/AdminPanel')).AdminPanel,
    ];
    const router={bfcacheId:'fixture',back(){},forward(){},refresh(){},push(){},replace(){},prefetch:async()=>{}};
    for(const Screen of screens){
      if(Screen.name==='MealPlanner'&&!db.getMealPlan(1))await act(async()=>{
        db.saveMealPlan({client_id:1,measurement_id:null,date:'2026-09-06',name:'Plan de prueba Rest Day',total_kcal:2000,total_protein:150,total_carbs:250,total_fat:60,total_fiber:25,total_antioxidants:1},[{meal_time:'meal1',food_id:1,quantity:100,serving_unit:'g'}]);
        await retryCloudSave();
      });
      await act(async()=>root.render(createElement(CloudGate,null,createElement(CloudDataGate,null,
        createElement(AppRouterContext.Provider,{value:router},createElement(PathParamsContext.Provider,{value:{id:'1'}},
        createElement(PathnameContext.Provider,{value:'/clients/1'},createElement(SearchParamsContext.Provider,{value:new URLSearchParams()},
        createElement(ToastProvider,null,createElement(SubscriptionProvider,null,createElement(Screen)))))))))));
      await act(async()=>{await pause(10);});
      assert.ok(content().trim().length>0,Screen.name+' renders without crashing');
      if(Screen.name==='Dashboard'){
        assert.equal(Array.from(dom.window.document.querySelectorAll('a')).some(link=>link.textContent?.includes('Registrar cliente')),false);
        assert.equal(Array.from(dom.window.document.querySelectorAll('a')).some(link=>link.textContent?.includes('Nuevo plan nutricional')),false);
      }
      if(Screen.name==='MealPlanner'){
        assert.ok(dom.window.document.querySelector('.animate-plan-page-enter'),'plan editor has an entrance transition');
        const button=(text:string)=>Array.from(dom.window.document.querySelectorAll('button')).find(b=>b.textContent?.trim()===text)!;
        const title=dom.window.document.querySelector<HTMLElement>('[aria-label^="Editar título:"]')!;
        await act(async()=>title.click());
        const titleInput=dom.window.document.querySelector<HTMLInputElement>('[aria-label="Nombre del plan"]')!;
        await act(async()=>{
          Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(titleInput,'   ');
          titleInput.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
        });
        await act(async()=>titleInput.blur());
        assert.equal(db.getMealPlan(1)!.plan.name,'Plan de prueba Rest Day','a blank edit restores the previous plan title');
        assert.ok(dom.window.document.querySelector('[aria-label^="Editar título:"]'),'the title remains editable after a blank edit');
        await act(async()=>dom.window.document.querySelector<HTMLButtonElement>('[aria-label="Rest Day"]')!.click());
        assert.match(dom.window.document.querySelector('[aria-label="Rest Day ON"]')!.className,/animate-rest-day-on/);
        assert.equal(dom.window.document.querySelector('.meal-day-layout')!.getAttribute('data-split'),'true');
        assert.equal(dom.window.document.querySelectorAll('[data-macro-layout] [data-macro-card]').length,2);
        assert.match(button('+ Agregar comida · Plan Normal').className,/h-12/,'add-meal control keeps a fixed height while columns animate');
        const normalRegion=dom.window.document.querySelector('[aria-label="Macros — Plan Normal"]')!;
        const normalBefore=normalRegion.textContent;
        const right=dom.window.document.querySelector('[data-meal-column="right"][data-meal-key="meal1"]')!;
        await act(async()=>right.querySelector<HTMLElement>('[role="button"]')!.click());
        const foodButton=Array.from(dom.window.document.querySelectorAll('button')).find(b=>b.textContent?.includes('Alimento de prueba')&&!b.getAttribute('aria-label'))!;
        await act(async()=>foodButton.click());
        await act(async()=>button('Agregar a "Comida 1"').click());
        assert.equal(normalRegion.textContent,normalBefore,'normal progress is unchanged by Rest Day addition');
        const saved=db.getMealPlan(1)!;
        assert.equal(saved.items.filter(i=>i.day_type==='rest').length,1);
        assert.equal(saved.items.filter(i=>i.day_type!=='rest').length,1);
        assert.match(dom.window.document.querySelector('[aria-label="Macros — Rest Day"]')!.textContent!,/17/,'rest day accumulates actual calories, not 75% of them');
        assert.equal(dom.window.document.querySelectorAll('[data-meal-column="left"] [aria-label="Quitar Alimento de prueba"]:disabled').length,0);
        assert.equal(button('Editar macros'),undefined);
        await act(async()=>button('+ Agregar comida · Rest Day').click());
        assert.match(button('+ Agregar comida · Rest Day').className,/animate-add-meal-ripple/);
        assert.equal(dom.window.document.querySelector('[data-meal-column="right"][data-meal-key="meal4"]')?.getAttribute('data-new-meal'),'true');
        assert.equal(dom.window.document.querySelector('[data-meal-column="left"][data-meal-key="meal4"]'),null);
        await act(async()=>button('Eliminar Comida 4 · Rest Day').click());
        const confirm=Array.from(dom.window.document.querySelectorAll('button')).find(b=>b.textContent?.trim()==='Eliminar');
        assert.ok(confirm);await act(async()=>confirm.click());
        assert.equal(dom.window.document.querySelector('[data-meal-column="right"][data-meal-key="meal4"]')?.getAttribute('data-removing-meal'),'true');
        assert.equal(dom.window.document.querySelector('[data-meal-row="meal4"]')?.getAttribute('data-removing-row'),'true');
        assert.match(dom.window.document.querySelector('[aria-live="polite"]')!.textContent!,/Comida 4 eliminándose de Rest Day/);
        await act(async()=>{await pause(650);});
        assert.equal(dom.window.document.querySelector('[data-meal-column="right"][data-meal-key="meal4"]'),null);
        await act(async()=>button('+ Agregar comida · Plan Normal').click());
        const left4=dom.window.document.querySelector('[data-meal-column="left"][data-meal-key="meal4"]')!;
        assert.equal(left4.getAttribute('data-new-meal'),'true');assert.equal(dom.window.document.querySelector('[data-meal-column="right"][data-meal-key="meal4"]'),null);
        assert.match(dom.window.document.querySelector('[aria-live="polite"]')!.textContent!,/Comida 4 agregada a Plan Normal/);
        const restBefore=dom.window.document.querySelector('[aria-label="Macros — Rest Day"]')!.textContent;
        const normalFoodButton=Array.from(dom.window.document.querySelectorAll('button')).find(b=>b.textContent?.includes('Alimento de prueba')&&!b.getAttribute('aria-label'))!;
        await act(async()=>normalFoodButton.click());
        await act(async()=>button('Agregar a "Comida 4"').click());
        assert.equal(db.getMealPlan(1)!.items.filter(i=>i.day_type!=='rest').length,2);
        assert.equal(dom.window.document.querySelector('[aria-label="Macros — Rest Day"]')!.textContent,restBefore);
        if(process.env.DIETFORGE_PREVIEW_FILE){
          const {writeFileSync}=await import('node:fs');
          writeFileSync(process.env.DIETFORGE_PREVIEW_FILE,dom.window.document.body.innerHTML);
        }
        await act(async()=>dom.window.document.querySelector<HTMLButtonElement>('[aria-label="Rest Day ON"]')!.click());
        assert.match(dom.window.document.querySelector('[aria-label="Rest Day"]')!.className,/animate-rest-day-off/);
        assert.equal(dom.window.document.querySelector('.meal-day-layout')!.getAttribute('data-split'),'false');
        assert.equal(db.getMealPlan(1)!.items.length,3,'switching modes preserves both days');
        await act(async()=>{await pause(1100);});
        assert.equal(dom.window.document.querySelector('.rest-day-pane'),null,'rest day column unmounts after the merge animation');
      }
    }
    const {SessionTracker}=await import('../src/components/SessionTracker');
    const {createTrainingDraft,exerciseFromLibrary}=await import('../src/lib/training');
    const program={...createTrainingDraft(1,'Rutina de prueba'),id:1,created_at:'',updated_at:''};
    program.days[0].exercises=[exerciseFromLibrary({id:'press',name:'Press de prueba',muscle_group:'Pectoral'},5)];
    let saved=0;
    await act(async()=>root.render(createElement(SessionTracker,{owner:ids.b,clientId:1,programs:[program],activity:[],onSaved:()=>saved++})));
    const trainingButton=(text:string)=>Array.from(dom.window.document.querySelectorAll('button')).find(b=>b.textContent===text)!;
    await act(async()=>trainingButton('Iniciar registro').click());
    const completed=dom.window.document.querySelector<HTMLInputElement>('.care-check input')!;
    await act(async()=>completed.click());
    await act(async()=>trainingButton('Guardar registro').click());
    assert.equal(activities.length,0,'incomplete sessions must not be sent');
    assert.match(content(),/Completa las series/);
    for(const box of dom.window.document.querySelectorAll<HTMLInputElement>('input[aria-label^="Completar Press"]'))await act(async()=>box.click());
    await act(async()=>trainingButton('Guardar registro').click());
    assert.equal(activities.length,1);assert.equal(saved,1);
    assert.equal(activities[0].o,ids.b);assert.equal(activities[0].c,1);
    await act(async()=>trainingButton('Guardar registro').click());
    assert.equal(activities[0].i,activities[1].i,'retry reuses activity identity');
    const {PeakWeekSimulator}=await import('../src/components/PeakWeekSimulator');
    const comp=db.saveCompetition({client_id:1,name:'Show de prueba',date:'2026-09-07T00:00:00.000Z'});
    const base={tmb:1500,tdee:2140,protein:150,carbs:250,fat:60,fiber:25,antioxidants:0};
    await act(async()=>root.render(createElement(PeakWeekSimulator,{clientId:1,competition:comp,latestMacros:base})));
    const peakButton=(label:string)=>Array.from(dom.window.document.querySelectorAll('button')).find(b=>b.textContent?.trim()===label)!;
    assert.equal(dom.window.document.querySelectorAll('button[aria-label^="Seleccionar "]').length,42);
    await act(async()=>dom.window.document.querySelector<HTMLButtonElement>('[aria-label="Seleccionar 2026-09-07"]')!.click());
    assert.equal(dom.window.document.querySelector('[aria-label="Seleccionar 2026-09-07"]')!.getAttribute('aria-pressed'),'true');
    await act(async()=>peakButton('Crear / actualizar 7 planes').click());
    const generated=db.getMealPlans(1).filter(p=>p.competition_id===comp.id);
    assert.equal(generated.length,7);
    await act(async()=>peakButton('Crear / actualizar 7 planes').click());
    assert.equal(db.getMealPlans(1).filter(p=>p.competition_id===comp.id).length,7);
    await act(async()=>dom.window.document.querySelector<HTMLButtonElement>('[aria-label="Seleccionar 2026-09-15"]')!.click());
    const reminder=dom.window.document.querySelector<HTMLInputElement>('[aria-label="Recordatorio del día"]')!;
    await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(reminder,'Revisar carga de carbohidratos');reminder.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
    const carbInput=dom.window.document.querySelector<HTMLInputElement>('[aria-label="Carbohidratos gramos"]')!;
    await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(carbInput,'350');carbInput.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
    await act(async()=>peakButton('Guardar configuración').click());
    const config=JSON.parse(db.getCompetitions(1).find(c=>c.id===comp.id)!.peak_week_config!);
    assert.equal(config.find((d:{date:string})=>d.date==='2026-09-15').reminder,'Revisar carga de carbohidratos');
    assert.equal(config.find((d:{date:string})=>d.date==='2026-09-15').carbs,350);
    assert.equal(db.getCompetitions(1).find(c=>c.id===comp.id)!.date,comp.date);
    await act(async()=>root.render(createElement(PeakWeekSimulator,{key:'reopen',clientId:1,competition:db.getCompetitions(1).find(c=>c.id===comp.id)!,latestMacros:base})));
    assert.match(dom.window.document.querySelector('[aria-label="Seleccionar 2026-09-15"]')!.textContent!,/Revisar carga/);
    if(process.env.DIETFORGE_PREVIEW_FILE){const {writeFileSync}=await import('node:fs');writeFileSync('/private/tmp/dietforge-peak-preview.html',dom.window.document.body.innerHTML);}
    await act(async()=>root.render(createElement(CloudGate,null,createElement(CloudDataGate,null,createElement('main',null,'Prueba')))));
    await act(async () => { await supabase.auth.signOut(); });
    await flushUntil(() => content().includes("Iniciar sesión"));
    assert.equal(dom.window.document.querySelector("main"), null);
    assert.equal(db.getClients().length, 0);
  } finally {
    releaseB();
    await act(async () => { root.unmount(); });
    supabase.auth.stopAutoRefresh();
    globalThis.fetch = originalFetch;
    globalThis.ResizeObserver = originalResizeObserver;
    dom.window.close();
    for (const key of keys) {
      const descriptor = original.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
