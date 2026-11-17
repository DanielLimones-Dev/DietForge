'use client';

import {useState} from 'react';
import {CalendarDays,Salad,TrendingUp} from 'lucide-react';
import {PortalDietCard,PortalPublishDrafts,PortalTabs,PortalTopBar,type DietNoticeState,type PortalTabKey} from '@/components/portal/PortalParts';
import {PortalMesocycle} from '@/components/PortalMesocycle';
import {PortalCheckIn} from '@/components/PortalCheckIn';
import {CareAgenda} from '@/components/CareAgenda';
import {SessionTracker} from '@/components/SessionTracker';
import type {PortalData} from '@/lib/client-portal';
import type {Activity} from '@/lib/training-tracking';
import type {Food,MealPlan,MealPlanItem,TrainingProgram} from '@/types';

const day=(offset:number)=>`2026-11-${String(16+offset).padStart(2,'0')}`;

const plans:MealPlan[]=[
 {id:1,client_id:1,measurement_id:null,date:day(-6),name:'Plan de definición',total_kcal:1980,total_protein:165,total_carbs:180,total_fat:58,total_fiber:32,total_antioxidants:1200},
 {id:2,client_id:1,measurement_id:null,date:day(-30),name:'Plan de mantenimiento',total_kcal:2450,total_protein:170,total_carbs:270,total_fat:70,total_fiber:35,total_antioxidants:1300},
];

const foods:Food[]=[
 {id:1,name:'Pechuga de pollo',category:'protein',protein:31,carbs:0,fat:3.6,fiber:0,antioxidants:0,kcal:165,serving_size:100,serving_unit:'g',source:'manual'},
 {id:2,name:'Arroz blanco cocido',category:'carbs',protein:2.7,carbs:28,fat:0.3,fiber:0.4,antioxidants:0,kcal:130,serving_size:100,serving_unit:'g',source:'manual'},
 {id:3,name:'Aguacate',category:'fats',protein:2,carbs:9,fat:15,fiber:7,antioxidants:400,kcal:160,serving_size:100,serving_unit:'g',source:'manual'},
 {id:4,name:'Brócoli',category:'vegetables',protein:2.8,carbs:7,fat:0.4,fiber:2.6,antioxidants:900,kcal:34,serving_size:100,serving_unit:'g',source:'manual'},
];

const item=(id:number,meal_time:MealPlanItem['meal_time'],food_id:number,quantity:number,dayType:'normal'|'rest'='normal'):MealPlanItem=>({id,meal_plan_id:1,meal_time,food_id,quantity,serving_unit:'g',day_type:dayType});

const items:MealPlanItem[]=[
 item(1,'meal1',1,180),item(2,'meal1',2,160),item(3,'meal1',4,120),
 item(4,'meal2',1,150),item(5,'meal2',3,60),item(6,'meal2',4,150),
 item(7,'meal3',1,170),item(8,'meal3',2,120),item(9,'meal3',3,40),
 item(10,'meal1',1,180,'rest'),item(11,'meal1',3,70,'rest'),item(12,'meal1',4,160,'rest'),
 item(13,'meal2',1,160,'rest'),item(14,'meal2',4,200,'rest'),
];

const activity:Activity[]=[
 {id:'a1',kind:'meal',data:{date:day(0),plan_id:1,meal_time:'meal1',rest:false,completed:true}},
 {id:'a2',kind:'checkin',data:{date:day(-2),weight:64.2,body_fat:22.4,measurements:{waist:72,hip:96},adherence:{diet:90,training:85},notes:'Buena semana, algo de hambre por la tarde.'}},
 {id:'a3',kind:'checkin',data:{date:day(-9),weight:65.1,body_fat:23.1,measurements:{waist:73.5,hip:97},adherence:{diet:80,training:75},notes:'Viaje corto el fin de semana.'}},
 {id:'a4',kind:'appointment',data:{date:day(3),time:'10:30',note:'Revisión de medidas',status:'confirmed'}},
 {id:'a5',kind:'appointment',data:{date:day(8),time:'17:00',note:'Ajuste de macros',status:'requested'}},
];

const weeks=(sets:number,repsMin:number,repsMax:number,rirEnd:number)=>Array.from({length:4},(_,index)=>({week:index+1,sets:sets+(index>1?1:0),reps_min:repsMin,reps_max:repsMax,rir_start:rirEnd+1,rir_end:rirEnd}));

const programs:TrainingProgram[]=[{
 id:1,client_id:1,name:'Mesociclo de hipertrofia',objective:'hypertrophy',start_date:'2026-09-19',duration_weeks:4,
 mesocycle_number:2,rotation_number:1,priorities:['Pectoral','Espalda'],split:'Push · Pull · Legs',
 notes:'Controla la técnica y registra cada serie antes de avanzar.',status:'active',created_at:'2026-09-19',updated_at:'2026-09-19',
 days:[
  {id:'push',day_number:1,name:'Push',notes:'Pectoral y tríceps',exercises:[
   {id:'press',name:'Press inclinado con mancuernas',muscle_group:'Pectoral',prescriptions:weeks(3,8,12,1)},
   {id:'lateral',name:'Elevación lateral',muscle_group:'Deltoides',prescriptions:weeks(3,12,15,1)},
  ]},
  {id:'pull',day_number:2,name:'Pull',notes:'Espalda y bíceps',exercises:[
   {id:'row',name:'Remo en máquina',muscle_group:'Espalda',prescriptions:weeks(4,8,12,1)},
  ]},
 ],review:{session_fatigue:[0,0,0,0]},
}];

