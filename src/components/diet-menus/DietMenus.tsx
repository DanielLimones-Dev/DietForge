'use client';
import {useEffect,useState,useRef} from 'react';
import {Plus,Copy,Trash2,BookOpen,Utensils,ChefHat,Check,ArrowLeft,Printer,Search,X} from 'lucide-react';
import {db,subscribeStorage,retryCloudSave,getStorageState} from '@/lib/db';
import type {Food} from '@/types';
import type {ClientMenu,Recipe,MenuEntry} from '@/types/diet-menus';
import {duplicateMenu,menuTotals,menuIssues,recipeTotals,entryTotals} from '@/lib/diet-menus';
import {UnsavedChangesAlert} from './UnsavedChangesAlert';
import {ConfirmDialog} from '../ui';
import {RecipeEditor} from './RecipeEditor';
import {NutritionLine,RecipePhoto,EntrySummary,tabKeys} from './shared';
import {generateMenuPDF} from '@/lib/menu-pdf';
import {openPrintDocument} from '@/lib/print-document';

export interface DietMenuStore {
 getMenus:(clientId:number)=>ClientMenu[];getRecipes:()=>Recipe[];getFoods:()=>Food[];
 saveMenu:(menu:Omit<ClientMenu,'id'>)=>ClientMenu;updateMenu:(id:number,menu:Partial<Omit<ClientMenu,'id'>>)=>ClientMenu|undefined;deleteMenu:(id:number)=>void;
 saveRecipe:(recipe:Omit<Recipe,'id'>)=>Recipe;updateRecipe:(id:number,recipe:Partial<Omit<Recipe,'id'>>)=>Recipe|undefined;deleteRecipe:(id:number)=>void;
 subscribe:(listener:()=>void)=>()=>void;flush:()=>Promise<void>;
 uploadPhoto?:(file:File)=>Promise<string>;resolvePhoto?:(path:string)=>Promise<string>;
}

const cloudStore:DietMenuStore={
 getMenus:id=>db.getClientMenus(id),getRecipes:()=>db.getRecipes(),getFoods:()=>db.getFoods(),
 saveMenu:data=>db.saveClientMenu(data),updateMenu:(id,data)=>db.updateClientMenu(id,data),deleteMenu:id=>db.deleteClientMenu(id),
 saveRecipe:data=>db.saveRecipe(data),updateRecipe:(id,data)=>db.updateRecipe(id,data),deleteRecipe:id=>db.deleteRecipe(id),
 subscribe:subscribeStorage,
 flush:async()=>{await retryCloudSave();const state=getStorageState();if(state.phase==='error')throw new Error(state.message);}
};

