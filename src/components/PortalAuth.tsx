'use client';
import {useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowRight,Check,KeyRound,Mail,ShieldCheck,Sparkles} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {authErrorMessage} from '@/lib/auth-errors';
import {PRIVACY_NOTICE_VERSION,signupPrivacyError} from '@/lib/privacy';
import {recordPrivacyConsent,syncConsentFromMetadata} from '@/lib/privacy-client';
import {PrivacyConsentField} from './PrivacyConsentField';

type Mode='signup'|'login'|'recovery';
export function PortalAuth(){
 const [mode,setMode]=useState<Mode>('signup');
 const [step,setStep]=useState<1|2|3>(1);
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');
 const [accepted,setAccepted]=useState(false);const [consentNote,setConsentNote]=useState('');
 const [busy,setBusy]=useState(false);const locked=useRef(false);
 const [error,setError]=useState('');const [sent,setSent]=useState(false);const [sessionReady,setSessionReady]=useState(false);
 function changeMode(next:Mode){if(locked.current)return;setMode(next);setStep(1);setPassword('');setConfirm('');setAccepted(false);setConsentNote('');setError('');setSent(false);}
 async function submit(event:FormEvent){
  event.preventDefault();if(locked.current)return;setError('');
  const mail=email.trim();
  if(mode==='signup'&&step===1){
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)){setError('Escribe un correo válido.');return;}
   setEmail(mail);setStep(2);return;
  }
  // El alta y el guardado del consentimiento comparten la misma validación.
  const signupError=mode==='signup'?signupPrivacyError({email:mail,password,confirmation:confirm,accepted}):null;
  if(signupError){setError(signupError);return;}
  if(mode==='signup')setEmail(mail);
  if(mode==='login'&&!password){setError('Escribe tu contraseña.');return;}
  locked.current=true;setBusy(true);
  try{
   if(mode==='signup'){
    const acceptedAt=new Date().toISOString();
    const {data,error}=await supabase.auth.signUp({email:mail,password,options:{emailRedirectTo:window.location.origin+'/auth/callback?next=portal',data:{privacy_notice_version:PRIVACY_NOTICE_VERSION,privacy_accepted_at:acceptedAt,privacy_source:'portal_signup'}}});
    if(error)throw error;setSessionReady(!!data.session);setStep(3);
    if(data.session){
     try{const stored=await recordPrivacyConsent('portal_signup');setConsentNote(stored?'Consentimiento registrado con fecha y versión del aviso.':'Consentimiento guardado en tu perfil.');}
     catch{setConsentNote('Tu consentimiento quedó en el perfil de acceso; lo sincronizaremos al confirmar tu correo.');}
    }else setConsentNote('Guardamos tu aceptación con la versión del aviso en el alta; se confirmará al validar tu correo.');
   }else if(mode==='login'){
    const {data,error}=await supabase.auth.signInWithPassword({email:mail,password});if(error)throw error;
    await syncConsentFromMetadata(data.user);
   }else{
    const {error}=await supabase.auth.resetPasswordForEmail(mail,{redirectTo:window.location.origin+'/auth/callback?next=password&portal=1'});if(error)throw error;
    setSent(true);
   }
  }catch(reason){setError(authErrorMessage(reason));}
  finally{setPassword('');setConfirm('');locked.current=false;setBusy(false);}
 }
 const completed=mode==='signup'&&step===3;
 const title=mode==='signup'?'Activa tu acceso':mode==='login'?'Entra a tu portal':'Recupera tu contraseña';
 return <section className="portal-auth">
  <div className="portal-auth-intro">
   <span className="portal-auth-badge"><Sparkles size={14} aria-hidden="true"/>Portal del cliente</span>
   <h2>Tu plan, en un solo lugar</h2>
   <p>Consulta tu dieta, tu rutina y tu progreso. Registra lo que comes y comparte tu avance con tu coach sin escribir mensajes.</p>
   <ul>{['Tu dieta del día con porciones claras','Tu rutina y los videos de tu coach','Tu check-in y tu historial de progreso'].map(item=><li key={item}><Check size={15} aria-hidden="true"/>{item}</li>)}</ul>
  </div>
  <section className="care-card care-login care-onboarding" aria-labelledby="portal-auth-title">
   <header className="portal-auth-head">
    <span className="portal-auth-icon" aria-hidden="true"><KeyRound size={20}/></span>
    <div><h1 id="portal-auth-title">{title}</h1><p>{mode==='signup'?'Solo necesitas el correo que autorizó tu coach.':mode==='login'?'Usa el correo que ya autorizó tu coach.':'Te enviaremos un enlace seguro para entrar.'}</p></div>
   </header>
   {mode==='signup'&&<ol className="care-onboarding-steps" aria-label="Pasos para activar tu acceso">{['Correo','Contraseña','Confirmación'].map((label,index)=><li key={label} aria-current={step===index+1?'step':undefined}><span>{step>index+1?<Check size={13}/>:index+1}</span>{label}</li>)}</ol>}
   {completed?<div className="care-stack portal-auth-status" role="status"><span className="portal-auth-status-icon" aria-hidden="true"><Mail size={22}/></span><h2>{sessionReady?'Tu sesión está lista':'Confirma tu correo y listo'}</h2><p>{sessionReady?'Tu cuenta ya tiene una sesión activa. Estamos abriendo tu portal.':<>Revisa <strong>{email}</strong>. Si tu cuenta necesita confirmación, recibirás un mensaje: pulsa su enlace para entrar a tu portal.</>}</p>{consentNote&&<p className="portal-auth-note">{consentNote}</p>}{!sessionReady&&<p>Si no lo encuentras, revisa Spam o Correo no deseado. Si ese correo ya tiene cuenta, inicia sesión o recupera tu contraseña.</p>}<p className="portal-auth-note">Tu coach debe autorizar ese mismo correo para que veas tu dieta y rutina.</p><div className="care-onboarding-actions"><Link className="portal-button" href="/">Ir a iniciar sesión<ArrowRight size={16}/></Link></div></div>
   :sent?<div className="care-stack portal-auth-status" role="status"><span className="portal-auth-status-icon" aria-hidden="true"><Mail size={22}/></span><h2>Revisa tu correo</h2><p>Si existe una cuenta con <strong>{email}</strong>, recibirás un enlace para cambiar tu contraseña.</p><Link className="portal-button" href="/">Volver al inicio de sesión</Link></div>
   :<>
    <p className="portal-auth-help">{mode==='signup'?(step===1?'Escribe el correo validado con tu coach.':'Crea una contraseña para entrar a tu dieta, rutina y progreso.'):mode==='login'?'Entra con el correo que autorizó tu coach.':'Te enviaremos un enlace para recuperar el acceso.'}</p>
    <form className="care-stack portal-auth-form" onSubmit={submit}>
     {(mode!=='signup'||step===1)?<label>Correo<input required type="email" autoComplete="email" inputMode="email" placeholder="tucorreo@ejemplo.com" aria-invalid={error?true:undefined} aria-describedby={error?'portal-auth-error':undefined} value={email} disabled={busy} onChange={event=>setEmail(event.target.value)}/></label>:<p className="portal-auth-chip">Correo: <strong>{email}</strong></p>}
     {(mode==='login'||mode==='signup'&&step===2)&&<label>Contraseña<input required type="password" minLength={mode==='signup'?12:1} maxLength={128} autoComplete={mode==='signup'?'new-password':'current-password'} aria-invalid={error?true:undefined} aria-describedby={error?'portal-auth-error':undefined} value={password} disabled={busy} onChange={event=>setPassword(event.target.value)}/></label>}
     {mode==='signup'&&step===2&&<><small className="portal-auth-hint">Usa al menos 12 caracteres.</small><label>Confirmar contraseña<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" aria-invalid={error?true:undefined} aria-describedby={error?'portal-auth-error':undefined} value={confirm} disabled={busy} onChange={event=>setConfirm(event.target.value)}/></label><PrivacyConsentField checked={accepted} onChange={setAccepted} disabled={busy} id="portal-privacy-consent"/></>}
     {error&&<p role="alert" id="portal-auth-error" className="portal-auth-error">{error}</p>}
     <button type="submit" className="portal-button portal-button-primary" disabled={busy||(mode==='signup'&&step===2&&!accepted)}>{busy?'Procesando…':mode==='signup'?(step===1?'Continuar':'Crear cuenta y enviar confirmación'):mode==='login'?'Entrar':'Enviar enlace de recuperación'}</button>
    </form>
    <div className="care-onboarding-actions portal-auth-actions">{mode==='signup'&&step===2&&<button type="button" disabled={busy} onClick={()=>{setStep(1);setPassword('');setConfirm('');setAccepted(false);setError('');}}>Cambiar correo</button>}{mode==='signup'?<Link href="/">Ya tengo cuenta</Link>:<button type="button" disabled={busy} onClick={()=>changeMode('signup')}>Primera vez: activar acceso</button>}{mode!=='recovery'&&<button type="button" disabled={busy} onClick={()=>changeMode('recovery')}>Olvidé mi contraseña</button>}{mode==='recovery'&&<Link href="/">Volver al inicio de sesión</Link>}</div>
    <p className="portal-auth-privacy"><ShieldCheck size={14} aria-hidden="true"/><Link href="/privacidad" target="_blank" rel="noopener noreferrer">Aviso de privacidad</Link></p>
   </>}
  </section>
 </section>;
}
