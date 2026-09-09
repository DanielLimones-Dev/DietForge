"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { parseEmailAccess } from "@/lib/email-access";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function AuthCallback() {
  const router = useRouter();
  const attempt = useRef<Promise<string> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    attempt.current ??= (async () => {
      const url = new URL(window.location.href);
      if (url.searchParams.has("token_hash")) {
        const input = url.searchParams.get("type")==="recovery" ? {token_hash:url.searchParams.get("token_hash")!,type:"recovery" as const} : parseEmailAccess(url.href, "", process.env.NEXT_PUBLIC_SUPABASE_URL!, window.location.origin);
        // Remove the one-time credential from history immediately.
        window.history.replaceState(null, "", "/auth/callback");
        const { error } = await supabase.auth.verifyOtp(input);
        if (error) throw error;
      }
      // Supabase also handles standard email links with a session fragment.
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!data.session) throw new Error("El enlace no es válido o ya expiró. Solicita otro desde el inicio.");
      if(url.searchParams.get("next")==="password" || url.searchParams.get("type")==="recovery" || new URLSearchParams(url.hash.slice(1)).get("type")==="recovery")return url.searchParams.get("portal")==="1"?"/auth/password?portal=1":"/auth/password";
      if(url.searchParams.get("next")==="admin") {
        const role=await supabase.rpc("dietforge_is_admin");
        if(role.error||role.data!==true)throw new Error("Esta cuenta no tiene permiso de administrador.");
        return "/admin";
      }
      if(url.searchParams.get("next")==="portal")return "/portal";
      return "/";
    })();
    attempt.current.then(path => { if (live) router.replace(path); }).catch(error => {
      if (live) setError(error instanceof Error ? error.message : "No se pudo verificar el acceso.");
    });
    return () => { live = false; };
  }, [router]);
  if (!error) return <LoadingScreen />;
  return <div role="alert" className="min-h-screen grid place-content-center gap-4 p-6">
    <p>{error}</p><Link href="/" className="text-brand-600 underline">Volver al inicio</Link>
  </div>;
}
