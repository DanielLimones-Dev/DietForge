'use client';
import {useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {supabase} from '@/lib/supabase';
import {authErrorMessage} from '@/lib/auth-errors';

type Mode='signup'|'login'|'recovery';
export function PortalAuth(){
 const [mode,setMode]=useState<Mode>('signup');
 const [step,setStep]=useState<1|2|3>(1);
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');
 const [busy,setBusy]=useState(false);const locked=useRef(false);
 const [error,setError]=useState('');const [sent,setSent]=useState(false);const [sessionReady,setSessionReady]=useState(false);
 function changeMode(next:Mode){if(locked.current)return;setMode(next);setStep(1);setPassword('');setConfirm('');setError('');setSent(false);}
 async function submit(event:FormEvent){
  event.preventDefault();if(locked.current)return;setError('');
  const mail=email.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)){setError('Escribe un correo válido.');return;}
  setEmail(mail);
  if(mode==='signup'&&step===1){setStep(2);return;}
  if(mode==='signup'&&(password.length<12||password.length>128)){setError('Tu contraseña debe tener entre 12 y 128 caracteres.');return;}
  if(mode==='signup'&&password!==confirm){setError('Las contraseñas no coinciden.');return;}
  if(mode==='login'&&!password){setError('Escribe tu contraseña.');return;}
  locked.current=true;setBusy(true);
  try{
   if(mode==='signup'){
    const {data,error}=await supabase.auth.signUp({email:mail,password,options:{emailRedirectTo:window.location.origin+'/auth/callback?next=portal'}});
    if(error)throw error;setSessionReady(!!data.session);setStep(3);
   }else if(mode==='login'){
    const {error}=await supabase.auth.signInWithPassword({email:mail,password});if(error)throw error;
   }else{
    const {error}=await supabase.auth.resetPasswordForEmail(mail,{redirectTo:window.location.origin+'/auth/callback?next=password&portal=1'});if(error)throw error;setSent(true);
   }
  }catch(reason){setError(authErrorMessage(reason));}
  finally{setPassword('');setConfirm('');locked.current=false;setBusy(false);}
 }
 const completed=mode==='signup'&&step===3;
 return <section className="care-card care-login care-onboarding" aria-labelledby="portal-auth-title">
  <h1 id="portal-auth-title">{mode==='signup'?'Activa tu acceso':mode==='login'?'Iniciar sesión':'Recuperar contraseña'}</h1>
  {mode==='signup'&&<ol className="care-onboarding-steps" aria-label="Pasos para activar tu acceso">{['Correo','Contraseña','Confirmación'].map((label,index)=><li key={label} aria-current={step===index+1?'step':undefined}><span>{index+1}</span>{label}</li>)}</ol>}
  {completed?<div className="care-stack" role="status"><h2>{sessionReady?'Tu sesión está lista':'Confirma tu correo y listo'}</h2><p>{sessionReady?'Tu cuenta ya tiene una sesión activa. Estamos abriendo tu portal.':<>Revisa <strong>{email}</strong>. Si tu cuenta necesita confirmación, recibirás un mensaje: pulsa su enlace para entrar a tu portal.</>}</p>{!sessionReady&&<p>Si no lo encuentras, revisa Spam o Correo no deseado. Si ese correo ya tiene cuenta, inicia sesión o recupera tu contraseña.</p>}<p>Tu coach debe autorizar ese mismo correo para que veas tu dieta y rutina.</p><div className="care-onboarding-actions"><Link href="/">Ir a iniciar sesión</Link></div></div>:sent?<div className="care-stack" role="status"><h2>Revisa tu correo</h2><p>Si existe una cuenta con <strong>{email}</strong>, recibirás un enlace para cambiar tu contraseña.</p><Link href="/">Volver al inicio de sesión</Link></div>:<>
   <p>{mode==='signup'?(step===1?'Escribe el correo validado con tu coach.':'Crea una contraseña para entrar a tu dieta, rutina y progreso.'):mode==='login'?'Entra con el correo que autorizó tu coach.':'Te enviaremos un enlace para recuperar el acceso.'}</p>
   <form className="care-stack" onSubmit={submit}>
    {(mode!=='signup'||step===1)?<label>Correo<input required type="email" autoComplete="email" value={email} disabled={busy} onChange={event=>setEmail(event.target.value)}/></label>:<p>Correo: <strong>{email}</strong></p>}
    {(mode==='login'||mode==='signup'&&step===2)&&<label>Contraseña<input required type="password" minLength={mode==='signup'?12:1} maxLength={128} autoComplete={mode==='signup'?'new-password':'current-password'} value={password} disabled={busy} onChange={event=>setPassword(event.target.value)}/></label>}
    {mode==='signup'&&step===2&&<><small>Usa al menos 12 caracteres.</small><label>Confirmar contraseña<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={confirm} disabled={busy} onChange={event=>setConfirm(event.target.value)}/></label></>}
    {error&&<p role="alert">{error}</p>}
    <button type="submit" disabled={busy}>{busy?'Procesando…':mode==='signup'?(step===1?'Continuar':'Crear cuenta y enviar confirmación'):mode==='login'?'Entrar':'Enviar enlace de recuperación'}</button>
   </form>
   <div className="care-onboarding-actions">{mode==='signup'&&step===2&&<button type="button" disabled={busy} onClick={()=>{setStep(1);setPassword('');setConfirm('');setError('');}}>Cambiar correo</button>}{mode==='signup'?<Link href="/">Ya tengo cuenta</Link>:<button type="button" disabled={busy} onClick={()=>changeMode('signup')}>Primera vez: activar acceso</button>}{mode!=='recovery'&&<button type="button" disabled={busy} onClick={()=>changeMode('recovery')}>Olvidé mi contraseña</button>}{mode==='recovery'&&<Link href="/">Volver al inicio de sesión</Link>}</div>
  </>}
 </section>;
}
