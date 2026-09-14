"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Mail, Check, Leaf, LockKeyhole } from "lucide-react";
import { authErrorMessage } from "@/lib/auth-errors";
import { destinationForRole } from "@/lib/auth-role";
import { memberships } from "@/lib/client-portal";
import { supabase } from "@/lib/supabase";

export function LoginScreen() {
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [mode,setMode]=useState<"login"|"recovery">("login");
 const [sent,setSent]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError("");
  try {
   const account=email.trim().toLowerCase();
   if(mode==="login"){
    const {error}=await supabase.auth.signInWithPassword({email:account,password});
    if(error)throw error;
    const role=await supabase.rpc("dietforge_is_admin");
    const destination=destinationForRole(role);
    const entries=destination==="/admin"?[]:await memberships();
    window.location.replace(entries.some(entry=>entry.enabled)?"/portal":destination);
   }else{
    const redirectTo=window.location.origin+"/auth/callback?next=password";
    const result=await supabase.auth.resetPasswordForEmail(account,{redirectTo});
    if(result.error)throw result.error;
    setSent(true);
   }
  }catch(error){setError(authErrorMessage(error));}
  finally{setBusy(false);}
 }
 return <div className="df-login">
  <section className="df-login-story">
   <Link href="/" className="df-wordmark"><span className="df-logo"><Leaf size={23}/></span>DietForge<span className="df-wordmark-tag">PRO</span></Link>
   <div className="df-login-copy"><p className="df-eyebrow">TU PRÁCTICA, MEJOR ORGANIZADA</p><h1>Más claridad.<br/>Mejores <em>planes.</em></h1>
   <p>Clientes, seguimiento y planificación nutricional en un espacio diseñado para tu trabajo diario.</p>
   <div className="df-login-features">{["Todos tus clientes en un lugar","Planes claros, seguimiento continuo","Tu espacio en cualquier dispositivo"].map(t=><div key={t}><Check size={17}/>{t}</div>)}</div></div>
   <p className="df-login-footer">PRECISIÓN PARA TU TRABAJO DIARIO.</p>
  </section>
  <section className="df-login-form"><div className="w-full max-w-sm">
   <span className="df-icon"><LockKeyhole size={25}/></span>
   <p className="df-eyebrow mt-7">BIENVENIDO A DIETFORGE</p>
   <h2 className="text-3xl font-semibold tracking-tight mt-2">{sent?"Revisa tu correo":mode==="recovery"?"Recupera tu contraseña":"Inicia sesión"}</h2>
   <p className="df-muted mt-3 leading-relaxed">{sent?<>Si el correo <strong className="df-text">{email}</strong> está dado de alta, recibirás un enlace para restablecer tu contraseña.</>:mode==="login"?"Entra con tu correo y contraseña. Abriremos el espacio autorizado para tu cuenta.":"Te enviaremos un enlace para elegir una contraseña nueva."}</p>
   <form onSubmit={submit} className="mt-8 space-y-5">
    {!sent&&<label className="df-label">Correo electrónico<input className="df-input mt-2" aria-label="Correo" type="email" autoComplete="email" placeholder="tu@correo.com" required value={email} onChange={e=>setEmail(e.target.value)}/></label>}
    {!sent&&mode==="login"&&<label className="df-label">Contraseña<input className="df-input mt-2" aria-label="Contraseña" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>}
    {sent?<div className="df-notice flex gap-3"><Mail size={20} className="shrink-0"/><span>Si no lo encuentras, revisa spam o correo no deseado. El enlace es de un solo uso.</span></div>:<button disabled={busy} className="df-button w-full justify-between">{busy?"Procesando…":mode==="login"?"Iniciar sesión":"Recuperar contraseña"}<ArrowRight size={18}/></button>}
    {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
    {sent&&<button type="button" className="df-button-secondary w-full" onClick={()=>{setSent(false);setError("");setMode("login");}}>Volver al acceso</button>}
    {!sent&&<div className="flex flex-col items-start gap-3 text-sm">{mode==="login"?<button type="button" disabled={busy} className="df-muted hover:underline" onClick={()=>{setMode("recovery");setError("");setPassword("");}}>Olvidé mi contraseña</button>:<button type="button" disabled={busy} className="text-brand-700 hover:underline" onClick={()=>{setMode("login");setError("");}}>Ya tengo contraseña: iniciar sesión</button>}</div>}
   </form>
  </div></section>
 </div>;
}
