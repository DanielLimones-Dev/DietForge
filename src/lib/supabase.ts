import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Configura las variables públicas de Supabase.");
export const supabase = createClient(url, key);
export interface SubscriptionStatus {
  active: boolean;
  status: string | null;
  expiresAt: string | null;
  isAdmin?: boolean;
  email?: string;
  source?: string;
}
export function clearSubscriptionCache() { localStorage.removeItem("dietforge_sub_cache"); }
export async function checkSubscription(): Promise<SubscriptionStatus> {
  const { data, error } = await supabase.rpc("dietforge_my_access");
  if (error) throw new Error("No se pudo verificar tu acceso. Intenta de nuevo.");
  return data as SubscriptionStatus;
}
