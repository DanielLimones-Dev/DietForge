import { supabase } from '@/lib/supabase';
import { validateSnapshot, type Snapshot } from './model';
export interface RemoteState { revision: number; snapshot: Snapshot; }
async function accountAuthorization(ownerId: string): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || data.session?.user.id !== ownerId) throw new Error('La cuenta cambió. Vuelve a abrir tus datos.');
  return `Bearer ${data.session.access_token}`;
}
export async function readRemote(ownerId: string): Promise<RemoteState | null> {
  const authorization = await accountAuthorization(ownerId);
  const {data,error}=await supabase.rpc('dietforge_load').setHeader('Authorization', authorization);
  if (error) throw new Error('No se pudo cargar Supabase. '+error.message);
  if (!data) return null;
  return {revision:data.revision,snapshot:validateSnapshot(data.snapshot)};
}
export async function writeRemote(snapshot: Snapshot, revision: number, mutationId: string, ownerId: string): Promise<number> {
  const authorization = await accountAuthorization(ownerId);
  const {data,error}=await supabase.rpc('dietforge_save',{p_snapshot:snapshot,p_expected_revision:revision,p_mutation_id:mutationId}).setHeader('Authorization', authorization);
  if (error) {
    if (error.message.includes('DIETFORGE_CONFLICT')) throw new Error('Otro dispositivo modificó tus datos. Descarga el respaldo pendiente y vuelve a cargar antes de continuar.');
    throw new Error('No se guardó en Supabase. '+error.message);
  }
  return Number(data);
}
