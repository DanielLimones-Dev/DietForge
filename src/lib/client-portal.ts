import { supabase } from './supabase';
import type { Client,TrainingProgram,MealPlan,MealPlanItem,Food,ClientMeasurement,WeekPlan } from '@/types';
import type { Activity } from './training-tracking';
export interface PortalMembership {owner_id:string;client_id:number;name:string;email:string;enabled:boolean}
export interface PortalData {client:Pick<Client,'id'|'name'|'next_check_in_date'>;trainingPrograms:TrainingProgram[];mealPlans:MealPlan[];mealPlanItems:MealPlanItem[];foods:Food[];measurements:ClientMeasurement[];weekPlans:WeekPlan[];activity:Activity[]}
export async function memberships():Promise<PortalMembership[]>{const {data,error}=await supabase.rpc('dietforge_portal_memberships');if(error)throw new Error('No se pudo consultar el acceso al portal.');return data??[];}
export async function readPortal(owner:string,client:number):Promise<PortalData>{const {data,error}=await supabase.rpc('dietforge_portal_read',{o:owner,c:client});if(error)throw new Error('No se pudo cargar el expediente compartido. Verifica tu acceso.');return data;}
export async function writeActivity(owner:string,client:number,activity:Activity){const {error}=await supabase.rpc('dietforge_activity_save',{o:owner,c:client,i:activity.id,k:activity.kind,d:activity.data});if(error)throw new Error('No se pudo guardar. Revisa los valores y tu acceso; tus cambios siguen en pantalla.');}
export async function grantPortal(client:number,email:string,enabled:boolean){const {error}=await supabase.rpc('dietforge_portal_grant',{c:client,mail:email.trim().toLowerCase(),enabled});if(error)throw new Error('No se pudo actualizar el acceso del cliente. Guarda primero el expediente.');}
