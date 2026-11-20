'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {ShieldCheck,UserRound} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {memberships,type PortalMembership} from '@/lib/client-portal';
import {ClientCare} from './ClientCare';
import {NumericInputNormalizer} from './NumericInputNormalizer';
import {PortalAuth} from './PortalAuth';
import {AccountPrivacy} from './AccountPrivacy';
import {PortalTopBar} from './portal/PortalParts';
import {PortalRippleEffect} from './portal/PortalRippleEffect';
export function ClientPortal(){
 const router=useRouter();
 useEffect(()=>{router.prefetch('/');},[router]);
 const [user,setUser]=useState<string|null|undefined>(undefined);const [entries,setEntries]=useState<PortalMembership[]>([]);const [selected,setSelected]=useState('');const [message,setMessage]=useState('');const [dark,setDark]=useState(false);
 const [signingOut,setSigningOut]=useState(false);const logoutPending=useRef(false);
 async function logout(){
  if(logoutPending.current)return;logoutPending.current=true;setSigningOut(true);setMessage('');
  try{const {error}=await supabase.auth.signOut();if(error)throw error;router.replace('/');}
  catch{logoutPending.current=false;setSigningOut(false);setMessage('No se pudo cerrar la sesión. Intenta de nuevo.');}
 }
 const identity=useRef<string|null|undefined>(undefined);
 useEffect(()=>{const {data}=supabase.auth.onAuthStateChange((_event,session)=>{const next=session?.user.id??null;if(identity.current!==next){identity.current=next;setEntries([]);setSelected('');setMessage('');setUser(next);}});return ()=>data.subscription.unsubscribe();},[]);
 useEffect(()=>{if(!user)return;let live=true;void memberships().then(rows=>{if(live)setEntries(rows.filter(r=>r.enabled));}).catch(e=>{if(live)setMessage(e.message);});return ()=>{live=false;};},[user]);
 const entry=entries.find(e=>e.owner_id+':'+e.client_id===selected)??entries[0];
 return <div className={dark?'dark':''}><div className="care-portal portal-app">
  <PortalRippleEffect/>
  <NumericInputNormalizer/>
  <PortalTopBar dark={dark} onDark={()=>setDark(!dark)} signedIn={!!user} onLogout={()=>void logout()} signingOut={signingOut}/>
  {user&&<details className="care-privacy-details portal-privacy-details"><summary><ShieldCheck size={16} aria-hidden="true"/>Privacidad y mis datos</summary><AccountPrivacy context="portal"/></details>}
  {user===undefined?<div className="portal-loading" role="status"><span className="portal-loading-dot"/><p>Verificando tu sesión…</p></div>
  :!user?(signingOut?<div className="portal-loading" role="status"><span className="portal-loading-dot"/><p>Cerrando sesión…</p></div>:<PortalAuth/>)
  :entry?<>
   {entries.length>1&&<label className="care-client-picker portal-client-picker"><span className="portal-kicker">Expediente</span><select value={entry.owner_id+':'+entry.client_id} onChange={e=>setSelected(e.target.value)}>{entries.map(e=><option key={e.owner_id+':'+e.client_id} value={e.owner_id+':'+e.client_id}>{e.name}</option>)}</select></label>}
   <ClientCare key={entry.owner_id+':'+entry.client_id} owner={entry.owner_id} clientId={entry.client_id}/>
  </>
  :<section className="care-card portal-section portal-waiting">
    <span className="portal-empty-icon" aria-hidden="true"><UserRound size={26}/></span>
    <h1>Tu sesión está lista</h1>
    <p>Aún no hay un expediente autorizado para este correo. Tu coach puede habilitarlo desde Seguimiento y portal.</p>
    <button type="button" className="portal-button portal-button-primary" onClick={()=>{const requestedUser=user;void memberships().then(rows=>{if(identity.current===requestedUser)setEntries(rows.filter(row=>row.enabled));}).catch(e=>{if(identity.current===requestedUser)setMessage(e.message);});}}>Consultar acceso</button>
    <p className="portal-auth-note">Si acabas de recibir el enlace, pide a tu coach que confirme el mismo correo con el que entraste.</p>
  </section>}
  {message&&<p role="status" className="care-notice">{message}</p>}
 </div></div>;
}
