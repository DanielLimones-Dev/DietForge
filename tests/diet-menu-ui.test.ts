import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {act,createElement,useEffect,useState} from 'react';
import type {ClientMenu} from '../src/types/diet-menus';
import type {DietMenuStore} from '../src/components/diet-menus/DietMenus';

test('menu editor locks controls during slow save and keeps dirty draft after failure',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const keys=['window','document','navigator','WebSocket','BroadcastChannel'] as const;const originals=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture-key';
 const stamp='2026-09-24T12:00:00Z';const menus:ClientMenu[]=[1,2].map(id=>({id,name:`Menú ${id}`,client_id:1,assigned:false,meals:[],created_at:stamp,updated_at:stamp}));let updates=0,reads=0,fail=false;let release!:()=>void;const wait=new Promise<void>(resolve=>{release=resolve;});
 const unexpected=()=>{throw new Error('Unexpected action');};
 const store:DietMenuStore={getMenus:()=>structuredClone(menus),getRecipes:()=>[],getFoods:()=>[],saveMenu:unexpected,deleteMenu:unexpected,saveRecipe:unexpected,updateRecipe:unexpected,deleteRecipe:unexpected,subscribe:()=>()=>{},updateMenu:(id,data)=>{updates++;const index=menus.findIndex(m=>m.id===id);menus[index]={...menus[index],...structuredClone(data)};return structuredClone(menus[index]);},flush:async()=>{reads++;if(reads===1)await wait;if(fail)throw new Error('No se pudo sincronizar fixture');}};
 const {DietMenus}=await import('../src/components/diet-menus/DietMenus');const {supabase}=await import('../src/lib/supabase');const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root')!);
 const name=()=>document.querySelector<HTMLInputElement>('[aria-label="Nombre del menú"]')!;
 const edit=async(value:string)=>{await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(name(),value);name().dispatchEvent(new dom.window.Event('input',{bubbles:true}));});};
 const button=(text:string)=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent===text);assert.ok(b,text);return b;};
 try{
  await act(async()=>root.render(createElement(DietMenus,{clientId:1,clientName:'Fixture',store})));await edit('Nombre editado');
  await act(async()=>button('Guardar menú').click());assert.equal(document.querySelector('fieldset')!.disabled,true);assert.equal(name().matches(':disabled'),true);assert.equal(updates,0,'write waits for prior queue');
  await act(async()=>button('Menú 2').click());assert.equal(name().value,'Nombre editado','native disabled fieldset blocks changing menu');
  await act(async()=>release());assert.equal(updates,1);assert.equal(document.querySelector('fieldset')!.disabled,false);assert.match(document.body.textContent??'',/Menú guardado como borrador/);
  await edit('Borrador a conservar');fail=true;await act(async()=>button('Guardar menú').click());assert.equal(updates,1,'preflight failure must not enqueue another mutation');assert.equal(name().value,'Borrador a conservar');assert.match(document.body.textContent??'',/No se pudo sincronizar fixture/);assert.match(document.body.textContent??'',/Cambios sin guardar/);assert.equal(document.querySelector('fieldset')!.disabled,false);
 }finally{await act(async()=>root.unmount());await supabase.auth.stopAutoRefresh();for(const key of keys){const old=originals.get(key);if(old)Object.defineProperty(globalThis,key,old);else Reflect.deleteProperty(globalThis,key);}dom.window.close();}
});

test('diet sub-tabs start on the existing plan and preserve both panels without navigation',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/plans/42',pretendToBeVisual:true});const keys=['window','document','navigator','WebSocket','BroadcastChannel'] as const;
 const originals=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture-key';
 const {DietTabs}=await import('../src/components/diet-menus/DietWorkspace');const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root')!);let mounts=0,unmounts=0;
 function Plan(){const [count,setCount]=useState(0);useEffect(()=>{mounts++;return()=>{unmounts++;};},[]);return createElement('button',{id:'plan-edit',onClick:()=>setCount(v=>v+1)},`Borrador ${count}`);}
 try{
  // Required children prop is checked explicitly in this createElement fixture.
  // eslint-disable-next-line react/no-children-prop
  await act(async()=>root.render(createElement(DietTabs,{children:createElement(Plan),menus:createElement('input',{id:'menu-draft',defaultValue:'Menú pendiente'})})));
  const plan=document.getElementById('dm-plan-content')!,menus=document.getElementById('dm-menus-content')!;
  assert.equal(plan.hidden,false);assert.equal(menus.hidden,true);assert.equal(mounts,1);
  await act(async()=>document.getElementById('plan-edit')!.click());await act(async()=>document.getElementById('dm-menus-tab')!.click());assert.equal(plan.hidden,true);assert.equal(menus.hidden,false);assert.equal(unmounts,0);
  (document.getElementById('menu-draft') as HTMLInputElement).value='Receta aún sin guardar';
  await act(async()=>document.getElementById('dm-plan-tab')!.click());assert.equal(plan.hidden,false);assert.equal(document.getElementById('plan-edit')!.textContent,'Borrador 1');assert.equal(mounts,1);assert.equal((document.getElementById('menu-draft') as HTMLInputElement).value,'Receta aún sin guardar');
  assert.equal(window.location.href,'http://localhost/plans/42');assert.equal(document.querySelectorAll('a').length,0,'tabs do not navigate to another route');
 }finally{await act(async()=>root.unmount());for(const key of keys){const old=originals.get(key);if(old)Object.defineProperty(globalThis,key,old);else Reflect.deleteProperty(globalThis,key);}dom.window.close();}
});

