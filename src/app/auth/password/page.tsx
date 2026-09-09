"use client";
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { LockKeyhole } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authErrorMessage } from '@/lib/auth-errors';

export default function PasswordPage(){
 const [email,setEmail]=useState(''),[loading,setLoading]=useState(true),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let live=true;void supabase.auth.getUser().then(({data,error})=>{if(!live)return;if(!error&&data.user?.email_confirmed_at)setEmail(data.user.email??'');setLoading(false);}).catch(()=>{if(live){setError('No pudimos verificar la sesión. Abre de nuevo el enlace de tu correo.');setLoading(false);}});return ()=>{live=false;};},[]);
 async function submit(event:FormEvent){
  event.preventDefault();setError('');
  if(password.length<12){setError('Usa al menos 12 caracteres.');return;}
  if(password!==confirmation){setError('Las contraseñas no coinciden.');return;}
  setBusy(true);
  try{
   const {error}=await supabase.auth.updateUser({password});if(error)throw error;
   setPassword('');setConfirmation('');
   const role=await supabase.rpc('dietforge_is_admin');
   window.location.replace(new URLSearchParams(window.location.search).get('portal')==='1'?'/portal':!role.error&&role.data===true?'/admin':'/');
  }catch(e){setError(authErrorMessage(e));}finally{setBusy(false);}
 }
 return <div className="access-pending"><section className="df-card w-full"><span className="df-icon"><LockKeyhole size={24}/></span><h1 className="text-2xl font-semibold mt-6">Crea tu contraseña</h1>{loading?<p className="df-muted mt-4">Verificando tu correo…</p>:email?<><p className="df-muted text-sm mt-3">Correo validado: <strong>{email}</strong>. A partir de ahora entrarás con tu contraseña.</p><form onSubmit={submit} className="space-y-5 mt-6"><label className="df-label">Nueva contraseña<input required type="password" autoComplete="new-password" minLength={12} maxLength={128} disabled={busy} className="df-input mt-2" value={password} onChange={e=>setPassword(e.target.value)}/></label><p className="df-muted text-xs">Al menos 12 caracteres. Puedes usar una frase larga que recuerdes.</p><label className="df-label">Repite tu contraseña<input required type="password" autoComplete="new-password" minLength={12} maxLength={128} disabled={busy} className="df-input mt-2" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label><button disabled={busy} className="df-button w-full">{busy?'Guardando…':'Guardar contraseña y entrar'}</button></form></>:<p className="df-muted mt-4">Abre el enlace de validación o recuperación de tu correo para establecer la contraseña.</p>}{error&&<p role="alert" className="text-red-600 text-sm mt-4">{error}</p>}<Link href="/" className="inline-block text-brand-700 text-sm mt-6">Volver al inicio</Link></section></div>;
}
