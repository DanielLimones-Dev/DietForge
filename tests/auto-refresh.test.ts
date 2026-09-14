import test from 'node:test';
import assert from 'node:assert/strict';
import {startAutoRefresh} from '../src/lib/auto-refresh';

function deferred<T>() {
 let resolve!:(value:T)=>void;
 let reject!:(error:Error)=>void;
 const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
}
function scheduler() {
 let next=0;
 const pending=new Map<ReturnType<typeof setTimeout>,{fn:()=>void;delay:number}>();
 return {
  pending,
  schedule(fn:()=>void,delay:number){const id=++next as unknown as ReturnType<typeof setTimeout>;pending.set(id,{fn,delay});return id;},
  cancel(id:ReturnType<typeof setTimeout>){pending.delete(id);},
  fire(){const first=pending.entries().next().value;assert.ok(first,'Expected a pending refresh');pending.delete(first[0]);first[1].fn();},
  delays(){return Array.from(pending.values(),v=>v.delay);},
 };
}

test('auto refresh serializes overlapping reads and replaces its pending timer',async()=>{
 const clock=scheduler(), response=deferred<number>(), applied:number[]=[];
 let reads=0;
 const control=startAutoRefresh({read:()=>{reads++;return response.promise;},apply:v=>applied.push(v),error:()=>assert.fail('Unexpected error'),active:()=>true,...clock});
 const first=control.refresh();await control.refresh();await control.refresh();
 assert.equal(reads,1);assert.equal(clock.pending.size,0);
 response.resolve(42);await first;
 assert.deepEqual(applied,[42]);assert.deepEqual(clock.delays(),[5000]);
 await control.refresh();assert.equal(reads,2);assert.equal(clock.pending.size,1);
 control.stop();assert.equal(clock.pending.size,0);
});

for(const fails of [false,true])test(`auto refresh suppresses late ${fails?'failure':'success'} after stop`,async()=>{
 const clock=scheduler(), response=deferred<number>();let reads=0,applies=0,errors=0;
 const control=startAutoRefresh({read:()=>{reads++;return response.promise;},apply:()=>{applies++;},error:()=>{errors++;},active:()=>true,...clock});
 const pending=control.refresh();control.stop();
 if(fails)response.reject(new Error('Late network error'));else response.resolve(7);
 await pending;await control.refresh();
 assert.equal(reads,1);assert.equal(applies,0);assert.equal(errors,0);assert.equal(clock.pending.size,0);
});

test('auto refresh backs off failures, caps delay, and resets on success',async()=>{
 const clock=scheduler();let fail=true,errors=0,applies=0;
 const control=startAutoRefresh({read:async()=>{if(fail)throw new Error('Offline');return 1;},apply:()=>{applies++;},error:()=>{errors++;},active:()=>true,...clock});
 for(const delay of [10000,20000,40000,60000,60000]){await control.refresh();assert.deepEqual(clock.delays(),[delay]);}
 assert.equal(errors,5);fail=false;await control.refresh();assert.equal(applies,1);assert.deepEqual(clock.delays(),[5000]);
 fail=true;await control.refresh();assert.deepEqual(clock.delays(),[10000]);control.stop();
});

test('auto refresh does not read while hidden and resumes on explicit visibility refresh',async()=>{
 const clock=scheduler();let active=false,reads=0;
 const control=startAutoRefresh({read:async()=>++reads,apply:()=>{},error:()=>assert.fail('Unexpected error'),active:()=>active,...clock});
 await control.refresh();assert.equal(reads,0);assert.equal(clock.pending.size,0);
 active=true;await control.refresh();assert.equal(reads,1);assert.deepEqual(clock.delays(),[5000]);
 active=false;clock.fire();assert.equal(reads,1);assert.equal(clock.pending.size,0);
 active=true;await control.refresh();assert.equal(reads,2);assert.deepEqual(clock.delays(),[5000]);control.stop();
});
