"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Mail, Check, Leaf, LockKeyhole } from "lucide-react";
import { authErrorMessage } from "@/lib/auth-errors";
import { supabase } from "@/lib/supabase";

export function LoginScreen({admin=false}:{admin?:boolean}) {
 const [email,setEmail]=useState(admin?"tilabrona99@gmail.com":"");
 const [password,setPassword]=useState("");
 const [mode,setMode]=useState<"login"|"setup"|"recovery">("login");
 const [sent,setSent]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const [otherSession,setOtherSession]=useState(false);
 useEffect(()=>{
  if(!admin)return;
  let live=true;
  void supabase.auth.getSession().then(async({data})=>{
   if(!data.session)return;
   const result=await supabase.rpc("dietforge_is_admin");
   if(!live)return;
   if(!result.error&&result.data===true)window.location.replace("/admin");else setOtherSession(true);
  });
  return ()=>{live=false;};
 },[admin]);
 async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError("");
  try {
   const account=email.trim().toLowerCase();
   if(mode==="login"){
    const {error}=await supabase.auth.signInWithPassword({email:account,password});
    if(error)throw error;
    if(admin){const role=await supabase.rpc("dietforge_is_admin");if(role.error||role.data!==true){setOtherSession(true);return;}window.location.replace("/admin");}
   }else{
    const redirectTo=window.location.origin+"/auth/callback?next=password";
    const result=mode==="recovery"?await supabase.auth.resetPasswordForEmail(account,{redirectTo}):await supabase.auth.signInWithOtp({email:account,options:{shouldCreateUser:false,emailRedirectTo:redirectTo}});
    if(result.error)throw result.error;
    setSent(true);
   }
  }catch(error){setError(authErrorMessage(error));}
  finally{setBusy(false);}
 }
 return <div className="df-login">
  <section className="df-login-story">
   <Link href="/" className="df-wordmark"><span className="df-logo"><Leaf size={23}/></span>DietForge<span className="df-wordmark-tag">PRO</span></Link>
   <div className="df-login-copy"><p className="df-eyebrow">{admin?"CENTRO DE ADMINISTRACIÓN":"TU PRÁCTICA, MEJOR ORGANIZADA"}</p><h1>{admin?<>El control de tu<br/><em>plataforma.</em></>:<>Más claridad.<br/>Mejores <em>planes.</em></>}</h1>
   <p>{admin?"Gestiona tus coaches, sus periodos de acceso y cada renovación desde un solo lugar.":"Clientes, seguimiento y planificación nutricional en un espacio diseñado para tu trabajo diario."}</p>
   <div className="df-login-features">{(admin?["Altas de coaches","Periodos y renovaciones","Historial de administración"]:["Todos tus clientes en un lugar","Planes claros, seguimiento continuo","Tu espacio en cualquier dispositivo"]).map(t=><div key={t}><Check size={17}/>{t}</div>)}</div></div>
   <p className="df-login-footer">PRECISIÓN PARA TU TRABAJO DIARIO.</p>
  </section>
  <section className="df-login-form"><div className="w-full max-w-sm">
   <span className="df-icon">{admin?<ShieldCheck size={25}/>:<LockKeyhole size={25}/>}</span>
   <p className="df-eyebrow mt-7">{admin?"ACCESO EXCLUSIVO":"BIENVENIDO A DIETFORGE"}</p>
   <h2 className="text-3xl font-semibold tracking-tight mt-2">{sent?"Revisa tu correo":mode==="setup"?"Activa tu cuenta":mode==="recovery"?"Recupera tu contraseña":admin?"Acceso de administrador":"Inicia sesión"}</h2>
   <p className="df-muted mt-3 leading-relaxed">{sent?<>Si el correo <strong className="df-text">{email}</strong> está dado de alta, recibirás un enlace para {mode==="recovery"?"restablecer tu contraseña":"validarlo y crear tu contraseña"}.</>:mode==="login"?"Entra con tu correo y contraseña. No necesitas solicitar un enlace en cada acceso.":mode==="setup"?"Valida tu correo una sola vez y elige tu contraseña. Después entrarás directamente con ella.":"Te enviaremos un enlace para elegir una contraseña nueva."}</p>
   {otherSession?<div className="mt-6 space-y-4"><p className="df-notice">Hay otra cuenta abierta. Cierra esa sesión para entrar como administrador.</p><button className="df-button w-full" onClick={async()=>{const {error}=await supabase.auth.signOut();if(!error)setOtherSession(false);}}>Cambiar de cuenta</button></div>:
   <form onSubmit={submit} className="mt-8 space-y-5">
    {!sent&&<label className="df-label">Correo electrónico<input className="df-input mt-2" aria-label="Correo" type="email" autoComplete="email" placeholder="tu@correo.com" required readOnly={admin} value={email} onChange={e=>setEmail(e.target.value)}/></label>}
    {!sent&&mode==="login"&&<label className="df-label">Contraseña<input className="df-input mt-2" aria-label="Contraseña" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>}
    {sent?<div className="df-notice flex gap-3"><Mail size={20} className="shrink-0"/><span>Si no lo encuentras, revisa spam o correo no deseado. El enlace es de un solo uso.</span></div>:<button disabled={busy} className="df-button w-full justify-between">{busy?"Procesando…":mode==="login"?"Iniciar sesión":mode==="setup"?"Validar correo y crear contraseña":"Recuperar contraseña"}<ArrowRight size={18}/></button>}
    {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
    {sent&&<button type="button" className="df-button-secondary w-full" onClick={()=>{setSent(false);setError("");setMode("login");}}>Volver al acceso</button>}
    {!sent&&<div className="flex flex-col items-start gap-3 text-sm">{mode==="login"?<><button type="button" disabled={busy} className="text-brand-700 hover:underline" onClick={()=>{setMode("setup");setError("");setPassword("");}}>Primera vez: crear contraseña</button><button type="button" disabled={busy} className="df-muted hover:underline" onClick={()=>{setMode("recovery");setError("");setPassword("");}}>Olvidé mi contraseña</button></>:<button type="button" disabled={busy} className="text-brand-700 hover:underline" onClick={()=>{setMode("login");setError("");}}>Ya tengo contraseña: iniciar sesión</button>}</div>}
   </form>}
   <div className="mt-10 pt-6 border-t border-gray-200 text-sm df-muted">
    {admin?<Link href="/" className="df-login-route"><ArrowRight className="rotate-180" size={17}/><span><strong>Acceso para coaches</strong><small>Volver al inicio de sesión general</small></span></Link>:
    <Link href="/admin/login" className="df-login-route" aria-label="Ir al acceso exclusivo de administrador"><ShieldCheck size={20}/><span><strong>Acceso de administrador</strong><small>Gestionar coaches y periodos</small></span><ArrowRight size={17}/></Link>}
   </div>
  </div></section>
 </div>;
}
