"use client";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { clearStoredEmail } from "@/lib/subscription";
import { checkSubscription, type SubscriptionStatus } from "@/lib/supabase";
import { useToast } from "@/components/Toast";

interface AccessContext {
  email: string; status: SubscriptionStatus; loading: boolean; error: string;
  trialActive: boolean; trialDaysLeft: number; trialEndDate: string;
  refresh: () => Promise<void>; logout: () => Promise<void>;
}
const Context = createContext<AccessContext | null>(null);
export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<SubscriptionStatus>({ active:false,status:null,expiresAt:null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState(0);
  const refresh = useCallback(async () => {
    try { const next = await checkSubscription(); setStatus(next);setCheckedAt(Date.now()); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo verificar el acceso."); setStatus({ active:false,status:null,expiresAt:null }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let live = true;
    const recheck = async () => {
      try { const next = await checkSubscription(); if(live){setStatus(next);setCheckedAt(Date.now());setError("");} }
      catch(e){if(live){setError(e instanceof Error?e.message:"No se pudo verificar el acceso.");setStatus({active:false,status:null,expiresAt:null});}}
      finally{if(live)setLoading(false);}
    };
    void recheck();
    const focus = () => { if (!document.hidden) void recheck(); };
    window.addEventListener("focus",focus);document.addEventListener("visibilitychange",focus);
    const timer=setInterval(focus,60_000);
    return ()=>{live=false;clearInterval(timer);window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",focus);};
  }, []);
  const logout=useCallback(async()=>{
    try{await clearStoredEmail();}catch(e){toast(e instanceof Error?e.message:"No se pudo salir.","error");}
  },[toast]);
  const trialActive=status.status==="trialing";
  const trialDaysLeft=trialActive&&status.expiresAt?Math.max(0,Math.ceil((Date.parse(status.expiresAt)-checkedAt)/86400000)):0;
  return <Context.Provider value={{email:status.email??"",status,loading,error,trialActive,trialDaysLeft,trialEndDate:trialActive?status.expiresAt??"":"",refresh,logout}}>{children}</Context.Provider>;
}
export function useSubscription(){const ctx=useContext(Context);if(!ctx)throw new Error("Missing account provider");return ctx;}
