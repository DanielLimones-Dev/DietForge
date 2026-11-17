import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {act,createElement} from 'react';

const stamp='2026-11-16T12:00:00Z';
const food=(id:number,name:string,kcal:number)=>({id,name,category:'protein',protein:20,carbs:5,fat:3,fiber:1,antioxidants:0,kcal,serving_size:100,serving_unit:'g',source:'manual'});
const menu=(name:string,items:unknown[])=>({id:1,client_id:1,name:'Menú asignado',assigned:true,created_at:stamp,updated_at:stamp,meals:[{id:'00000000-0000-4000-8000-000000000011',name:'Desayuno',items}]});
const entry=(id:string,foodId:number,name:string)=>({id,kind:'food',ingredient:{id:id.replace('01','31'),food:food(foodId,name,100),quantity:100,unit:'g'}});

function browserFixture(){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const keys=['window','document','navigator','WebSocket','BroadcastChannel'] as const;const originals=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture-key';
 return {dom,restore:()=>{for(const key of keys){const prior=originals.get(key);if(prior)Object.defineProperty(globalThis,key,prior);else Reflect.deleteProperty(globalThis,key);}dom.window.close();}};
}

test('el portal cliente muestra los menús sin datos iniciales y actualiza sus alimentos al refrescar',async()=>{
 const {dom,restore}=browserFixture();
 const {supabase}=await import('../src/lib/supabase');const originalRpc=supabase.rpc;
 let menuData:unknown={menus:[menu('Menú asignado',[entry('00000000-0000-4000-8000-000000000001',1,'Avena inicial')])],days:[]};
 let reads=0;
 supabase.rpc=(async(name:string)=>{
  assert.equal(name,'dietforge_menus_read');reads++;
  return {data:structuredClone(menuData),error:null};
 }) as unknown as typeof supabase.rpc;
 const {PortalMenus}=await import('../src/components/diet-menus/PortalMenus');
 const {createRoot}=await import('react-dom/client');const root=createRoot(dom.window.document.getElementById('root')!);
 const text=()=>dom.window.document.body.textContent??'';
 try{
  await act(async()=>{root.render(createElement(PortalMenus,{owner:'00000000-0000-4000-8000-000000000001',clientId:1}));});
  assert.match(text(),/Avena inicial/,'the portal renders the assigned menu once the read resolves');
  assert.ok(reads>=1);
  menuData={menus:[menu('Menú asignado',[entry('00000000-0000-4000-8000-000000000001',1,'Avena inicial'),entry('00000000-0000-4000-8000-000000000002',2,'Alimento agregado')])],days:[]};
  await act(async()=>{dom.window.dispatchEvent(new dom.window.Event('focus'));await Promise.resolve();});
  assert.match(text(),/Alimento agregado/,'a coach save appears after the automatic refresh without reloading');
  menuData={menus:[menu('Menú asignado',[entry('00000000-0000-4000-8000-000000000003',3,'Alimento tras bfcache')])],days:[]};
  const restored=new dom.window.Event('pageshow');Object.defineProperty(restored,'persisted',{value:true});
  await act(async()=>{dom.window.dispatchEvent(restored);await Promise.resolve();});
  assert.match(text(),/Alimento tras bfcache/,'a page restored from the back-forward cache revalidates at once');
 }finally{
  await act(async()=>root.unmount());supabase.rpc=originalRpc;await supabase.auth.stopAutoRefresh();restore();
 }
});

test('el plan de alimentación del portal se actualiza solo cuando el coach agrega un alimento',async()=>{
 const {dom,restore}=browserFixture();
 const {supabase}=await import('../src/lib/supabase');const originalRpc=supabase.rpc;
 const base={
  client:{id:1,name:'Cliente de prueba',next_check_in_date:null},
  trainingPrograms:[],measurements:[],weekPlans:[],activity:[],
  mealPlans:[{id:1,client_id:1,measurement_id:0,date:stamp,name:'Plan de prueba',total_kcal:2300,total_protein:150,total_carbs:250,total_fat:70,total_fiber:30,total_antioxidants:0}],
  mealPlanItems:[{id:1,meal_plan_id:1,meal_time:'meal1',food_id:1,quantity:100,serving_unit:'g'}],
  foods:[food(1,'Alimento inicial',127)],
 };
 let portalData:typeof base=structuredClone(base);
 supabase.rpc=(async(name:string)=>{
  if(name==='dietforge_portal_read')return {data:structuredClone(portalData),error:null};
  if(name==='dietforge_diet_notice_read')return {data:{revision:null,pending:false},error:null};
  throw new Error(`Unexpected RPC ${name}`);
 }) as unknown as typeof supabase.rpc;
 const {ClientCare}=await import('../src/components/ClientCare');
 const {createRoot}=await import('react-dom/client');const root=createRoot(dom.window.document.getElementById('root')!);
 const text=()=>dom.window.document.body.textContent??'';
 try{
  await act(async()=>{root.render(createElement(ClientCare,{owner:'00000000-0000-4000-8000-000000000001',clientId:1}));});
  assert.match(text(),/Alimento inicial/,'the client portal opens on the diet plan and shows its foods');
  // The coach saves a new food while the client keeps the portal open.
  portalData={...base,mealPlanItems:[...base.mealPlanItems,{id:2,meal_plan_id:1,meal_time:'meal1',food_id:2,quantity:150,serving_unit:'g'}],foods:[...base.foods,food(2,'Alimento agregado',200)]};
  await act(async()=>{dom.window.dispatchEvent(new dom.window.Event('focus'));await Promise.resolve();});
  assert.match(text(),/Alimento agregado/,'the automatic refresh shows the new food without reloading');
  assert.match(text(),/300 kcal/,'the new food keeps its nutrients in the portal plan');
 }finally{
  await act(async()=>root.unmount());supabase.rpc=originalRpc;await supabase.auth.stopAutoRefresh();restore();
 }
});
