'use client';
import Link from 'next/link';
import {flushSync} from 'react-dom';
import {Bell,CalendarDays,Check,ChevronRight,Dumbbell,LogOut,Moon,Salad,ShieldCheck,Sun,TrendingUp,UtensilsCrossed,X} from 'lucide-react';
import {foodRatio} from '@/lib/meal-day';
import type {Activity} from '@/lib/training-tracking';
import type {Food,MealPlan,MealPlanItem} from '@/types';

const mealNames:Record<string,string>={pre_workout:'Pre-Entreno',intra_workout:'Intra-Entreno',post_workout:'Post-Entreno',meal1:'Comida 1',meal2:'Comida 2',meal3:'Comida 3',meal4:'Comida 4',meal5:'Comida 5',meal6:'Comida 6'};

export type PortalTabKey='training'|'diet'|'progress'|'agenda';

export const portalTabs:{key:PortalTabKey;label:string;icon:typeof Salad}[]=[
 {key:'diet',label:'Dieta',icon:Salad},
 {key:'training',label:'Rutina',icon:Dumbbell},
 {key:'progress',label:'Progreso',icon:TrendingUp},
 {key:'agenda',label:'Agenda',icon:CalendarDays},
];

/** Sticky top bar shared by every portal screen: brand, quick actions and session exit. */
export function PortalTopBar({dark,onDark,signedIn,onLogout,signingOut,context}:{dark:boolean;onDark:()=>void;signedIn:boolean;onLogout?:()=>void;signingOut?:boolean;context?:string}){
 return <header className="portal-topbar">
  <div className="portal-topbar-brand">
   <span className="portal-topbar-logo" aria-hidden="true"><UtensilsCrossed size={18}/></span>
   <span className="portal-topbar-name">DietForge<small>Portal del cliente</small></span>
   {context&&<span className="portal-topbar-context">{context}</span>}
  </div>
  <div className="portal-topbar-actions">
   <Link href="/privacidad" target="_blank" rel="noopener noreferrer" className="portal-icon-button" aria-label="Aviso de privacidad" title="Aviso de privacidad"><ShieldCheck size={18}/><span className="portal-icon-label">Aviso de privacidad</span></Link>
   <button type="button" className="portal-icon-button" onClick={onDark} aria-label={dark?'Cambiar a modo claro':'Cambiar a modo oscuro'}>{dark?<Sun size={18}/>:<Moon size={18}/>}<span className="portal-icon-label">{dark?'Modo claro':'Modo oscuro'}</span></button>
   {signedIn&&onLogout&&<button type="button" className="portal-icon-button portal-icon-button-exit" disabled={signingOut} onClick={onLogout} aria-label="Cerrar sesión"><LogOut size={18}/><span className="portal-icon-label">{signingOut?'Saliendo…':'Salir'}</span></button>}
  </div>
 </header>;
}

/** Primary navigation: four large, labelled targets. No nested menus. */
export function PortalTabs({tab,onChange,dietPending,animate=false}:{tab:string;onChange:(tab:PortalTabKey)=>void;dietPending?:boolean;animate?:boolean}){
 const reveal=(key:string)=>{const node=document.querySelector<HTMLElement>(`[data-portal-tab="${key}"]`);node?.scrollIntoView({block:'nearest',inline:'nearest'});};
 const select=(key:PortalTabKey)=>{
  if(key===tab)return;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // A same-document view transition morphs the panel; unsupported browsers swap instantly.
  if(!animate||reduced||typeof document.startViewTransition!=='function'){onChange(key);requestAnimationFrame(()=>reveal(key));return;}
  const transition=document.startViewTransition(()=>flushSync(()=>onChange(key)));
  // Rapid re-taps on the same document reject `ready`; swallow it instead of logging an error.
  transition.ready.catch(()=>{});
  transition.finished.finally(()=>reveal(key));
 };
 return <nav className="care-tabs portal-tabs" aria-label="Secciones de mi portal">{portalTabs.map(item=><button key={item.key} type="button" data-portal-tab={item.key} id={`portal-tab-${item.key}`} aria-current={tab===item.key?'page':undefined} className={tab===item.key?'selected':''} onClick={()=>select(item.key)}><item.icon size={18} aria-hidden="true"/><span className="portal-tab-label">{item.label}</span>{item.key==='diet'&&dietPending&&<span className="care-tab-badge" aria-label="Ajuste de dieta sin leer"><Bell size={12}/><span>Nuevo</span></span>}</button>)}</nav>;
}

export function PortalEmpty({icon:Icon=Salad,title,description,action}:{icon?:typeof Salad;title:string;description:string;action?:{label:string;onClick:()=>void}}){
 return <div className="portal-empty"><span className="portal-empty-icon" aria-hidden="true"><Icon size={26}/></span><h3>{title}</h3><p>{description}</p>{action&&<button type="button" className="portal-button" onClick={action.onClick}>{action.label}<ChevronRight size={16}/></button>}</div>;
}

export type DietNoticeState={pending:boolean;error:string;failed:boolean;closing:boolean;close:()=>void};

function MealCard({name,mealItems,foods,done,busy,onToggle}:{name:string;mealItems:MealPlanItem[];foods:Food[];done:boolean;busy:boolean;onToggle:()=>void}){
 const kcal=Math.round(mealItems.reduce((total,item)=>{const food=foods.find(f=>f.id===item.food_id);return total+(food?food.kcal*foodRatio(item.quantity,item.serving_unit,food.serving_size):0);},0));
 return <article className="portal-meal" data-done={done||undefined}>
  <header><div><h4>{name}</h4>{kcal>0&&<span>{kcal} kcal</span>}</div>{done&&<span className="portal-meal-check" aria-hidden="true"><Check size={13} strokeWidth={3}/></span>}</header>
  <ul>{mealItems.map(item=>{const food=foods.find(f=>f.id===item.food_id);return <li key={item.id}><span><strong>{food?.name??'Alimento'}</strong><small>{item.quantity} {item.serving_unit}</small></span>{food&&<em>{Math.round(food.kcal*foodRatio(item.quantity,item.serving_unit,food.serving_size))} kcal</em>}</li>;})}</ul>
  <button type="button" className={done?'portal-meal-button is-done':'portal-meal-button'} aria-pressed={done} disabled={busy} onClick={onToggle}>{done?<><Check size={16}/> Comida completada</>:<>Marcar como completada</>}</button>
 </article>;
}

