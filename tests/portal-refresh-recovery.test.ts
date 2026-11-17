import assert from 'node:assert/strict';
import {test} from 'node:test';
import {startAutoRefresh} from '../src/lib/auto-refresh';
import {portalFailure,shouldRetryPortalRead} from '../src/lib/portal-errors';
import {firstTrainingWeek} from '../src/lib/training';
import type {TrainingProgram} from '../src/types';

/** A manual clock so the read lane can be driven without real timers. */
function lane(options:{read:()=>Promise<unknown>;apply?:(value:unknown)=>void;error?:(cause:unknown)=>void;active:()=>boolean}) {
 const scheduled:Array<{fn:()=>void;delay:number}>=[];
 const loop=startAutoRefresh<unknown>({
  read:options.read,
  apply:options.apply??(()=>{}),
  error:options.error??(()=>{}),
  shouldRetry:shouldRetryPortalRead,
  active:options.active,
  schedule:(fn,delay)=>{scheduled.push({fn,delay});return 0 as unknown as ReturnType<typeof setTimeout>;},
  cancel:()=>{},
 });
 return {loop,scheduled};
}

test('a paused lane reschedules itself instead of dying on a hidden tab',async()=>{
 let hidden=true;
 const {loop,scheduled}=lane({read:async()=>'nunca',active:()=>!hidden});
 await loop.refresh();
 assert.equal(scheduled.length,1,'while hidden the lane still schedules the next tick');
 assert.equal(scheduled[0].delay,5000);
 hidden=false;
 await loop.refresh();
 assert.equal(scheduled.length,2,'becoming visible reads again without a reload');
});

test('a validation error no longer stops automatic refresh for good',async()=>{
 let reads=0;
 let fail=true;
 const applied:string[]=[];
 const {loop,scheduled}=lane({
  read:async()=>{reads+=1;if(fail)throw portalFailure({code:'PGRST202'},400);return 'fresco';},
  apply:value=>applied.push(String(value)),
  active:()=>true,
 });
 await loop.refresh();
 assert.equal(reads,1);
 assert.deepEqual(applied,[],'the failing read does not paint');
 assert.equal(scheduled.length,1,'the lane keeps polling after a non-retryable failure');
 fail=false;
 scheduled[0].fn();
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(applied,['fresco'],'the next poll shows the coach change without a reload');
});

test('only a lost session or a denied expediente stop the lane',()=>{
 assert.equal(shouldRetryPortalRead({code:'PGRST202'}),true,'schema-cache/validation errors recover');
 assert.equal(shouldRetryPortalRead({code:'PGRST000'}),true,'transport errors recover');
 assert.equal(shouldRetryPortalRead(new Error('algo inesperado')),true,'unknown errors recover');
 assert.equal(shouldRetryPortalRead({status:401}),false,'a lost session stops polling');
 assert.equal(shouldRetryPortalRead({code:'42501'}),false,'a denied expediente stops polling');
});

test('a session error blocks the lane and reload restarts it',async()=>{
 let reads=0;
 const {loop,scheduled}=lane({
  read:async()=>{reads+=1;if(reads===1)throw {status:401};return 'ok';},
  active:()=>true,
 });
 await loop.refresh();
 assert.equal(scheduled.length,0,'a terminal error does not schedule more reads');
 await loop.refresh();
 assert.equal(reads,1,'manual refresh is a no-op while blocked');
 await loop.reload();
 assert.equal(reads,2,'reload clears the block and reads again');
});

const program=(duration:number,weeks:Record<string,unknown[]>):Pick<TrainingProgram,'days'|'week_days'|'duration_weeks'>=>({duration_weeks:duration,days:[],week_days:weeks as never});

test('the portal opens on the first week that has content',()=>{
 const day={id:'d',day_number:1,name:'Push',notes:'',exercises:[]};
 assert.equal(firstTrainingWeek(program(4,{'1':[day],'2':[day]})),1,'week 1 wins when it has days');
 assert.equal(firstTrainingWeek(program(4,{'2':[day],'3':[day]})),2,'a routine that starts later opens on its first real week');
 assert.equal(firstTrainingWeek(program(4,{})),1,'an empty routine falls back to week 1 instead of zero');
 assert.equal(firstTrainingWeek({duration_weeks:0,days:[],week_days:{}}),1,'a zero-week routine cannot produce week 0');
});
