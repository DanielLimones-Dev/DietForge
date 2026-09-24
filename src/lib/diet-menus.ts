import type {Recipe,RecipeIngredient,MenuEntry,ClientMenu} from '@/types/diet-menus';
import {foodRatio} from './meal-day';
export interface MenuTotals {kcal:number;protein:number;carbs:number;fat:number;fiber:number}
const zero=():MenuTotals=>({kcal:0,protein:0,carbs:0,fat:0,fiber:0});
const keys=['kcal','protein','carbs','fat','fiber'] as const;
function add(a:MenuTotals,b:MenuTotals){for(const key of keys)a[key]=Number.isFinite(a[key]+b[key])?a[key]+b[key]:0;return a;}
function ingredientTotals(ingredient:RecipeIngredient):MenuTotals{const ratio=foodRatio(ingredient.quantity,ingredient.unit,ingredient.food.serving_size);return Object.fromEntries(keys.map(key=>[key,Number.isFinite(ingredient.food[key]*ratio)&&ingredient.food[key]>=0?ingredient.food[key]*ratio:0])) as unknown as MenuTotals;}
export function recipeTotals(recipe:Recipe,portions=1):MenuTotals{const total=recipe.ingredients.reduce((sum,ingredient)=>add(sum,ingredientTotals(ingredient)),zero());const factor=recipe.servings>0&&Number.isFinite(recipe.servings)&&Number.isFinite(portions)&&portions>0?portions/recipe.servings:0;for(const key of keys)total[key]=Number.isFinite(total[key]*factor)?total[key]*factor:0;return total;}
export function entryTotals(entry:MenuEntry):MenuTotals{return entry.kind==='recipe'?recipeTotals(entry.recipe,entry.portions):ingredientTotals(entry.ingredient);}
export function menuTotals(menu:ClientMenu):MenuTotals{return menu.meals.reduce((sum,meal)=>meal.items.reduce((sum,item)=>add(sum,entryTotals(item)),sum),zero());}
export function duplicateMenu(menu:ClientMenu):Omit<ClientMenu,'id'>{const copy=structuredClone(menu);const {id:unused,...result}=copy;void unused;result.name=`${menu.name.slice(0,192)} · Copia`;result.assigned=false;result.created_at=result.updated_at=new Date().toISOString();for(const meal of result.meals){meal.id=crypto.randomUUID();for(const item of meal.items){item.id=crypto.randomUUID();const ingredients=item.kind==='recipe'?item.recipe.ingredients:[item.ingredient];for(const ingredient of ingredients)ingredient.id=crypto.randomUUID();}}return result;}

