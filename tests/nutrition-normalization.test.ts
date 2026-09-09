import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseFatSecretDesc} from '../src/lib/nutrition-normalization';
test('search summaries preserve mass or volume basis and fractional calories',()=>{
 const n=parseFatSecretDesc('Per 50g - Calories: 100.5kcal | Fat: 2.5g | Carbs: 10g | Protein: 5g');
 assert.deepEqual(n,{kcal:201,fat:5,carbs:20,protein:10,serving_unit:'g'});
 assert.equal(parseFatSecretDesc('Per 100ml - Calories: 50kcal | Fat: 1g | Carbs: 5g | Protein: 2g')?.serving_unit,'ml');
});
test('unknown serving sizes and missing nutrients cannot become false 100g food values',()=>{
 for(const s of ['Per 1 serving - Calories: 300kcal | Fat: 13g | Carbs: 32g | Protein: 15g','Per 0g - Calories: 2kcal','Per 100g - Calories: 50kcal',''])assert.equal(parseFatSecretDesc(s),null);
});
