'use client';
import {useEffect,useState,type KeyboardEvent} from 'react';
import {ChefHat} from 'lucide-react';
import {recipePhotoUrl} from '@/lib/recipe-photos';
import type {MenuEntry} from '@/types/diet-menus';
import {entryTotals} from '@/lib/diet-menus';
export function tabKeys(event:KeyboardEvent<HTMLElement>){
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 const tabs=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
 const index=tabs.indexOf(document.activeElement as HTMLButtonElement);if(index<0)return;
 event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
 tabs[next]?.focus();tabs[next]?.click();
}
export function RecipePhoto({path,name,resolve=recipePhotoUrl}:{path?:string;name:string;resolve?:(path:string)=>Promise<string>}){
 const [image,setImage]=useState<{path:string;url:string}|null>(null);
 useEffect(()=>{
  if(!path)return;let live=true;
  const load=()=>void resolve(path).then(url=>{if(live)setImage({path,url});}).catch(()=>{if(live)setImage(null);});
  load();const timer=window.setInterval(load,12*60*1000);
  return ()=>{live=false;window.clearInterval(timer);};
 },[path,resolve]);
 return <div className="dm-photo">{image&&image.path===path?
 // Signed private URLs are short lived and cannot use the shared image optimizer cache.
 // eslint-disable-next-line @next/next/no-img-element
 <img src={image.url} alt={name} onError={()=>setImage(null)}/>:<ChefHat size={28} aria-label={path?'Foto no disponible':'Receta sin foto'}/>}</div>;
}
export function NutritionLine({totals}:{totals:{kcal:number;protein:number;carbs:number;fat:number;fiber?:number}}){return <div className="dm-nutrients"><strong>{Math.round(totals.kcal)} <small>kcal</small></strong><span>Proteína <b>{Math.round(totals.protein)} g</b></span><span>Carbos <b>{Math.round(totals.carbs)} g</b></span><span>Grasas <b>{Math.round(totals.fat)} g</b></span></div>;}
export function EntrySummary({entry,resolvePhoto}:{entry:MenuEntry;resolvePhoto?:(path:string)=>Promise<string>}){
 const recipe=entry.kind==='recipe'?entry.recipe:null;
 return <><div className="dm-entry-top">{recipe&&<RecipePhoto path={recipe.photo_path} name={recipe.name} resolve={resolvePhoto}/>}<div><strong>{recipe?.name??(entry.kind==='food'?entry.ingredient.food.name:'')}</strong><small>{entry.kind==='recipe'?`${entry.portions} ${entry.portions===1?'porción':'porciones'}`: `${entry.ingredient.quantity} ${entry.ingredient.unit}`}</small><NutritionLine totals={entryTotals(entry)}/></div></div>{recipe&&<details className="dm-preparation"><summary>Ingredientes y preparación</summary><ul>{recipe.ingredients.map(item=><li key={item.id}>{item.food.name} · {Number((item.quantity*(entry.kind==='recipe'?entry.portions:1)/recipe.servings).toFixed(2))} {item.unit}</li>)}</ul>{recipe.instructions&&<p>{recipe.instructions}</p>}<small>Ingredientes ajustados a la porción indicada. La preparación corresponde a la receta completa.</small></details>}</>;
}
