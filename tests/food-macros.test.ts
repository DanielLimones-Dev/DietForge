import assert from 'node:assert/strict';
import {test} from 'node:test';
import {applyFoodMacros,foodMacroDraft,parseFoodMacroDraft} from '../src/lib/food-macros';
import type {Food} from '../src/types';

const food:Food={id:9,name:'Avena de prueba',category:'grains',protein:13,carbs:60,fat:7,fiber:9,antioxidants:0,kcal:370,serving_size:100,serving_unit:'g',source:'manual',carb_type:'slow'};

test('food macro drafts start from the saved values and accept decimals',()=>{
 assert.deepEqual(foodMacroDraft(food),{protein:'13',carbs:'60',fat:'7',kcal:'370'});
 const parsed=parseFoodMacroDraft({protein:'12.5',carbs:'0',fat:'3.25',kcal:'0'});
 assert.deepEqual(parsed,{ok:true,values:{protein:12.5,carbs:0,fat:3.25,kcal:0}});
});

test('food macro drafts reject empty, negative and non-numeric values',()=>{
 for(const draft of [
  {protein:'',carbs:'1',fat:'1',kcal:'1'},
  {protein:'1',carbs:'',fat:'1',kcal:'1'},
  {protein:'1',carbs:'1',fat:'',kcal:'1'},
  {protein:'1',carbs:'1',fat:'1',kcal:''},
  {protein:'-1',carbs:'1',fat:'1',kcal:'1'},
  {protein:'1',carbs:'-0.1',fat:'1',kcal:'1'},
  {protein:'1',carbs:'1',fat:'1',kcal:'-5'},
  {protein:'abc',carbs:'1',fat:'1',kcal:'1'},
  {protein:'1',carbs:'1',fat:'1',kcal:'1e999'},
 ]){
  const parsed=parseFoodMacroDraft(draft);
  assert.equal(parsed.ok,false);
  if(!parsed.ok)assert.match(parsed.error,/cero|Completa/);
 }
});

test('applying food macros keeps identity and only replaces the four values',()=>{
 const updated=applyFoodMacros(food,{protein:20,carbs:50,fat:10,kcal:380});
 assert.equal(updated.id,9);assert.equal(updated.name,food.name);assert.equal(updated.kcal,380);
 assert.equal(updated.protein,20);assert.equal(updated.fiber,food.fiber);assert.equal(updated.serving_size,food.serving_size);
});
