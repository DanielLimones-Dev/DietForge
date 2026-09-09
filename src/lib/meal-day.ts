import type {Food,MealPlanItem} from '@/types';
export function itemsForDay(items:MealPlanItem[],restDay:boolean){
 return items.filter(item=>(item.day_type==='rest')===restDay);
}
export function foodRatio(quantity:number,unit:string,servingSize:number){
 if(!Number.isFinite(quantity)||quantity<=0)return 0;
 // Food nutrients are stored per 100 g/ml. A piece uses its declared serving weight.
 const weight = unit==='pieza'||unit==='pz' ? (Number.isFinite(servingSize)&&servingSize>0?servingSize:0) : unit==='lb'?453.59237:unit==='g'||unit==='ml'?1:0;
 return quantity*weight/100;
}
export function convertQuantity(quantity:number,from:string,to:string,servingSize:number){
 const factor=foodRatio(1,to,servingSize);
 return factor>0?foodRatio(quantity,from,servingSize)/factor:0;
}
export function restReduction(value:string|null|undefined){
 const n=value==null||value===''?25:Number(value);
 return Number.isFinite(n)&&n>=0&&n<=100?n:25;
}
export function restTargets<T extends {total_kcal:number;total_protein:number;total_carbs:number;total_fat:number;total_fiber:number}>(target:T,percent:number){
 const factor=1-restReduction(String(percent))/100;
 return {...target,total_kcal:Math.round(target.total_kcal*factor),total_protein:Math.round(target.total_protein*factor),total_carbs:Math.round(target.total_carbs*factor),total_fat:Math.round(target.total_fat*factor),total_fiber:Math.round(target.total_fiber*factor)};
}
export function mealTotals(items:MealPlanItem[],getFood:(id:number)=>Food|undefined){
 return items.reduce((sum,item)=>{
  const food=getFood(item.food_id);if(!food)return sum;
  const ratio=foodRatio(item.quantity,item.serving_unit,food.serving_size);
  return {kcal:sum.kcal+food.kcal*ratio,protein:sum.protein+food.protein*ratio,carbs:sum.carbs+food.carbs*ratio,fat:sum.fat+food.fat*ratio};
 },{kcal:0,protein:0,carbs:0,fat:0});
}
