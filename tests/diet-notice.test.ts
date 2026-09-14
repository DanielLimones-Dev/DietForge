import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {act,createElement} from 'react';

test('diet notice preserves failed dismissals, suppresses stale polls and refreshes changed revisions',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const keys=['window','document','navigator','WebSocket','BroadcastChannel'] as const;
 const originals=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture-key';
 const {supabase}=await import('../src/lib/supabase');const originalRpc=supabase.rpc;
 let revision='revision-a',readFails=false,seenFails=false,seenResult=true,reads=0;
 const seen:string[]=[];
 supabase.rpc=(async(name:string,args:Record<string,unknown>)=>{
  if(name==='dietforge_diet_notice_read'){reads++;return readFails?{data:null,error:new Error('offline')}:{data:{revision,pending:true},error:null};}
  assert.equal(name,'dietforge_diet_notice_seen');seen.push(String(args.v));return {data:seenResult,error:seenFails?new Error('not saved'):null};
 }) as unknown as typeof supabase.rpc;
 const {useDietNotice}=await import('../src/lib/use-diet-notice');
 const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root')!);
 let state:ReturnType<typeof useDietNotice>;
 function Harness(){state=useDietNotice('owner',1,true);return createElement('span',null,state.pending?'pending':'clear');}
 const refresh=async()=>{await act(async()=>{window.dispatchEvent(new dom.window.Event('focus'));});};
 try{
  await act(async()=>{root.render(createElement(Harness));});assert.equal(state!.pending,true);assert.equal(reads,1);
  seenFails=true;await act(async()=>{await state!.close();});assert.equal(state!.pending,true);assert.ok(state!.error);
  seenFails=false;await act(async()=>{await state!.close();});assert.equal(state!.pending,false);assert.equal(state!.error,'');
  await refresh();assert.equal(state!.pending,false,'stale revision cannot revive closed notice');
  revision='revision-b';await refresh();assert.equal(state!.pending,true,'new revision is visible');
  readFails=true;await refresh();assert.equal(state!.failed,true);assert.equal(state!.pending,true,'read failure preserves visible notice');
  readFails=false;await refresh();assert.equal(state!.failed,false);
  seenResult=false;revision='revision-c';const before=reads;
  await act(async()=>{await state!.close();});
  assert.ok(reads>before,'false seen result re-reads current revision');assert.equal(state!.pending,true,'changed revision remains pending');
  seenResult=true;await act(async()=>{await state!.close();});assert.equal(state!.pending,false);
  assert.deepEqual(seen,['revision-a','revision-a','revision-b','revision-c']);
 }finally{await act(async()=>root.unmount());supabase.rpc=originalRpc;await supabase.auth.stopAutoRefresh();for(const key of keys){const prior=originals.get(key);if(prior)Object.defineProperty(globalThis,key,prior);else Reflect.deleteProperty(globalThis,key);}dom.window.close();}
});