const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown,max=200)=>typeof value==='string'&&!!value.trim()&&value.length<=max;
const positive=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>0;
const safeId=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0;
const timestamp=(value:unknown)=>typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value));
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const childIdPattern=new RegExp(`^${uuid}$`);
const childId=(value:unknown)=>typeof value==='string'&&childIdPattern.test(value);
const photoPattern=new RegExp(`^${uuid}/${uuid}\\.(jpg|jpeg|png|webp)$`,'i');
function idsUnique(items:unknown[]){const ids=items.map(item=>record(item)?item.id:undefined);return ids.every(childId)&&new Set(ids).size===ids.length;}
function ingredientIssues(value:unknown):string[]{
 if(!record(value))return ['Ingrediente inválido.'];const issues:string[]=[];
 if(!childId(value.id))issues.push('El ingrediente necesita identificador.');
 if(!positive(value.quantity)||Number(value.quantity)>100000)issues.push('La cantidad debe ser finita y mayor que cero (máximo 100000).');
 if(!['g','ml','lb','pieza'].includes(String(value.unit)))issues.push('Unidad no admitida.');
 const food=value.food;
 if(!record(food))return [...issues,'Falta la copia del alimento.'];
 if(!safeId(food.id)||!text(food.name)||(!positive(food.serving_size)||Number(food.serving_size)>100000)||!text(food.serving_unit,30))issues.push('Datos del alimento inválidos.');
 for(const key of [...keys,'antioxidants'])if(typeof food[key]!=='number'||!Number.isFinite(food[key])||Number(food[key])<0||Number(food[key])>100000)issues.push(`Valor inválido de ${key}.`);
 if(!['protein','carbs','vegetables','fruits','fats','dairy','grains','legumes','nuts','beverages','supplements','other'].includes(String(food.category))||!['api','manual'].includes(String(food.source)))issues.push('Categoría o fuente del alimento inválida.');
 if(food.carb_type!==undefined&&!['fast','slow','mixed'].includes(String(food.carb_type)))issues.push('Tipo de carbohidrato inválido.');
 if(food.barcode!==undefined&&typeof food.barcode!=='string')issues.push('Código de alimento inválido.');
 return issues;
}
export function recipeIssues(value:unknown):string[]{
 if(!record(value))return ['Receta inválida.'];const issues:string[]=[];
 if(value.id!==undefined&&!safeId(value.id))issues.push('ID de receta inválido.');
 if(!text(value.name))issues.push('La receta necesita un nombre de hasta 200 caracteres.');
 if(!positive(value.servings)||Number(value.servings)>10000)issues.push('Las porciones deben ser finitas y mayores que cero.');
 if(typeof value.instructions!=='string'||value.instructions.length>10000)issues.push('Instrucciones inválidas o demasiado largas.');
 if(!timestamp(value.created_at)||!timestamp(value.updated_at))issues.push('Fechas de receta inválidas.');
 if(value.photo_path!==undefined&&(typeof value.photo_path!=='string'||!photoPattern.test(value.photo_path)))issues.push('La foto debe ser una ruta privada válida.');
 if(!Array.isArray(value.ingredients)||!value.ingredients.length)return [...issues,'Agrega al menos un ingrediente.'];
 if(!idsUnique(value.ingredients))issues.push('Identificadores de ingredientes inválidos o repetidos.');
 for(const ingredient of value.ingredients)issues.push(...ingredientIssues(ingredient));
 return issues;
}
export function menuIssues(value:unknown):string[]{
 if(!record(value))return ['Menú inválido.'];const issues:string[]=[];
 if(value.id!==undefined&&!safeId(value.id))issues.push('ID del menú inválido.');
 if(!safeId(value.client_id))issues.push('Selecciona un cliente válido.');
 if(!text(value.name))issues.push('El menú necesita un nombre de hasta 200 caracteres.');
 if(typeof value.assigned!=='boolean')issues.push('Estado de asignación inválido.');
 if(!timestamp(value.created_at)||!timestamp(value.updated_at))issues.push('Fechas del menú inválidas.');
 if(!Array.isArray(value.meals))return [...issues,'Comidas del menú inválidas.'];
 if(value.assigned&&value.meals.length===0)issues.push('Agrega al menos una comida antes de asignar.');
 if(!idsUnique(value.meals))issues.push('Identificadores de comidas inválidos o repetidos.');
 for(const meal of value.meals){
  if(!record(meal)){issues.push('Comida inválida.');continue;}
  if(!text(meal.name))issues.push('Cada comida necesita un nombre.');
  if(!Array.isArray(meal.items)){issues.push('Elementos de comida inválidos.');continue;}
  if(value.assigned&&meal.items.length===0)issues.push('Cada comida necesita al menos un alimento o receta antes de asignar.');
  if(!idsUnique(meal.items))issues.push('Identificadores de elementos inválidos o repetidos.');
  for(const item of meal.items){if(!record(item)){issues.push('Elemento de menú inválido.');continue;}if(item.kind==='food')issues.push(...ingredientIssues(item.ingredient));else if(item.kind==='recipe'){issues.push(...recipeIssues(item.recipe));if(!record(item.recipe)||!safeId(item.recipe.id))issues.push('La copia de receta necesita ID.');if(!positive(item.portions)||Number(item.portions)>10000)issues.push('Las porciones deben ser finitas y mayores que cero.');}else issues.push('Tipo de elemento desconocido.');}
 }
 return issues;
}