export function DietMenus({clientId,clientName,store=cloudStore}:{clientId:number;clientName:string;store?:DietMenuStore}){
 const [,tick]=useState(0);useEffect(()=>store.subscribe(()=>tick(n=>n+1)),[store]);
 const menus=store.getMenus(clientId);const recipes=store.getRecipes();const foods=store.getFoods();
 const [draft,setDraft]=useState<ClientMenu|null>(()=>store.getMenus(clientId)[0]??null);
 const [saved,setSaved]=useState(()=>JSON.stringify(draft));
 const [view,setView]=useState<'menus'|'recipes'>('menus');const [recipeEditor,setRecipeEditor]=useState<Recipe|'new'|null>(null);
 const [selection,setPicker]=useState<{meal:string;kind:'recipe'|'food'}|null>(null);const [search,setSearch]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 const [confirmDelete,setConfirmDelete]=useState<null|{kind:'menu';id:number;name:string}|{kind:'meal';id:string;name:string}|{kind:'recipe';id:number;name:string}>(null);
 const [removingMenuId,setRemovingMenuId]=useState<number|null>(null);
 const [removingMealId,setRemovingMealId]=useState<string|null>(null);
 const [removingEntryId,setRemovingEntryId]=useState<string|null>(null);
 const [enteringMenuId,setEnteringMenuId]=useState<number|null>(null);
 const timersRef=useRef<number[]>([]);
 useEffect(()=>()=>{timersRef.current.forEach(t=>window.clearTimeout(t));},[]);
 const schedule=(fn:()=>void,ms:number)=>{
  const reduced=typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(reduced||ms<=0){fn();return;}
  const id=window.setTimeout(()=>{timersRef.current=timersRef.current.filter(t=>t!==id);fn();},ms);
  timersRef.current.push(id);
 };
 const picker=selection&&draft?.meals.some(m=>m.id===selection.meal)?selection:draft?.meals.length?{meal:draft.meals[0].id,kind:'food' as const}:null;

 function addMeal(){
  if(!draft)return;
  const meal={id:crypto.randomUUID(),name:['Desayuno','Comida','Cena','Colación'][draft.meals.length]??`Comida ${draft.meals.length+1}`,items:[]};
  setDraft({...draft,meals:[...draft.meals,meal]});
  setPicker({meal:meal.id,kind:'food'});
  setSearch('');
 }

 const [pendingAction,setPendingAction]=useState<(()=>void)|null>(null);
 function confirmUnsaved(action:()=>void){setPendingAction(()=>action);}
 const recipeAttempt=useRef<number|null>(null);
 function openRecipe(value:Recipe|'new'|null){recipeAttempt.current=null;setRecipeEditor(value);}
 const dirty=JSON.stringify(draft)!==saved;
 const error=(e:unknown)=>setMessage(e instanceof Error?e.message:'No se pudo completar la acción.');
 const [autoSaving,setAutoSaving]=useState(false);
 const autoSavingRef=useRef(false);const autoQueuedRef=useRef(false);const autoVersionRef=useRef(0);const lastSavedVersionRef=useRef(0);
 const draftRef=useRef<ClientMenu|null>(draft);
 const dirtyRef=useRef(dirty);
 const autoSaveRef=useRef<()=>Promise<void>>(async()=>{});

 async function autoSave(){
  const current=draftRef.current;
  if(!current||!dirtyRef.current){return;}
  if(autoSavingRef.current){autoQueuedRef.current=true;return;}
  if(autoVersionRef.current===lastSavedVersionRef.current){return;}
  const next={...current,name:current.name.trim()||current.name,updated_at:new Date().toISOString()};
  const issues=menuIssues(next);
  if(issues.length){setMessage(issues[0]);return;}
  autoSavingRef.current=true;autoQueuedRef.current=false;setAutoSaving(true);
  const version=autoVersionRef.current;
  try{
   await store.flush();
   const menu=store.updateMenu(current.id,next);
   if(!menu)throw new Error('El menú ya no está disponible.');
   await store.flush();
   lastSavedVersionRef.current=version;
   setSaved(JSON.stringify(menu));
   if(autoVersionRef.current===version)setDraft(menu);
   else setDraft(prev=>prev?{...prev,updated_at:menu.updated_at}:prev);
   setMessage('');
  }catch(e){error(e);}
  finally{
   autoSavingRef.current=false;setAutoSaving(false);
   if(autoQueuedRef.current){autoQueuedRef.current=false;void autoSaveRef.current();}
  }
 }

 useEffect(()=>{draftRef.current=draft;dirtyRef.current=dirty;autoSaveRef.current=autoSave;});
 useEffect(()=>{
  autoVersionRef.current+=1;
  if(!draft||!dirty||busy)return;
  const timer=window.setTimeout(()=>{void autoSaveRef.current();},650);
  return()=>window.clearTimeout(timer);
 },[draft,dirty,busy]);

 function select(menu:ClientMenu|null){
  const apply=()=>{setDraft(menu);setSaved(JSON.stringify(menu));setPicker(null);setMessage('');};
  if(dirty){confirmUnsaved(apply);return;}
  apply();
 }

 async function flush(){try{await store.flush();}catch(e){error(e);}}

 function create(confirmed=false){
  if(dirty&&!confirmed){confirmUnsaved(()=>create(true));return;}
  try{
   let number=menus.length+1;while(menus.some(m=>m.name===`Menú ${number}`))number++;
   const stamp=new Date().toISOString();
   const menu=store.saveMenu({client_id:clientId,name:`Menú ${number}`,assigned:false,meals:[],created_at:stamp,updated_at:stamp});
   setDraft(menu);setSaved(JSON.stringify(menu));setView('menus');setPicker(null);
   setEnteringMenuId(menu.id);schedule(()=>setEnteringMenuId(cur=>cur===menu.id?null:cur),420);
   setMessage('Menú creado. Agrega sus comidas.');
   void flush();
  }catch(e){error(e);}
 }

 async function toggleAssign(assign:boolean){
  if(!draft||busy)return;
  const next={...draft,name:draft.name.trim(),assigned:assign,updated_at:new Date().toISOString()};
  const issues=menuIssues(next);
  if(issues.length){setMessage(issues[0]);return;}
  setBusy(true);autoSavingRef.current=true;
  try{
   await store.flush();
   const menu=store.updateMenu(draft.id,next);
   if(!menu)throw new Error('El menú ya no está disponible.');
   await store.flush();
   lastSavedVersionRef.current=autoVersionRef.current;
   setDraft(menu);setSaved(JSON.stringify(menu));
   setMessage(assign?'Menú asignado y visible en el portal del cliente.':'Menú retirado del portal (borrador).');
  }catch(e){error(e);}
  finally{autoSavingRef.current=false;setBusy(false);}
 }

 function duplicate(){
  if(!draft)return;
  try{
   const copy=store.saveMenu(duplicateMenu(draft));
   setDraft(copy);setSaved(JSON.stringify(copy));setPicker(null);
   setEnteringMenuId(copy.id);schedule(()=>setEnteringMenuId(cur=>cur===copy.id?null:cur),420);
   setMessage('Copia independiente creada.');
   void flush();
  }catch(e){error(e);}
 }

 function remove(){
  if(!draft||removingMenuId!==null)return;
  setConfirmDelete({kind:'menu',id:draft.id,name:draft.name});
 }

 function executeDeleteMenu(menuId:number){
  setRemovingMenuId(menuId);
  schedule(()=>{
   try{
    store.deleteMenu(menuId);
    const next=store.getMenus(clientId)[0]??null;
    setDraft(next);setSaved(JSON.stringify(next));setPicker(null);
    setMessage('Menú eliminado.');
    void flush();
   }catch(e){error(e);}
   finally{setRemovingMenuId(null);}
  },300);
 }

 function executeDeleteMeal(mealId:string,immediate=false){
  if(immediate){
   setDraft(d=>d?{...d,meals:d.meals.filter(m=>m.id!==mealId)}:d);
   setPicker(null);
   return;
  }
  setRemovingMealId(mealId);
  schedule(()=>{
   setDraft(d=>d?{...d,meals:d.meals.filter(m=>m.id!==mealId)}:d);
   setPicker(null);
   setRemovingMealId(null);
  },240);
 }

 function executeDeleteEntry(mealId:string,entryId:string){
  setRemovingEntryId(entryId);
  schedule(()=>{
   setDraft(d=>d?{...d,meals:d.meals.map(m=>m.id===mealId?{...m,items:m.items.filter(i=>i.id!==entryId)}:m)}:d);
   setRemovingEntryId(null);
  },200);
 }

 function addEntry(entry:MenuEntry){
  if(!picker)return;
  setDraft(d=>d?{...d,meals:d.meals.map(m=>m.id===picker.meal?{...m,items:[...m.items,entry]}:m)}:d);
  setSearch('');
 }

 function setEntry(mealId:string,entryId:string,quantity:number){
  setDraft(d=>d?{...d,meals:d.meals.map(m=>m.id===mealId?{...m,items:m.items.map(i=>i.id===entryId?(i.kind==='recipe'?{...i,portions:quantity}:{...i,ingredient:{...i.ingredient,quantity}}):i)}:m)}:d);
 }

 async function recipeSave(data:Omit<Recipe,'id'>){
  setBusy(true);
  try{
   await store.flush();
   const id=recipeEditor&&recipeEditor!=='new'?recipeEditor.id:recipeAttempt.current;
   const result=id?store.updateRecipe(id,data):store.saveRecipe(data);
   if(!result)throw new Error('La receta ya no está disponible.');
   recipeAttempt.current=result.id;
   await store.flush();openRecipe(null);
   setMessage('Receta guardada en tu biblioteca.');
  }finally{setBusy(false);}
 }

 const numeric=(s:string)=>s===''?NaN:Number(s);
 function exportPdf(){
  if(!draft)return;
  try{openPrintDocument(generateMenuPDF(draft,clientName));setMessage('PDF del menú abierto.');}
  catch(e){error(e);}
 }

 const totals=draft?menuTotals(draft):{kcal:0,protein:0,carbs:0,fat:0};

 return <section className="dm-workspace" aria-label="Menús y recetas">
  <fieldset className="dm-lock" disabled={busy}>
   <header className="dm-topbar">
    <div className="dm-topbar-copy">
     <span className="dm-eyebrow">ALIMENTACIÓN PERSONALIZADA</span>
     <div className="dm-topbar-title">
      <h2>Menús y recetas</h2>
      <span className="dm-sync-pill" aria-live="polite">
       <i className={autoSaving||dirty?'is-pending':''}/>
       {autoSaving?'Guardando automáticamente…':dirty?'Cambios sin guardar':'Guardado automático'}
      </span>
     </div>
     <p>Variantes de comidas y recetario práctico para {clientName}.</p>
    </div>
    <div className="dm-view-switch">
     <button type="button" className={view==='menus'?'selected':''} onClick={()=>{const leave=()=>{openRecipe(null);setView('menus');};if(recipeEditor){confirmUnsaved(leave);return;}leave();}}>
      <Utensils size={15}/>Mis menús <span>{menus.length}</span>
     </button>
     <button type="button" className={view==='recipes'?'selected':''} onClick={()=>{setView('recipes');setPicker(null);}}>
      <BookOpen size={15}/>Mis recetas <span>{recipes.length}</span>
     </button>
    </div>
   </header>

   {message&&<p className="dm-message" role="status">{message}</p>}

   {view==='menus'?<>
    <div className="dm-menu-bar">
     <div role="tablist" aria-label="Menús del cliente" className="dm-menu-tabs" onKeyDown={tabKeys}>
      {menus.map(menu=><button type="button" role="tab" className={`${removingMenuId===menu.id?'is-removing':''} ${enteringMenuId===menu.id?'is-entering':''}`.trim()} aria-selected={draft?.id===menu.id} tabIndex={draft?.id===menu.id?0:-1} aria-controls="dm-menu-panel" id={`dm-tab-${menu.id}`} key={menu.id} onClick={()=>select(menu)}>
       {menu.assigned&&<span className="dm-assigned-dot" title="Visible en el portal"/>}
       <span>{menu.name}</span>
      </button>)}
     </div>
     <button type="button" className="dm-primary" onClick={()=>create()} disabled={busy}><Plus size={15}/>Agregar menú</button>
    </div>

    {!draft?<div className="dm-empty">
     <ChefHat size={32}/>
     <h3>Su primer menú empieza aquí</h3>
     <p>Crea alternativas diarias combinando alimentos y tus propias recetas.</p>
     <button type="button" className="dm-primary" onClick={()=>create()}><Plus size={15}/>Crear Menú 1</button>
    </div>:<div role="tabpanel" id="dm-menu-panel" aria-labelledby={`dm-tab-${draft.id}`} className={`dm-panel-body ${removingMenuId===draft.id?'is-removing':''} ${enteringMenuId===draft.id?'is-entering':''}`.trim()}>
     <div className="dm-command-card">
      <div className="dm-command-main">
       <label className="dm-name-field">
        <span>NOMBRE DEL MENÚ</span>
        <input aria-label="Nombre del menú" maxLength={120} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/>
       </label>
       <div className="dm-macro-ribbon" aria-label="Totales del menú">
        <div className="dm-ribbon-item is-kcal">
         <small>Calorías</small>
         <strong>{Math.round(totals.kcal)} <span>kcal</span></strong>
        </div>
        <div className="dm-ribbon-item is-protein">
         <small><i/>Proteína</small>
         <strong>{Math.round(totals.protein)} <span>g</span></strong>
        </div>
        <div className="dm-ribbon-item is-carbs">
         <small><i/>Carbos</small>
         <strong>{Math.round(totals.carbs)} <span>g</span></strong>
        </div>
        <div className="dm-ribbon-item is-fat">
         <small><i/>Grasas</small>
         <strong>{Math.round(totals.fat)} <span>g</span></strong>
        </div>
       </div>
      </div>

      <div className="dm-command-actions">
       <button
        type="button"
        className={`dm-assign-toggle ${draft.assigned?'is-assigned':''}`}
        disabled={busy}
        onClick={()=>void toggleAssign(!draft.assigned)}
        title={draft.assigned?'Este menú es visible para el cliente en su portal':'Haz clic para mostrar este menú en el portal del cliente'}
       >
        <Check size={14}/>
        {draft.assigned?'Asignado al portal':'Asignar al portal'}
       </button>
       <button type="button" className="dm-secondary" onClick={addMeal}><Plus size={15}/>Agregar comida</button>
       <button type="button" className="dm-secondary" onClick={exportPdf} disabled={busy}><Printer size={15}/>PDF</button>
       <button type="button" className="dm-secondary" onClick={duplicate} disabled={busy}><Copy size={15}/>Duplicar</button>
       <button type="button" className="dm-icon dm-danger" aria-label="Eliminar menú" onClick={remove} disabled={busy}><Trash2 size={16}/></button>
      </div>
     </div>

     <div className="dm-planner-layout">
      <div className="dm-planner-comidas">
       {draft.meals.length===0?<div className="dm-empty dm-empty-meals">
        <Utensils size={26}/>
        <h3>Sin tiempos de comida</h3>
        <p>Agrega Desayuno, Comida o Cena para empezar a armar este menú.</p>
        <button type="button" className="dm-primary" onClick={addMeal}><Plus size={15}/>Agregar comida</button>
       </div>:<div className="dm-meals">
        {draft.meals.map(meal=>{
         const isSelected=picker?.meal===meal.id;
         const mTotals=meal.items.reduce((acc,item)=>{const t=entryTotals(item);return {kcal:acc.kcal+t.kcal,protein:acc.protein+t.protein,carbs:acc.carbs+t.carbs,fat:acc.fat+t.fat};},{kcal:0,protein:0,carbs:0,fat:0});
         return <article key={meal.id} className={`dm-meal ${isSelected?'is-selected':''} ${removingMealId===meal.id?'is-removing':''}`.trim()} onClick={()=>{if(!isSelected)setPicker({meal:meal.id,kind:picker?.kind??'food'});}}>
          <header>
           <button type="button" className="dm-meal-select" aria-label={`Seleccionar ${meal.name}`} onClick={e=>{e.stopPropagation();setPicker({meal:meal.id,kind:picker?.kind??'food'});}}>
            <Utensils size={15}/>
           </button>
           <input aria-label="Nombre de la comida" maxLength={80} value={meal.name} onClick={e=>e.stopPropagation()} onChange={e=>setDraft(d=>d?{...d,meals:d.meals.map(m=>m.id===meal.id?{...m,name:e.target.value}:m)}:d)}/>
           <div className="dm-meal-header-meta">
            {isSelected&&<span className="dm-meal-active-pill">Activa</span>}
            <span className="dm-meal-kcal">{Math.round(mTotals.kcal)} kcal</span>
            <span className="dm-meal-macros-mini">P {Math.round(mTotals.protein)}g · C {Math.round(mTotals.carbs)}g · G {Math.round(mTotals.fat)}g</span>
           </div>
           <button type="button" className="dm-icon dm-danger" aria-label={`Eliminar ${meal.name}`} onClick={e=>{e.stopPropagation();if(meal.items.length){setConfirmDelete({kind:'meal',id:meal.id,name:meal.name});return;}executeDeleteMeal(meal.id,true);}}>
            <Trash2 size={15}/>
           </button>
          </header>
          <div className="dm-entries" onClick={e=>e.stopPropagation()}>
           {meal.items.map(entry=><div className={`dm-entry ${removingEntryId===entry.id?'is-removing':''}`.trim()} key={entry.id}>
            <EntrySummary entry={entry} resolvePhoto={store.resolvePhoto}/>
            <div className="dm-entry-actions">
             <label>
              <span>{entry.kind==='recipe'?'Porciones':'Cantidad'}</span>
              <input data-plain-number type="number" min="0.01" step="any" value={Number.isFinite(entry.kind==='recipe'?entry.portions:entry.ingredient.quantity)?(entry.kind==='recipe'?entry.portions:entry.ingredient.quantity):''} onChange={e=>setEntry(meal.id,entry.id,numeric(e.target.value))}/>
             </label>
             {entry.kind==='food'&&<label>
              <span>Unidad</span>
              <select aria-label="Unidad del alimento" value={entry.ingredient.unit} onChange={e=>setDraft(d=>d?{...d,meals:d.meals.map(m=>m.id===meal.id?{...m,items:m.items.map(i=>i.id===entry.id&&i.kind==='food'?{...i,ingredient:{...i.ingredient,unit:e.target.value as 'g'|'ml'|'lb'|'pieza'}}:i)}:m)}:d)}>
               {['g','ml','lb','pieza'].map(unit=><option key={unit}>{unit}</option>)}
              </select>
             </label>}
             <button type="button" className="dm-icon dm-danger" aria-label="Quitar elemento" onClick={()=>executeDeleteEntry(meal.id,entry.id)}>
              <Trash2 size={15}/>
             </button>
            </div>
           </div>)}
           {!meal.items.length&&<p className="dm-muted">Haz clic en un alimento o receta de la columna derecha para agregarlo a {meal.name}.</p>}
          </div>
         </article>;
        })}
       </div>}
      </div>

      <aside className="dm-planner-library" aria-label="Biblioteca para la comida">
       <div className="dm-library-top">
        <span className="dm-eyebrow">CATÁLOGO RÁPIDO</span>
        <label className="dm-target-select">
         <span>Agregando a</span>
         <select aria-label="Comida de destino" value={picker?.meal??''} onChange={e=>setPicker(e.target.value?{meal:e.target.value,kind:picker?.kind??'food'}:null)}>
          <option value="">Selecciona una comida</option>
          {draft.meals.map(meal=><option key={meal.id} value={meal.id}>{meal.name}</option>)}
         </select>
        </label>
       </div>

       <div className="dm-view-switch dm-library-switch">
        <button type="button" className={(picker?.kind??'food')==='food'?'selected':''} disabled={!picker} onClick={()=>{if(picker)setPicker({...picker,kind:'food'});setSearch('');}}>Alimentos</button>
        <button type="button" className={picker?.kind==='recipe'?'selected':''} disabled={!picker} onClick={()=>{if(picker)setPicker({...picker,kind:'recipe'});setSearch('');}}>Recetas</button>
       </div>

       <div className="dm-search-box">
        <Search size={15}/>
        <input aria-label="Buscar para agregar" placeholder={picker?.kind==='recipe'?'Buscar receta…':'Buscar alimento…'} value={search} onChange={e=>setSearch(e.target.value)}/>
        {search&&<button type="button" aria-label="Limpiar búsqueda" onClick={()=>setSearch('')}><X size={13}/></button>}
       </div>

       <div className="dm-picker-results">
        {(picker?.kind??'food')==='recipe'
         ?recipes.filter(r=>r.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(recipe=>{
          const rt=recipeTotals(recipe);
          return <button type="button" key={recipe.id} disabled={!picker} onClick={()=>addEntry({id:crypto.randomUUID(),kind:'recipe',recipe:structuredClone(recipe),portions:1})}>
           <RecipePhoto path={recipe.photo_path} name={recipe.name} resolve={store.resolvePhoto}/>
           <span>
            <strong>{recipe.name}</strong>
            <small>{Math.round(rt.kcal)} kcal · P {Math.round(rt.protein)}g · C {Math.round(rt.carbs)}g · G {Math.round(rt.fat)}g</small>
           </span>
           <span className="dm-pick-plus"><Plus size={14}/></span>
          </button>;
         })
         :foods.filter(f=>f.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).slice(0,45).map(food=><button type="button" key={food.id} disabled={!picker} onClick={()=>addEntry({id:crypto.randomUUID(),kind:'food',ingredient:{id:crypto.randomUUID(),food:structuredClone(food),quantity:100,unit:'g'}})}>
          <span>
           <strong>{food.name}</strong>
           <small>{Math.round(food.kcal)} kcal · P {Math.round(food.protein)}g · C {Math.round(food.carbs)}g · G {Math.round(food.fat)}g / 100 {food.serving_unit||'g'}</small>
          </span>
          <span className="dm-pick-plus"><Plus size={14}/></span>
         </button>)}
       </div>

       {(picker?.kind??'food')==='recipe'&&!recipes.length&&<p className="dm-library-empty-note">Tu recetario está vacío. Crea tu primera receta en <button type="button" className="dm-text-button" onClick={()=>{setView('recipes');openRecipe('new');}}>Mis recetas</button>.</p>}
      </aside>
     </div>
    </div>}
   </>:recipeEditor?<>
    <button type="button" className="dm-text-button dm-back" onClick={()=>{confirmUnsaved(()=>openRecipe(null));}}><ArrowLeft size={15}/>Volver al recetario</button>
    <RecipeEditor key={recipeEditor==='new'?'new':recipeEditor.id} recipe={recipeEditor==='new'?undefined:recipeEditor} foods={foods} onSave={recipeSave} onCancel={()=>confirmUnsaved(()=>openRecipe(null))} upload={store.uploadPhoto} resolvePhoto={store.resolvePhoto}/>
   </>:<>
    <div className="dm-library-heading">
     <div>
      <h3>Mis recetas</h3>
      <p>Tu biblioteca privada, disponible para todos tus clientes.</p>
     </div>
     <button type="button" className="dm-primary" onClick={()=>openRecipe('new')}><Plus size={15}/>Nueva receta</button>
    </div>
    <input className="dm-library-search" aria-label="Buscar recetas" placeholder="Buscar en mi recetario…" value={search} onChange={e=>setSearch(e.target.value)}/>
    <div className="dm-recipe-grid">
     {recipes.filter(r=>r.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(recipe=><article className="dm-recipe-card" key={recipe.id}>
      <RecipePhoto path={recipe.photo_path} name={recipe.name} resolve={store.resolvePhoto}/>
      <div>
       <h4>{recipe.name}</h4>
       <small>Por porción · Rinde {recipe.servings}</small>
       <NutritionLine totals={recipeTotals(recipe)}/>
      </div>
      <footer>
       <button type="button" className="dm-secondary" onClick={()=>openRecipe(recipe)}>Editar receta</button>
       <button type="button" className="dm-icon dm-danger" aria-label={`Eliminar receta ${recipe.name}`} onClick={()=>setConfirmDelete({kind:'recipe',id:recipe.id,name:recipe.name})}>
        <Trash2 size={16}/>
       </button>
      </footer>
     </article>)}
    </div>
    {!recipes.length&&<div className="dm-empty">
     <BookOpen size={30}/>
     <h3>Recetas que tus clientes querrán preparar</h3>
     <p>Agrega una foto, los ingredientes y los pasos. El cálculo por porción es automático.</p>
    </div>}
   </>}
  </fieldset>
  {pendingAction&&<UnsavedChangesAlert onContinue={()=>setPendingAction(null)} onDiscard={()=>{const action=pendingAction;setPendingAction(null);action();}}/>}
  <ConfirmDialog
   open={Boolean(confirmDelete)}
   title={confirmDelete?.kind==='menu'?`Eliminar «${confirmDelete.name}»`:confirmDelete?.kind==='meal'?`Eliminar ${confirmDelete.name}`:confirmDelete?.kind==='recipe'?`Eliminar «${confirmDelete.name}»`:''}
   message={confirmDelete?.kind==='menu'?'¿Eliminar este menú? El plan de alimentación actual no cambia.':confirmDelete?.kind==='meal'?'¿Eliminar esta comida y todos sus elementos del menú?':'¿Eliminar de tu biblioteca? Los menús ya creados conservarán su copia.'}
   onCancel={()=>setConfirmDelete(null)}
   onConfirm={()=>{
    if(!confirmDelete)return;
    const target=confirmDelete;
    setConfirmDelete(null);
    if(target.kind==='menu'){executeDeleteMenu(target.id);}
    else if(target.kind==='meal'){executeDeleteMeal(target.id);}
    else if(target.kind==='recipe'){try{store.deleteRecipe(target.id);void flush();}catch(e){error(e);}}
   }}
  />
 </section>;
}