test('meal library preserves repeated additions and automatically selects remaining or new meals',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});const keys=['window','document','navigator','WebSocket','BroadcastChannel'] as const;
 const originals=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture-key';dom.window.confirm=()=>true;
 const stamp='2026-09-24T12:00:00Z';let menu:ClientMenu={id:1,name:'Fixture',client_id:1,assigned:false,meals:[{id:'00000000-0000-4000-8000-000000000001',name:'Desayuno',items:[]},{id:'00000000-0000-4000-8000-000000000002',name:'Cena',items:[]}],created_at:stamp,updated_at:stamp};
 const unexpected=()=>{throw new Error('Unexpected action');};const store:DietMenuStore={getMenus:()=>structuredClone([menu]),getRecipes:()=>[],getFoods:()=>[{id:1,name:'Avena fixture',category:'grains',protein:13,carbs:60,fat:7,fiber:10,antioxidants:0,kcal:370,serving_size:40,serving_unit:'g',source:'manual'}],saveMenu:unexpected,deleteMenu:unexpected,saveRecipe:unexpected,updateRecipe:unexpected,deleteRecipe:unexpected,subscribe:()=>()=>{},updateMenu:(_id,data)=>{menu={...menu,...structuredClone(data)};return structuredClone(menu);},flush:async()=>{}};
 const {DietMenus}=await import('../src/components/diet-menus/DietMenus');const {supabase}=await import('../src/lib/supabase');const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root')!);
 const target=()=>document.querySelector<HTMLSelectElement>('[aria-label="Comida de destino"]')!;const add=()=>document.querySelector<HTMLButtonElement>('.dm-picker-results button')!;const items=()=>Array.from(document.querySelectorAll('.dm-meal')).map(m=>m.querySelectorAll('.dm-entry').length);
 try{
  await act(async()=>root.render(createElement(DietMenus,{clientId:1,clientName:'Fixture',store})));assert.equal(add().disabled,true);
  await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="Seleccionar Desayuno"]')!.click());const breakfast=target().value;
  await act(async()=>add().click());await act(async()=>add().click());assert.deepEqual(items(),[2,0]);assert.equal(target().value,breakfast);
  await act(async()=>{target().value=menu.meals[1].id;target().dispatchEvent(new dom.window.Event('change',{bubbles:true}));});await act(async()=>add().click());assert.deepEqual(items(),[2,1]);
  await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="Eliminar Cena"]')!.click());assert.equal(target().value,breakfast);assert.equal(add().disabled,false);assert.deepEqual(items(),[2]);
  await act(async()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Guardar menú')!.click());assert.equal(menu.meals.length,1);assert.equal(menu.meals[0].items.length,2);assert.notEqual(menu.meals[0].items[0].id,menu.meals[0].items[1].id);
  await act(async()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Agregar comida')!.click());assert.notEqual(target().value,breakfast);assert.equal(add().disabled,false);await act(async()=>add().click());assert.deepEqual(items(),[2,1],'new meal receives the next addition without a separate selection');
  await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="Seleccionar Desayuno"]')!.click());assert.equal(target().value,breakfast);await act(async()=>add().click());assert.deepEqual(items(),[3,1],'meal header selects its own meal');
 }finally{await act(async()=>root.unmount());await supabase.auth.stopAutoRefresh();for(const key of keys){const old=originals.get(key);if(old)Object.defineProperty(globalThis,key,old);else Reflect.deleteProperty(globalThis,key);}dom.window.close();}
});
