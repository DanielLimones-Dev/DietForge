import test from 'node:test';
import assert from 'node:assert/strict';
import type {Food} from '../src/types';
import type {Recipe,ClientMenu} from '../src/types/diet-menus';
import {recipeTotals,menuTotals,duplicateMenu,recipeIssues,menuIssues} from '../src/lib/diet-menus';
import {emptySnapshot,validateSnapshot} from '../src/lib/cloud/model';
const food:Food={id:1,name:'Alimento prueba',category:'protein',protein:20,carbs:10,fat:5,fiber:2,antioxidants:0,kcal:165,serving_size:50,serving_unit:'g',source:'manual'};
const recipe:Recipe={id:1,name:'Receta',servings:2,instructions:'Preparar',ingredients:[{id:'00000000-0000-4000-8000-000000000001',food,quantity:2,unit:'pieza'}],created_at:'2026-09-24T12:00:00Z',updated_at:'2026-09-24T12:00:00Z'};
const menu:ClientMenu={id:1,client_id:1,name:'Menú',assigned:true,meals:[{id:'00000000-0000-4000-8000-000000000002',name:'Desayuno',items:[{id:'00000000-0000-4000-8000-000000000003',kind:'recipe',recipe,portions:2},{id:'00000000-0000-4000-8000-000000000004',kind:'food',ingredient:{id:'00000000-0000-4000-8000-000000000005',food,quantity:100,unit:'g'}}]}],created_at:recipe.created_at,updated_at:recipe.updated_at};
test('recipe totals use ingredient units and servings; menu sums food and recipe portions',()=>{assert.deepEqual(recipeTotals(recipe),{kcal:82.5,protein:10,carbs:5,fat:2.5,fiber:1});assert.equal(recipeTotals(recipe,2).kcal,165);assert.equal(menuTotals(menu).kcal,330);assert.ok(Math.abs(recipeTotals({...recipe,servings:1,ingredients:[{...recipe.ingredients[0],quantity:1,unit:'lb'}]}).protein-90.718474)<1e-8);});
test('duplicate menu is independent and renews nested ids without assigning',()=>{const copy=duplicateMenu(menu);assert.equal(copy.assigned,false);assert.notEqual(copy.name,menu.name);assert.notEqual(copy.meals[0].id,menu.meals[0].id);assert.notEqual(copy.meals[0].items[0].id,menu.meals[0].items[0].id);const item=copy.meals[0].items[0];assert.equal(item.kind,'recipe');if(item.kind==='recipe'){assert.notEqual(item.recipe.ingredients[0].id,recipe.ingredients[0].id);item.recipe.ingredients[0].food.protein=99;}assert.equal(recipe.ingredients[0].food.protein,20);assert.equal('id' in copy,false);});
test('validators reject nonfinite quantities, unsafe paths and invalid nutritional data',()=>{assert.deepEqual(recipeIssues(recipe),[]);assert.deepEqual(menuIssues(menu),[]);for(const patch of [{servings:0},{servings:Infinity},{name:''},{photo_path:'https://x.test/a.jpg'},{photo_path:'../a.jpg'},{ingredients:[{...recipe.ingredients[0],quantity:NaN}]},{ingredients:[{...recipe.ingredients[0],food:{...food,fat:-1}}]}])assert.ok(recipeIssues({...recipe,...patch}).length);assert.ok(menuIssues({...menu,assigned:'yes'}).length);assert.ok(menuIssues({...menu,meals:[{...menu.meals[0],items:[{id:'00000000-0000-4000-8000-000000000006',kind:'unknown'}]}]}).length);});
test('legacy snapshots get empty independent collections while malformed collections and client references fail',()=>{const old=emptySnapshot();Reflect.deleteProperty(old.database,'recipes');Reflect.deleteProperty(old.database,'clientMenus');const upgraded=validateSnapshot(old);assert.deepEqual(upgraded.database.recipes,[]);assert.deepEqual(upgraded.database.clientMenus,[]);const s=emptySnapshot();s.database.clients=[{id:1,name:'Fixture',created_at:recipe.created_at,updated_at:recipe.updated_at}];s.database.recipes=[recipe];s.database.clientMenus=[structuredClone(menu)];const before=structuredClone(s.database.mealPlans);assert.equal(validateSnapshot(s).database.clientMenus.length,1);assert.deepEqual(s.database.mealPlans,before);s.database.clientMenus[0].client_id=999;assert.throws(()=>validateSnapshot(s));});

