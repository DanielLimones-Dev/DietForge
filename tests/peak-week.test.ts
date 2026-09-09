import assert from 'node:assert/strict';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
globalThis.WebSocket=new JSDOM('').window.WebSocket;
process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture-key';
const {peakDates,peakDays,dailyMacros,savePeakPlans}=await import('../src/lib/peak-week');
const {db}=await import('../src/lib/db');
import type {MealPlan,Competition,MacroResult} from '../src/types';
test('calendar includes show day across leap days, year boundaries and DST',()=>{
 assert.deepEqual(peakDates('2024-03-02'),['2024-02-25','2024-02-26','2024-02-27','2024-02-28','2024-02-29','2024-03-01','2024-03-02']);
 assert.equal(peakDates('2027-01-02')[0],'2026-12-27');
 assert.equal(new Set(peakDates('2026-03-10')).size,7);
 assert.deepEqual(peakDates('2026-02-30'),[]);
 assert.equal(peakDays('2026-09-07','{}').length,7);
 assert.equal(peakDays('2026-09-07','[null]')[6].date,'2026-09-07');
});
test('daily targets retain zero, use the same 4/4/9 calculation and reject invalid macros',()=>{
 const base={protein:150,carbs:250,fat:60};const d=peakDays('2026-09-07')[0];
 assert.deepEqual(dailyMacros({...d,protein:0,carbs:0,fat:0},base),{protein:0,carbs:0,fat:0,kcal:0});
 assert.equal(dailyMacros(d,base).kcal,2140);
 assert.throws(()=>dailyMacros({...d,protein:-1},base));
 assert.throws(()=>dailyMacros({...d,fat:Infinity},base));
});
test('updating a peak week reuses plan IDs and never deletes other competitions or food items',()=>{

 const storage:Pick<typeof db,'getMealPlans'|'getLatestMeasurement'|'saveMealPlan'|'updateMealPlan'|'updateCompetition'|'getCompetitions'>={getCompetitions:()=>[],getMealPlans:db.getMealPlans,getLatestMeasurement:db.getLatestMeasurement,saveMealPlan:db.saveMealPlan,updateMealPlan:db.updateMealPlan,updateCompetition:db.updateCompetition};
 const plans:MealPlan[]=[];let saves=0;let config='';
 const base:MacroResult={tmb:1000,tdee:2140,protein:150,carbs:250,fat:60,fiber:25,antioxidants:0};
 const comp={id:1,name:'Show A',date:'2026-09-07'} as Competition;
 try{
  storage.getMealPlans=()=>plans;storage.getLatestMeasurement=()=>undefined;
  storage.saveMealPlan=data=>{const p={...data,id:++saves};plans.push(p);return p;};
  storage.updateMealPlan=(id,data)=>{const p=plans.find(p=>p.id===id)!;Object.assign(p,data);return p;};
  storage.updateCompetition=(_id,data)=>{config=data.peak_week_config!;return {...comp,...data};};
  const days=peakDays(comp.date);savePeakPlans(1,comp,days,base,storage);
  const ids=plans.map(p=>p.id);days[6].carbs=0;savePeakPlans(1,comp,days,base,storage);
  assert.deepEqual(plans.map(p=>p.id),ids);assert.equal(plans[6].total_carbs,0);assert.equal(JSON.parse(config)[6].carbs,0);
  savePeakPlans(1,{...comp,id:2},days,base,storage);assert.equal(plans.length,14);assert.equal(saves,14);
 }finally{}
});
