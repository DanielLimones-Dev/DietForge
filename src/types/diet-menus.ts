import type {Food} from './index';
export interface RecipeIngredient {id:string;food:Food;quantity:number;unit:'g'|'ml'|'lb'|'pieza'}
export interface Recipe {id:number;name:string;servings:number;instructions:string;photo_path?:string;ingredients:RecipeIngredient[];created_at:string;updated_at:string}
export type MenuEntry={id:string;kind:'recipe';recipe:Recipe;portions:number}|{id:string;kind:'food';ingredient:RecipeIngredient};
export interface MenuMeal {id:string;name:string;items:MenuEntry[]}
export interface ClientMenu {id:number;client_id:number;name:string;assigned:boolean;meals:MenuMeal[];created_at:string;updated_at:string}
