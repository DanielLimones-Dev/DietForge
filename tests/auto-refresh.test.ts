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

test('reload after saving discards the in-flight response and queues one fresh read',async()=>{
 const clock=scheduler(), old=deferred<number>(), fresh=deferred<number>(), applied:number[]=[];
 let reads=0;
 const control=startAutoRefresh({read:()=>++reads===1?old.promise:fresh.promise,apply:v=>applied.push(v),error:()=>assert.fail('Unexpected error'),active:()=>true,...clock});
 const initial=control.refresh();
 const saved=control.reload();
 const savedAgain=control.reload();
 assert.equal(reads,1);
 old.resolve(1);await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(applied,[]);assert.equal(reads,2);
 fresh.resolve(2);await Promise.all([initial,saved,savedAgain]);
 assert.deepEqual(applied,[2]);assert.deepEqual(clock.delays(),[5000]);control.stop();
});

test('non-retryable errors pause automatic reads until an explicit reload',async()=>{
 const clock=scheduler();let reads=0;const problem={code:'42501'};const seen:unknown[]=[];
 const control=startAutoRefresh({read:async()=>{if(++reads===1)throw problem;return 2;},apply:()=>{},error:e=>seen.push(e),shouldRetry:()=>false,active:()=>true,...clock});
 await control.refresh();assert.deepEqual(seen,[problem]);assert.equal(clock.pending.size,0);
 await control.refresh();assert.equal(reads,1);
 await control.reload();assert.equal(reads,2);assert.deepEqual(clock.delays(),[5000]);control.stop();
});

test('stopping a queued reload suppresses both the old response and the queued read',async()=>{
 const clock=scheduler(), response=deferred<number>();let reads=0;
 const control=startAutoRefresh({read:()=>{reads++;return response.promise;},apply:()=>assert.fail('Late result'),error:()=>assert.fail('Late error'),active:()=>true,...clock});
 const initial=control.refresh();const saved=control.reload();control.stop();response.resolve(1);
 await Promise.all([initial,saved]);assert.equal(reads,1);assert.equal(clock.pending.size,0);
});

test('a queued reload while hidden waits for visibility and never applies the invalidated result',async()=>{
 const clock=scheduler(), old=deferred<number>(), applied:number[]=[];let active=true,reads=0;
 const control=startAutoRefresh({read:()=>++reads===1?old.promise:Promise.resolve(2),apply:v=>applied.push(v),error:()=>assert.fail('Unexpected error'),active:()=>active,...clock});
 const initial=control.refresh();const queued=control.reload();active=false;old.resolve(1);
 await Promise.all([initial,queued]);assert.deepEqual(applied,[]);assert.equal(reads,1);
 clock.fire();assert.equal(clock.pending.size,0);
 active=true;await control.refresh();assert.deepEqual(applied,[2]);assert.equal(reads,2);control.stop();
});