const data:PortalData={
 client:{id:1,name:'María Fernanda López',next_check_in_date:day(4)},
 trainingPrograms:programs,mealPlans:plans,mealPlanItems:items,foods,
 measurements:[{id:1,client_id:1,date:day(-6),weight:64.2,height:168,age:29,sex:'female',body_fat:22.4,activity_level:'moderate',goal:'lose_fat',tmb:1380,tdee:2050,protein:165,carbs:180,fat:58,fiber:32,antioxidants:1200}],
 weekPlans:[],activity,
};

const notice:DietNoticeState={pending:true,error:'',failed:false,closing:false,close:()=>{}};

const facts=[
 {key:'diet' as const,icon:Salad,label:'Dieta de hoy',value:'1 comida marcada'},
 {key:'progress' as const,icon:TrendingUp,label:'Último check-in',value:day(-2)},
 {key:'agenda' as const,icon:CalendarDays,label:'Próxima cita',value:`${day(3)} · 10:30`},
];

export function PortalPreview({coach=false,initialDark=false}:{coach?:boolean;initialDark?:boolean}){
 const [tab,setTab]=useState<PortalTabKey>('diet');
 const [date,setDate]=useState(day(0));
 const [dark,setDark]=useState(initialDark);
 return <div className={dark?'dark':''}><div className="care-portal portal-app">
  <PortalTopBar dark={dark} onDark={()=>setDark(!dark)} signedIn onLogout={()=>{}}/>
  <div className={`care-page portal-page${coach?' is-coach':''}`}>
   <header className="care-card portal-hero">
    <div className="portal-hero-copy">
     <span className="portal-kicker">{coach?'Seguimiento del cliente':'Mi espacio'}</span>
     <h1>{data.client.name}</h1>
     <p>{coach?'Dieta, entrenamiento, progreso y agenda del cliente en un solo lugar.':'Tu dieta, tu rutina y tu progreso. Marca tus comidas y envía tu check-in cuando quieras.'}</p>
     <div role="status" className="care-sync-status">Todo actualizado hace un momento</div>
    </div>
    {!coach&&<div className="portal-facts">{facts.map(fact=><button type="button" key={fact.label} className="portal-fact" onClick={()=>setTab(fact.key)}><span className="portal-fact-icon" aria-hidden="true"><fact.icon size={17}/></span><span className="portal-fact-copy"><small>{fact.label}</small><strong>{fact.value}</strong></span></button>)}</div>}
   </header>
   <PortalTabs tab={tab} onChange={setTab} dietPending animate={!coach}/>
   {tab==='diet'&&<div className="portal-panel" id="portal-panel-diet" aria-labelledby="portal-tab-diet" tabIndex={-1}><PortalDietCard plans={data.mealPlans} items={data.mealPlanItems} foods={data.foods} activity={data.activity} date={date} onDate={setDate} busy={false} onMeal={async()=>{}} notice={notice}/></div>}
   {tab==='training'&&<div className="portal-panel" id="portal-panel-training" aria-labelledby="portal-tab-training" tabIndex={-1}><PortalMesocycle programs={data.trainingPrograms} coach={coach}/>{coach&&<PortalPublishDrafts programs={[{...programs[0],status:'draft'}]} busy={false} onPublish={()=>{}} clientId={1}/>}<SessionTracker owner="demo" clientId={1} programs={data.trainingPrograms} activity={data.activity} onSaved={()=>{}} clientMode={!coach}/></div>}
   {tab==='progress'&&<div className="care-tab-panel portal-panel" id="portal-panel-progress" aria-labelledby="portal-tab-progress" tabIndex={-1}><PortalCheckIn owner="demo" clientId={1} activity={data.activity} onSaved={()=>{}}/><section className="care-card portal-section"><header className="portal-section-head"><div><span className="portal-kicker">Historial</span><h2>Evaluaciones del coach</h2><p>Peso y composición registrados en cada evaluación.</p></div></header><div className="care-table-wrap"><table><thead><tr><th>Fecha</th><th>Peso</th><th>Grasa corporal</th></tr></thead><tbody>{data.measurements.map(m=><tr key={m.id}><td>{m.date}</td><td>{m.weight} kg</td><td>{m.body_fat}%</td></tr>)}</tbody></table></div></section></div>}
   {tab==='agenda'&&<div className="portal-panel" id="portal-panel-agenda" aria-labelledby="portal-tab-agenda" tabIndex={-1}><CareAgenda data={data} coach={coach} onSaved={()=>{}} onSave={async()=>{}}/></div>}
  </div>
 </div></div>;
}
