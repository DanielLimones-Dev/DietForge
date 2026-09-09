import assert from 'node:assert/strict';
import {test} from 'node:test';
import {itemsForDay,mealTotals,foodRatio,convertQuantity,restTargets,restReduction} from '../src/lib/meal-day';
import {emptySnapshot,validateSnapshot} from '../src/lib/cloud/model';
import type {Food,MealPlanItem} from '../src/types';
const food:Food={id:1,name:'Prueba',protein:80,carbs:10,fat:2,fiber:0,antioxidants:0,kcal:378,serving_size:30,serving_unit:'g',category:'supplements',source:'manual'};
test('rest day mutations and saved snapshots leave normal totals unchanged',()=>{
 const items:MealPlanItem[]=[{id:1,meal_plan_id:1,meal_time:'meal1',food_id:1,quantity:100,serving_unit:'g'}];
 const normal=mealTotals(itemsForDay(items,false),()=>food);
 items.push({...items[0],id:2,day_type:'rest',quantity:30});
 assert.deepEqual(mealTotals(itemsForDay(items,false),()=>food),normal);
 assert.equal(mealTotals(itemsForDay(items,true),()=>food).protein,24);
 items[1].quantity=60;
 assert.equal(mealTotals(itemsForDay(items,true),()=>food).protein,48);
 assert.deepEqual(mealTotals(itemsForDay(items,false),()=>food),normal);
 const snapshot=emptySnapshot();snapshot.database.mealPlanItems=items;
 const restored=validateSnapshot(JSON.parse(JSON.stringify(snapshot)));
 assert.equal(itemsForDay(restored.database.mealPlanItems,true).length,1);
 items.splice(1,1);assert.equal(mealTotals(itemsForDay(items,true),()=>food).kcal,0);
 assert.deepEqual(mealTotals(itemsForDay(items,false),()=>food),normal);
});
test('portions use a consistent per-100 basis and never divide by zero',()=>{
 assert.ok(Math.abs(foodRatio(1,'lb',30)-4.5359237)<1e-10);
 assert.equal(foodRatio(.5,'pz',60),.3);
 assert.equal(foodRatio(1,'pieza',0),0);
 assert.ok(Math.abs(convertQuantity(convertQuantity(100,'g','lb',30),'lb','g',30)-100)<1e-10);
 assert.equal(convertQuantity(60,'g','pieza',30),2);
 assert.equal(foodRatio(30,'g',30),.3);
 assert.equal(foodRatio(2,'pieza',30),.6);
 assert.equal(foodRatio(100,'g',0),1);
 assert.equal(foodRatio(NaN,'g',100),0);
});
test('rest reduction is configurable and does not mutate the normal target',()=>{
 const target={total_kcal:2000,total_protein:100,total_carbs:200,total_fat:80,total_fiber:20};
 assert.equal(restTargets(target,10).total_kcal,1800);assert.equal(target.total_kcal,2000);
 assert.equal(restTargets(target,0).total_protein,100);assert.equal(restTargets(target,100).total_carbs,0);
 assert.equal(restReduction('invalid'),25);assert.equal(restReduction(null),25);
});
