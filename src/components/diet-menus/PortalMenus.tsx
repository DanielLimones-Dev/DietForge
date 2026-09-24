'use client';
import {useCallback,useState,useRef} from 'react';
import {Check,Utensils} from 'lucide-react';
import {readPortalMenus,saveMenuDay} from '@/lib/portal-menus';
import {usePortalSync} from '@/lib/use-portal-sync';
import {trainingDateValue} from '@/lib/training';
import {menuTotals} from '@/lib/diet-menus';
import {EntrySummary,NutritionLine} from './shared';
export function PortalMenus({owner,clientId,coach=false}:{owner:string;clientId:number;coach?:boolean}){
 const read=useCallback(()=>readPortalMenus(owner,clientId),[owner,clientId]);
 const sync=usePortalSync(read);const [date,setDate]=useState(trainingDateValue());const [preview,setPreview]=useState<number|null>(null);const [busy,setBusy]=useState(false);const lock=useRef(false);const [message,setMessage]=useState('');
 const menus=sync.data?.menus??[];const day=sync.data?.days.find(d=>d.date===date);const selected=menus.find(m=>m.id===(preview??day?.menu_id))??menus[0];
 const completed=day?.menu_id===selected?.id?day.completed_meals:[];
 async function save(menuId:number,done:string[]){if(lock.current)return;lock.current=true;setBusy(true);setMessage('');try{await saveMenuDay(owner,clientId,date,menuId,done);setPreview(menuId);await sync.reload();}catch(e){setMessage(e instanceof Error?e.message:'No se pudo guardar. Inténtalo de nuevo.');}finally{lock.current=false;setBusy(false);}}
 function choose(menuId:number){if(busy)return;if(coach){setPreview(menuId);return;}if(day&&day.menu_id!==menuId&&day.completed_meals.length&&!window.confirm('Ya registraste comidas de otro menú hoy. ¿Cambiar de menú? El registro anterior se conservará en el historial y este menú comenzará sin comidas completadas.'))return;void save(menuId,day?.menu_id===menuId?day.completed_meals:[]);}
 function complete(id:string){if(!selected)return;if(day&&day.menu_id!==selected.id&&day.completed_meals.length&&!window.confirm('¿Cambiar el menú de este día y empezar un registro nuevo?'))return;
  if(day&&day.menu_id!==selected.id){void save(selected.id,[]);return;}
  void save(selected.id,completed.includes(id)?completed.filter(x=>x!==id):[...completed,id]);
 }
 return <section className="dm-workspace" aria-label="Mis menús asignados"><header className="dm-heading"><div><span className="dm-eyebrow">VARIEDAD CADA DÍA</span><h2>Mis menús</h2><p>{coach?'Vista de los menús asignados al cliente.':'Elige una de las alternativas que preparó tu nutriólogo para hoy.'}</p></div><label className="dm-portal-date">Fecha<input type="date" value={date} disabled={busy} onChange={e=>{if(e.target.value){setDate(e.target.value);setPreview(null);setMessage('');}}}/></label></header>
 {sync.needsAttention&&<div role="status" className="dm-message">{sync.message}<button className="dm-text-button" disabled={busy} onClick={()=>void sync.reload()}>Reintentar</button></div>}{message&&<p role="alert" className="dm-error">{message}</p>}
 {!sync.data&&!sync.error&&!sync.offline&&<p role="status">Cargando menús…</p>}
 {sync.data&&!menus.length&&<div className="dm-empty"><Utensils size={28}/><h3>Aún no tienes menús asignados</h3><p>Tu plan de alimentación habitual sigue disponible en su pestaña.</p></div>}
 {!!menus.length&&selected&&<><div className="dm-portal-menus" aria-label="Elegir menú del día">{menus.map(menu=><button key={menu.id} aria-pressed={selected.id===menu.id} disabled={busy} onClick={()=>choose(menu.id)}>{menu.name}</button>)}</div><div className="dm-totals"><span>{day?.menu_id===selected.id?'Menú elegido':'Vista previa'} · {selected.name}</span><NutritionLine totals={menuTotals(selected)}/></div><div className="dm-meals">{selected.meals.map(meal=><article className="dm-meal" key={meal.id}><header><Utensils size={16}/><h4>{meal.name}</h4>{completed.includes(meal.id)&&<Check size={18}/>}</header><div className="dm-entries">{meal.items.map(item=><div className="dm-entry" key={item.id}><EntrySummary entry={item}/></div>)}</div><footer>{!coach&&<button className={completed.includes(meal.id)?'dm-secondary':'dm-primary'} disabled={busy} aria-pressed={completed.includes(meal.id)} onClick={()=>complete(meal.id)}>{completed.includes(meal.id)?'Completada · desmarcar':'Marcar comida completada'}</button>}{coach&&<span className="dm-muted">{completed.includes(meal.id)?'Completada':'Pendiente'}</span>}</footer></article>)}</div></>}
 </section>;
}
