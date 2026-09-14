import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CareAgenda} from '../src/components/CareAgenda';
import {trainingDateValue} from '../src/lib/training';
import type {PortalData} from '../src/lib/client-portal';

test('agenda limits events and monthly counts to Peak Week and check-ins without mutating activity',()=>{
 const date=trainingDateValue();
 const data={client:{id:1,name:'Ejemplo',next_check_in_date:date},trainingPrograms:[{id:1,name:'Rutina excluida',status:'active',duration_weeks:1,start_date:date,days:[{id:'day1',name:'Día oculto',exercises:[{id:'e1'}]}]}],mealPlans:[{id:1,name:'Dieta excluida',date},{id:2,name:'Peak Week visible',date,peak_week_date:date}],mealPlanItems:[],weekPlans:[{id:1,name:'Semana excluida',start_date:date,day_plans:[{day:0,meal_plan_id:1}]}],activity:[{id:'reminder',kind:'event',data:{date,title:'Recordatorio excluido',completed:false}}],foods:[],measurements:[]} as unknown as PortalData;
 const before=structuredClone(data);
 const html=renderToStaticMarkup(createElement(CareAgenda,{owner:'fixture',data,coach:true,onSaved:()=>{}}));
 assert.match(html,/Peak Week visible/);assert.match(html,/Revisión de progreso/);
 for(const hidden of ['Rutina excluida','Dieta excluida','Semana excluida','Recordatorio excluido','Añadir recordatorio','Qué debes recordar','Entrenamiento','Alimentación'])assert.ok(!html.includes(hidden),`${hidden} must not be in the agenda`);
 assert.match(html,/<strong>2<\/strong><span>Pendientes<\/span>/);
 assert.deepEqual(data,before,'legacy reminders and planning data remain untouched');
});
