import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h,act} from 'react';
import {JSDOM} from 'jsdom';
import {PortalFailure} from '../src/lib/portal-errors';

function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(yes=>{resolve=yes;});return {promise,resolve};}
test('portal sync preserves drafts offline, recovers, rejects late client responses and stops on revoked access',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const keys=['window','document','navigator','IS_REACT_ACT_ENVIRONMENT'] as const;
 const original=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,key,{configurable:true,value});
 let online=true;Object.defineProperty(dom.window.navigator,'onLine',{get:()=>online,configurable:true});
 const timers=new Map<number,()=>void>();let next=0;
 dom.window.setTimeout=((fn:()=>void)=>{timers.set(++next,fn);return next;}) as typeof dom.window.setTimeout;
 dom.window.clearTimeout=(id:number)=>{timers.delete(id);};
 const {createRoot}=await import('react-dom/client');
 const {usePortalSync}=await import('../src/lib/use-portal-sync');
 const root=createRoot(document.getElementById('root')!);
 let current!:ReturnType<typeof usePortalSync<string>>;
 function Harness({read}:{read:()=>Promise<string>}){current=usePortalSync(read);return h('div',null,h('p',{'role':'status'},current.message),h('b',null,current.data),h('input',{'aria-label':'Borrador',defaultValue:''}));}
 let reads=0,fail=false,denied=false;
 const read=async()=>{reads++;if(denied)throw new PortalFailure('forbidden','Acceso revocado');if(fail)throw new TypeError('Failed to fetch');return 'A actualizado';};
 try{
  await act(async()=>root.render(h(Harness,{read})));
  assert.equal(reads,1);assert.equal(current.data,'A actualizado');
  const input=document.querySelector('input')!;input.value='Borrador sin guardar';
  online=false;await act(async()=>window.dispatchEvent(new dom.window.Event('offline')));
  assert.equal(current.offline,true);assert.match(current.message,/Sin conexión/);assert.equal(reads,1);
  fail=true;online=true;await act(async()=>window.dispatchEvent(new dom.window.Event('online')));
  assert.equal((current.error as PortalFailure|null)?.kind,'transient');assert.equal(current.data,'A actualizado');assert.equal(document.querySelector('input'),input);assert.equal(input.value,'Borrador sin guardar');
  fail=false;await act(async()=>current.reload());assert.equal(current.error,null);assert.equal(current.offline,false);
  const late=deferred<string>();
  await act(async()=>root.render(h(Harness,{read:()=>late.promise})));
  assert.equal(current.data,null,'Hide previous identity during new load');
  await act(async()=>root.render(h(Harness,{read:async()=>'Cliente B'})));
  await act(async()=>late.resolve('Cliente A antiguo'));assert.equal(current.data,'Cliente B');
  await act(async()=>root.render(h(Harness,{read})));
  denied=true;await act(async()=>current.reload());assert.equal(current.data,null);assert.equal((current.error as PortalFailure|null)?.kind,'forbidden');assert.equal(timers.size,0);
  const atDenial=reads;await act(async()=>window.dispatchEvent(new dom.window.Event('focus')));assert.equal(reads,atDenial);
  denied=false;await act(async()=>current.reload());assert.equal(current.data,'A actualizado');assert.equal(current.error,null);
 }finally{
  await act(async()=>root.unmount());assert.equal(timers.size,0);
  for(const key of keys){const descriptor=original.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
  dom.window.close();
 }
});