test('db menu writes are isolated copies, require clients and leave existing diet plans untouched',async()=>{
 const {JSDOM}=await import('jsdom');const dom=new JSDOM('',{url:'http://localhost'});
 const globals=['localStorage','WebSocket','BroadcastChannel'] as const;const originals=new Map(globals.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const key of globals)Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture-key';
 const snapshot=emptySnapshot();snapshot.database.clients=[{id:1,name:'Fixture',created_at:recipe.created_at,updated_at:recipe.updated_at}];
 snapshot.database.mealPlans=[{id:3,client_id:1,measurement_id:null,date:'2026-09-24',name:'Dieta actual',total_kcal:1500,total_protein:100,total_carbs:150,total_fat:55,total_fiber:20,total_antioxidants:0}];
 snapshot.database.mealPlanItems=[{id:4,meal_plan_id:3,meal_time:'meal1',food_id:1,quantity:50,serving_unit:'g'}];
 let remoteRevision=1;const oldFetch=globalThis.fetch;
 globalThis.fetch=async(input,init)=>{const request=new Request(input,init);const url=new URL(request.url);assert.equal(url.origin,'https://fixture.supabase.co');if(url.pathname.endsWith('dietforge_load'))return Response.json({snapshot,revision:1});if(url.pathname.endsWith('dietforge_save'))return Response.json(++remoteRevision);throw new Error('Unexpected request');};
 const {supabase}=await import('../src/lib/supabase');const oldSession=supabase.auth.getSession;
 supabase.auth.getSession=(async()=>({data:{session:{user:{id:'fixture-owner'},access_token:'fixture'}},error:null})) as typeof supabase.auth.getSession;
 const {db,initializeCloud,disconnectCloud,retryCloudSave}=await import('../src/lib/db');
 try{
  disconnectCloud();assert.throws(()=>db.saveRecipe(recipe));await initializeCloud('fixture-owner');
  const before=structuredClone([db.getMealPlans(1),db.getMealPlan(3)]);
  const savedRecipe=db.saveRecipe(recipe);await retryCloudSave();savedRecipe.ingredients[0].food.protein=999;assert.equal(db.getRecipes()[0].ingredients[0].food.protein,20);
  const retrieved=db.getRecipes();retrieved[0].name='mutated';assert.equal(db.getRecipes()[0].name,'Receta');
  const savedMenu=db.saveClientMenu(menu);await retryCloudSave();savedMenu.meals[0].name='mutated';assert.equal(db.getClientMenus(1)[0].meals[0].name,'Desayuno');
  assert.throws(()=>db.updateClientMenu(savedMenu.id,{client_id:999}));assert.equal(db.getClientMenus(1).length,1);
  assert.throws(()=>db.updateRecipe(savedRecipe.id,{servings:0}));assert.equal(db.getRecipes()[0].servings,2);
  db.deleteRecipe(savedRecipe.id);await retryCloudSave();assert.equal(db.getRecipes().length,0);assert.equal(menuTotals(db.getClientMenus(1)[0]).kcal,330);
  assert.deepEqual([db.getMealPlans(1),db.getMealPlan(3)],before);
  db.deleteClient(1);await retryCloudSave();assert.deepEqual(db.getClientMenus(1),[]);
 }finally{disconnectCloud();supabase.auth.getSession=oldSession;globalThis.fetch=oldFetch;await supabase.auth.stopAutoRefresh();for(const key of globals){const old=originals.get(key);if(old)Object.defineProperty(globalThis,key,old);else Reflect.deleteProperty(globalThis,key);}dom.window.close();}
});

test('empty menu draft can be saved but cannot be assigned until completed',()=>{assert.deepEqual(menuIssues({...menu,assigned:false,meals:[]}),[]);assert.deepEqual(menuIssues({...menu,assigned:false,meals:[{id:'00000000-0000-4000-8000-000000000002',name:'Comida',items:[]}]}),[]);assert.ok(menuIssues({...menu,assigned:true,meals:[]}).length);assert.ok(menuIssues({...menu,assigned:true,meals:[{id:'00000000-0000-4000-8000-000000000002',name:'Comida',items:[]}]}).length);});
test('editing invalid recipe numbers never returns nonfinite preview totals',()=>{for(const draft of [{...recipe,servings:NaN},{...recipe,servings:0},{...recipe,ingredients:[{...recipe.ingredients[0],quantity:NaN}]}])for(const n of Object.values(recipeTotals(draft)))assert.ok(Number.isFinite(n));});

test('domain rejects child IDs and numerical values that the cloud cannot accept',()=>{
 const ingredient=recipe.ingredients[0];
 for(const patch of [{servings:10001},{ingredients:[{...ingredient,id:'not-a-uuid'}]},{ingredients:[{...ingredient,quantity:100001}]},{ingredients:[{...ingredient,food:{...food,protein:100001}}]},{ingredients:[{...ingredient,food:{...food,serving_size:100001}}]}])assert.ok(recipeIssues({...recipe,...patch}).length);
 assert.ok(menuIssues({...menu,meals:[{...menu.meals[0],id:'invalid'}]}).length);
 assert.ok(menuIssues({...menu,meals:[{...menu.meals[0],items:[{...menu.meals[0].items[0],id:'invalid'}]}]}).length);
 assert.ok(menuIssues({...menu,meals:[{...menu.meals[0],items:[{id:'00000000-0000-4000-8000-000000000009',kind:'recipe',recipe,portions:10001}]}]}).length);
 assert.deepEqual(recipeIssues({...recipe,servings:10000,ingredients:[{...ingredient,quantity:100000,food:{...food,protein:100000}}]}),[]);
});