/** One plan, split by normal day and Rest Day, with a readable completion state per meal. */
export function PortalDietCard({plans,items,foods,activity,date,onDate,busy,onMeal,notice}:{
 plans:MealPlan[];items:MealPlanItem[];foods:Food[];activity:Activity[];date:string;
 onDate:(date:string)=>void;busy:boolean;onMeal:(plan:number,mealTime:string,rest:boolean,complete:boolean)=>Promise<void>;
 notice:DietNoticeState;
}){
 return <section className="care-card care-diet portal-section">
  <header className="portal-section-head">
   <div><span className="portal-kicker">Mi alimentación</span><h2>Lo que toca hoy</h2><p>Marca cada comida cuando la termines. Tu coach ve tu avance en tiempo real.</p></div>
   <label className="portal-date">Fecha<input type="date" value={date} onChange={e=>onDate(e.target.value)}/></label>
  </header>
  {notice.pending&&<div className="care-diet-notice" role="status"><Bell size={20}/><div><strong>Tu coach ajustó tu alimentación</strong><p>Revisa las comidas y cantidades actualizadas antes de continuar con tu plan.</p>{notice.error&&<p role="alert">{notice.error}</p>}</div><button type="button" aria-label="Cerrar aviso de ajuste" disabled={notice.closing} onClick={notice.close}><X size={18}/></button></div>}
  {notice.failed&&<p role="status">No pudimos consultar los avisos de ajustes. Reintentando automáticamente.</p>}
  {!plans.length&&<PortalEmpty icon={UtensilsCrossed} title="Aún no tienes una dieta asignada" description="Tu coach publicará aquí tu plan con sus comidas y cantidades. Si esperabas verlo, escríbele por tu canal habitual."/>}
  {plans.map(plan=><details key={plan.id} className="portal-plan" open><summary><div><h3>{plan.name}</h3><p>{plan.total_kcal} kcal · {plan.total_protein} g proteína · {plan.total_carbs} g carbohidratos · {plan.total_fat} g grasa</p></div><ChevronRight className="portal-plan-chevron" size={20} aria-hidden="true"/></summary>
   <div className="care-diet-columns">{(['normal','rest'] as const).map(type=>{const dayItems=items.filter(i=>i.meal_plan_id===plan.id&&(i.day_type??'normal')===type);if(!dayItems.length)return null;
    const times=[...new Set(dayItems.map(i=>i.meal_time))];
    const completed=times.filter(time=>activity.some(a=>a.kind==='meal'&&a.data.plan_id===plan.id&&a.data.meal_time===time&&a.data.date===date&&a.data.rest===(type==='rest')&&a.data.completed)).length;
    return <div key={type} className={`care-diet-column care-diet-column-${type}`}>
     <header>{type==='rest'?<Moon size={18} aria-hidden="true"/>:<Sun size={18} aria-hidden="true"/>}<div><h3>{type==='rest'?'Rest Day':'Plan Normal'}</h3><span>{type==='rest'?'Día de descanso':'Día de entrenamiento'}</span></div><small>{completed}/{times.length}</small></header>
     <div className="portal-meal-progress" role="img" aria-label={`${completed} de ${times.length} comidas completadas`}><span style={{width:`${times.length?Math.round((completed/times.length)*100):0}%`}}/></div>
     {times.map(time=>{const done=activity.some(a=>a.kind==='meal'&&a.data.plan_id===plan.id&&a.data.meal_time===time&&a.data.date===date&&a.data.rest===(type==='rest')&&a.data.completed);
      return <MealCard key={time} name={mealNames[time]??time.replace(/_/g,' ')} mealItems={dayItems.filter(i=>i.meal_time===time)} foods={foods} done={done} busy={busy} onToggle={()=>void onMeal(plan.id,time,type==='rest',!done)}/>;})}
    </div>;})}</div>
  </details>)}
 </section>;
}

/** Coach-only: a draft routine is invisible to the client until it is published. */
export function PortalPublishDrafts({programs,busy,onPublish,clientId}:{programs:{id:number;name:string;duration_weeks:number;status:string}[];busy:boolean;onPublish:(id:number)=>void;clientId:number}){
 const drafts=programs.filter(program=>program.status!=='active');
 if(!drafts.length)return null;
 return <section className="care-card portal-section portal-publish">
  <header className="portal-section-head"><div><span className="portal-kicker">Rutina en borrador</span><h2>El cliente todavía no la ve</h2><p>El portal muestra solo rutinas activas. Publica el borrador cuando esté listo; no cambia días, ejercicios ni prescripciones.</p></div></header>
  <ul className="portal-drafts">{drafts.map(program=><li key={program.id}><span><strong>{program.name}</strong><small>{program.duration_weeks} semanas · Borrador</small></span><button type="button" className="portal-button portal-button-primary" disabled={busy} onClick={()=>onPublish(program.id)}>Publicar para el cliente</button></li>)}</ul>
  <p className="portal-access-note">Si falta contenido, <Link href={`/clients/${clientId}/training`}>edita la rutina</Link> antes de publicarla.</p>
 </section>;
}
