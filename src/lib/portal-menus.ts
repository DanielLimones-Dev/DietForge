import {supabase} from './supabase';
import type {ClientMenu} from '@/types/diet-menus';
import {portalFailure} from './portal-errors';
export interface MenuDay {date:string;menu_id:number;completed_meals:string[]}
export interface PortalMenusData {menus:ClientMenu[];days:MenuDay[]}
export async function readPortalMenus(owner:string,client:number):Promise<PortalMenusData>{
 const {data,error,status}=await supabase.rpc('dietforge_menus_read',{o:owner,c:client});
 if(error)throw portalFailure(error,status);return data;
}
export async function saveMenuDay(owner:string,client:number,date:string,menu:number,completed:string[]):Promise<void>{
 const {error,status}=await supabase.rpc('dietforge_menu_day_save',{o:owner,c:client,d:date,m:menu,completed});
 if(error)throw portalFailure(error,status);
}
