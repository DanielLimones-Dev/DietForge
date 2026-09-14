'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {memberships,type PortalMembership} from '@/lib/client-portal';
import {ClientCare} from './ClientCare';
import {NumericInputNormalizer} from './NumericInputNormalizer';
import {PortalAuth} from './PortalAuth';
export function ClientPortal(){
 const [user,setUser]=useState<string|null|undefined>(undefined);const [entries,setEntries]=useState<PortalMembership[]>([]);const [selected,setSelected]=useState('');const [message,setMessage]=useState('');const [dark,setDark]=useState(false);
 const identity=useRef<string|null|undefined>(undefined);
 useEffect(()=>{const {data}=supabase.auth.onAuthStateChange((_event,session)=>{const next=session?.user.id??null;if(identity.current!==next){identity.current=next;setEntries([]);setSelected('');setMessage('');setUser(next);}});return ()=>data.subscription.unsubscribe();},[]);
 useEffect(()=>{if(!user)return;let live=true;void memberships().then(rows=>{if(live)setEntries(rows.filter(r=>r.enabled));}).catch(e=>{if(live)setMessage(e.message);});return ()=>{live=false;};},[user]);
 const entry=entries.find(e=>e.owner_id+':'+e.client_id===selected)??entries[0];
 return <div className={dark?'dark':''}><div className="care-portal"><NumericInputNormalizer/><header className="care-heading"><strong>DietForge · Portal del cliente</strong><div><button onClick={()=>setDark(!dark)}>{dark?'Modo claro':'Modo oscuro'}</button>{user&&<button onClick={()=>void supabase.auth.signOut()}>Cerrar sesión</button>}</div></header>
 {user===undefined?<p>Verificando sesión…</p>:!user?<PortalAuth/>:entry?<><label className="care-client-picker">Mi expediente<select value={entry.owner_id+':'+entry.client_id} onChange={e=>setSelected(e.target.value)}>{entries.map(e=><option key={e.owner_id+':'+e.client_id} value={e.owner_id+':'+e.client_id}>{e.name}</option>)}</select></label><ClientCare key={entry.owner_id+':'+entry.client_id} owner={entry.owner_id} clientId={entry.client_id}/></>:<section className="care-card"><h1>Tu sesión está lista</h1><p>Aún no hay un expediente autorizado para este correo. Tu coach puede habilitarlo desde Seguimiento y portal.</p><button onClick={()=>{const requestedUser=user;void memberships().then(rows=>{if(identity.current===requestedUser)setEntries(rows.filter(row=>row.enabled));}).catch(e=>{if(identity.current===requestedUser)setMessage(e.message);});}}>Consultar acceso</button></section>}{message&&<p role="status">{message}</p>}</div></div>;
}
