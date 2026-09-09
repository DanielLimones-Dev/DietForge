import assert from 'node:assert/strict';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
import {emptySnapshot,readLegacy,validateSnapshot} from '../src/lib/cloud/model';
import {distributeMeals,macroKcal,calculateMacros} from '../src/lib/calculator';
import {generateProgressReportHTML} from '../src/lib/progressReport';
import {generateDietPDF} from '../src/lib/pdf';
import {normalizeNumericInput} from '../src/lib/numeric-input';
import {destinationForRole} from '../src/lib/auth-role';
import {saveMacroEvaluation} from '../src/lib/macro-evaluation';
import {isStorageAlert} from '../src/lib/cloud/engine';
import type {ClientMeasurement,MealPlan} from '../src/types';

test('numeric fields remove accidental leading zeros without changing decimals',()=>{
 assert.equal(normalizeNumericInput('050'),'50');
 assert.equal(normalizeNumericInput('000'),'0');
 assert.equal(normalizeNumericInput('00.5'),'0.5');
 assert.equal(normalizeNumericInput('-050'),'-50');
 assert.equal(normalizeNumericInput('0.50'),'0.50');
 assert.equal(normalizeNumericInput(''),'');
});

test('the unified login routes only from the server-backed role result',()=>{
 assert.equal(destinationForRole({data:true,error:null}),'/admin');
 assert.equal(destinationForRole({data:false,error:null}),'/');
 assert.equal(destinationForRole({data:null,error:null}),'/');
 assert.throws(()=>destinationForRole({data:null,error:{message:'unavailable'}}),/verificar el rol/);
});

test('macro evaluations persist without creating a check-in',()=>{
 const calls:ClientMeasurement[]=[];
 const measurement={id:7,client_id:1,date:'2026-09-09',weight:78,height:171,age:26,sex:'male',activity_level:'moderate',goal:'maintain',tmb:1700,tdee:2400,protein:170,carbs:280,fat:70,fiber:25,antioxidants:1} satisfies ClientMeasurement;
 const saved=saveMacroEvaluation(measurement,{saveMeasurement:data=>{const row={...data,id:7};calls.push(row);return row;}});
 assert.equal(calls.length,1);assert.equal(saved.weight,78);
});

test('successful cloud saves stay quiet while synchronization errors remain visible',()=>{
 assert.equal(isStorageAlert({phase:'ready',message:'Guardado en Supabase'}),false);
 assert.equal(isStorageAlert({phase:'saving',message:'Guardando en Supabase…'}),false);
 assert.equal(isStorageAlert({phase:'error',message:'No se pudo guardar'}),true);
});

test('meal distribution preserves 100 percent on rest and workout days',()=>{
 const macros=calculateMacros(80,180,30,'male','moderate','maintain');
 for(const workout of [true,false])for(const count of [1,3,6]){
  const meals=distributeMeals(macros,count,workout);
  assert.equal(meals.length,count+(workout?3:0));
  assert.equal(meals.reduce((s,m)=>s+m.percentage,0),100);
  const kcal=meals.reduce((s,m)=>s+macroKcal(m),0);
  assert.ok(Math.abs(kcal-macroKcal(macros))<=meals.length*9,'only integer-gram rounding may differ');
 }
});
test('legacy import recovers a valid backup and preserves both original keys',()=>{
 const dom=new JSDOM('',{url:'http://localhost'});const storage=dom.window.localStorage;
 const snapshot=emptySnapshot();snapshot.database.clients=[{id:1,name:'Cliente conservado',created_at:'2026-09-01',updated_at:'2026-09-01'}];
 storage.setItem('dietforge_db','{broken');storage.setItem('dietforge_db_backup',JSON.stringify(snapshot.database));
 assert.equal(readLegacy(storage)?.database.clients[0].name,'Cliente conservado');
 assert.equal(storage.getItem('dietforge_db'),'{broken');
 storage.setItem('dietforge_db_backup','invalid too');assert.throws(()=>readLegacy(storage));dom.window.close();
});
test('snapshot validation rejects duplicate IDs instead of losing records',()=>{
 const snapshot=emptySnapshot();const row={id:1,name:'Cliente',created_at:'2026-09-01',updated_at:'2026-09-01'};
 snapshot.database.clients=[row,row];assert.throws(()=>validateSnapshot(snapshot),/repetido/);
});
test('progress export treats names as text and accepts empty history',()=>{
 const html=generateProgressReportHTML({id:1,name:'<img src=x onerror=alert(1)> & coach',created_at:'2026-09-01',updated_at:'2026-09-01'},[],[]);
 assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/NaN|Infinity/);
 assert.match(html,/@page\{size:A4/);assert.match(html,/#177356/,'progress PDF uses the DietForge clinical palette');
});
test('progress export uses check-ins for weight history and ignores calculator evaluations',()=>{
 const measurement={id:1,client_id:1,date:'2026-09-09',weight:99,height:180,age:30,sex:'male',activity_level:'moderate',goal:'maintain',tmb:1800,tdee:2400,protein:140,carbs:300,fat:70,fiber:25,antioxidants:1} satisfies ClientMeasurement;
 const html=generateProgressReportHTML({id:1,name:'Coach',created_at:'',updated_at:''},[measurement],[{id:1,client_id:1,date:'2026-09-08',weight:78,body_fat:12}]);
 assert.match(html,/Peso Actual<\/div><div class="stat-value">78 kg/);
 assert.doesNotMatch(html,/>99 kg<\/td>/);
 assert.match(html,/Historial de Check-ins/);
});
test('empty diet PDF never contains NaN percentages',()=>{
 const measurement={id:1,client_id:1,date:'2026-09-01',weight:80,height:180,age:30,sex:'male',activity_level:'moderate',goal:'maintain',tmb:1800,tdee:2400,protein:140,carbs:300,fat:70,fiber:25,antioxidants:1} satisfies ClientMeasurement;
 const plan={id:1,client_id:1,measurement_id:1,date:'2026-09-01',name:'Plan vacío',total_kcal:0,total_protein:0,total_carbs:0,total_fat:0,total_fiber:0,total_antioxidants:0} satisfies MealPlan;
 const html=generateDietPDF({client:{id:1,name:'Coach',created_at:'2026-09-01',updated_at:'2026-09-01'},measurement,plan,items:[]});
 assert.doesNotMatch(html,/NaN|Infinity/);
 const portion=generateDietPDF({client:{id:1,name:'Coach',created_at:'2026-09-01',updated_at:'2026-09-01'},measurement,plan,items:[{id:1,meal_plan_id:1,meal_time:'meal1',food_id:1,quantity:30,serving_unit:'g',food:{id:1,name:'Proteína de prueba',category:'supplements',protein:80,carbs:10,fat:2,kcal:378,fiber:0,antioxidants:0,serving_size:30,serving_unit:'g',source:'manual'}}]});
 assert.match(portion,/24\.0g/);assert.match(portion,/3\.0g/);assert.match(portion,/0\.6g/);assert.doesNotMatch(portion,/>80g</);
 assert.match(portion,/@page\{size:A4/);assert.match(portion,/#177356/,'diet PDF uses the DietForge clinical palette');
 assert.doesNotMatch(portion,/margin:-11mm/,'print header stays inside the printable area');
 assert.match(portion,/@media print\{[^}]*body[\s\S]*?\.meal\{overflow:visible/,'long meals can continue on another printed page');
 const rendered=new JSDOM(portion);assert.equal(rendered.window.document.querySelectorAll('section.meal').length,1);assert.equal(rendered.window.document.querySelectorAll('section.meal table').length,1);rendered.window.close();
});
