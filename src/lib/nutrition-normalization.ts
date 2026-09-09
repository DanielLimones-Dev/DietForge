// Search summaries may describe a branded serving, not 100 g. Without a
// measurable basis, do not silently import portion values as values per 100 g.
export function parseFatSecretDesc(desc:string){
 const basis=/^Per\s+(\d+(?:\.\d+)?)\s*(g|ml)\s*-/i.exec(desc.trim());
 if(!basis||Number(basis[1])<=0)return null;
 const number=(label:string,unit:string)=>{
 const match=new RegExp(`${label}:\\s*([0-9]+(?:\\.[0-9]+)?)\\s*${unit}\\b`,'i').exec(desc);
 return match?Number(match[1])*100/Number(basis[1]):NaN;
 };
 const n={protein:number('Protein','g'),carbs:number('Carbs','g'),fat:number('Fat','g'),kcal:number('Calories','kcal'),serving_unit:basis[2].toLowerCase()};
 return [n.protein,n.carbs,n.fat,n.kcal].every(Number.isFinite)?n:null;
}
