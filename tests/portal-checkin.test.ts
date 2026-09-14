import test from 'node:test';
import assert from 'node:assert/strict';
import type {PortalCheckInDraft} from '../src/lib/portal-checkin';
import {emptyPortalCheckIn, validatePortalCheckIn} from '../src/lib/portal-checkin';

test('checkin never serializes body fat and omits optional empty answers',()=>{
 const draft={...emptyPortalCheckIn(),date:'2026-09-14',weight:'72',body_fat:'0'};
 const {data,errors}=validatePortalCheckIn(draft);
 assert.deepEqual(errors,[]);assert.equal(Object.prototype.hasOwnProperty.call(data,'body_fat'),false);assert.equal(data?.adherence,undefined);assert.equal(data?.measurements,undefined);
});
test('checkin rejects invalid dates, cleared weight and optional numbers out of bounds',()=>{
 for(const patch of ([{date:'2026-02-30'},{weight:''},{weight:'Infinity'},{measurements:{waist:'301'}},{measurements:{waist:'0'}},{adherence:{energy:'0'}},{adherence:{sleep:'1.5'}},{adherence:{meals:'101'}}] as Partial<PortalCheckInDraft>[])){
  const result=validatePortalCheckIn({...emptyPortalCheckIn(),date:'2026-09-14',weight:'72',...patch});assert.equal(result.data,null);assert.ok(result.errors.length);
 }
});
test('checkin stores partial adherence and measurements without filling missing responses',()=>{
 const {data}=validatePortalCheckIn({...emptyPortalCheckIn(),weight:'72.5',measurements:{waist:'83.5',neck:''},adherence:{meals:'0',sleep:'4'}});
 assert.deepEqual(data?.measurements,{waist:83.5});assert.deepEqual(data?.adherence,{meals:0,sleep:4});
});
test('checkin rejects duplicate photo angles and oversized notes',()=>{
 const draft={...emptyPortalCheckIn(),weight:'72'};
 assert.equal(validatePortalCheckIn({...draft,notes:'x'.repeat(5001)}).data,null);
 assert.equal(validatePortalCheckIn({...draft,photos:[{angle:'front_relaxed',path:'a'},{angle:'front_relaxed',path:'b'}]}).data,null);
});
