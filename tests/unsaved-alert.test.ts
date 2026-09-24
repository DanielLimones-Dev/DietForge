import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {act,createElement} from 'react';
import type {ClientMenu} from '../src/types/diet-menus';
import type {DietMenuStore} from '../src/components/diet-menus/DietMenus';

test('unsaved menu alert preserves draft on cancel and Escape, discards only on explicit action without browser confirm',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const keys=['window','document','navigator','WebSocket','BroadcastChannel','IS_REACT_ACT_ENVIRONMENT'] as const;
 const originals=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,value:key==='IS_REACT_ACT_ENVIRONMENT'?true:dom.window[key]});
 const envKeys=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;const env=envKeys.map(k=>process.env[k]);
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture-key';
 let shown=0,closed=0,confirmCalls=0;
 dom.window.HTMLDialogElement.prototype.showModal=function(){shown++;this.open=true;};
 dom.window.HTMLDialogElement.prototype.close=function(){closed++;this.open=false;};
 dom.window.confirm=()=>{confirmCalls++;throw new Error('Browser confirm must not handle unsaved changes');};
 const stamp='2026-09-24T12:00:00Z';const menus:ClientMenu[]=[1,2].map(id=>({id,name:`Menú ${id}`,client_id:1,assigned:false,meals:[],created_at:stamp,updated_at:stamp}));
 const unexpected=()=>{throw new Error('Unexpected persistence');};
 const store:DietMenuStore={getMenus:()=>structuredClone(menus),getRecipes:()=>[],getFoods:()=>[],subscribe:()=>()=>{},flush:async()=>{},saveMenu:data=>{const menu={...data,id:menus.length+1};menus.push(menu);return structuredClone(menu);},updateMenu:unexpected,deleteMenu:unexpected,saveRecipe:unexpected,updateRecipe:unexpected,deleteRecipe:unexpected};
 const {DietMenus}=await import('../src/components/diet-menus/DietMenus');const {supabase}=await import('../src/lib/supabase');const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root')!);
 const name=()=>document.querySelector<HTMLInputElement>('[aria-label="Nombre del menú"]')!;
 const click=async(text:string)=>{const button=Array.from(document.querySelectorAll('button')).find(b=>b.textContent===text);assert.ok(button,text);await act(async()=>button.click());};
 const edit=async(value:string)=>{await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(name(),value);name().dispatchEvent(new dom.window.Event('input',{bubbles:true}));});};
 try{
  await act(async()=>root.render(createElement(DietMenus,{clientId:1,clientName:'Fixture',store})));
  await edit('Borrador importante');await click('Menú 2');assert.ok(document.querySelector('dialog[open]'));assert.equal(name().value,'Borrador importante');
  await click('Seguir editando');assert.equal(document.querySelector('dialog'),null);assert.equal(name().value,'Borrador importante');
  await click('Menú 2');const cancel=new dom.window.Event('cancel',{cancelable:true,bubbles:false});await act(async()=>document.querySelector('dialog')!.dispatchEvent(cancel));assert.equal(cancel.defaultPrevented,true);assert.equal(name().value,'Borrador importante');assert.equal(document.querySelector('dialog'),null);
  await click('Menú 2');await click('Descartar cambios');assert.equal(name().value,'Menú 2');assert.equal(menus[0].name,'Menú 1','discard does not save draft');
  await edit('Segundo borrador');await click('Agregar menú');assert.equal(menus.length,2);await click('Seguir editando');assert.equal(menus.length,2);assert.equal(name().value,'Segundo borrador');
  await click('Agregar menú');await click('Descartar cambios');assert.equal(menus.length,3);assert.equal(name().value,'Menú 3');assert.equal(confirmCalls,0);assert.equal(shown,closed);
 }finally{await act(async()=>root.unmount());await supabase.auth.stopAutoRefresh();for(const key of keys){const old=originals.get(key);if(old)Object.defineProperty(globalThis,key,old);else Reflect.deleteProperty(globalThis,key);}envKeys.forEach((key,i)=>{if(env[i]===undefined)delete process.env[key];else process.env[key]=env[i];});dom.window.close();}
});
