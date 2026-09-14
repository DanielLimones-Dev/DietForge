import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {emptySnapshot, type Snapshot} from '../src/lib/cloud/model';

test('empty remote account ignores and preserves unowned legacy browser data',async()=>{
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';
 process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture-public-key';
 const dom=new JSDOM('',{url:'http://localhost'});
 const originalSocket=Object.getOwnPropertyDescriptor(globalThis,'WebSocket');
 Object.defineProperty(globalThis,'WebSocket',{configurable:true,value:dom.window.WebSocket});
 const originalStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:dom.window.localStorage});
 const legacy=emptySnapshot();legacy.database.clients=[{id:9,name:'Private previous owner',created_at:'2026-09-01',updated_at:'2026-09-01'}];
 const entries={'dietforge_db':JSON.stringify(legacy.database),'dietforge_db_backup':JSON.stringify(legacy.database),'dietforge_templates':'[]','rd_private':'previous-owner'};
 for(const [key,value] of Object.entries(entries))localStorage.setItem(key,value);
 const originalFetch=globalThis.fetch;
 const written:Snapshot[]=[];
 globalThis.fetch=async(input,init)=>{const request=new Request(input,init);const url=new URL(request.url);assert.equal(url.origin,'https://fixture.supabase.co');if(url.pathname.endsWith('dietforge_load'))return Response.json(null);if(url.pathname.endsWith('dietforge_save')){const body=await request.json();written.push(body.p_snapshot);return Response.json(1);}throw new Error(`Unexpected endpoint ${url.pathname}`);};
 const {supabase}=await import('../src/lib/supabase');
 const originalSession=supabase.auth.getSession;
 const owner='00000000-0000-4000-8000-000000000009';
 supabase.auth.getSession=(async()=>({data:{session:{user:{id:owner},access_token:'fixture'}},error:null})) as typeof supabase.auth.getSession;
 const {initializeCloud,disconnectCloud,db}=await import('../src/lib/db');
 try{
  await initializeCloud(owner);
  assert.deepEqual(db.getClients(),[]);
  assert.equal(written.length,1);
  assert.deepEqual(written[0],emptySnapshot());
  for(const [key,value] of Object.entries(entries))assert.equal(localStorage.getItem(key),value,`${key} remains untouched`);
 }finally{disconnectCloud();supabase.auth.getSession=originalSession;globalThis.fetch=originalFetch;if(originalStorage)Object.defineProperty(globalThis,'localStorage',originalStorage);else Reflect.deleteProperty(globalThis,'localStorage');if(originalSocket)Object.defineProperty(globalThis,'WebSocket',originalSocket);else Reflect.deleteProperty(globalThis,'WebSocket');dom.window.close();}
});
