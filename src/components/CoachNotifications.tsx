'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Bell,X} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {useAutoRefresh} from '@/lib/use-auto-refresh';
interface Notification {client_id:number;activity_id:string;client_name:string;created_at:string;read_at:string|null}
interface Inbox {unread:number;items:Notification[]}
export function CoachNotifications(){
 const [inbox,setInbox]=useState<Inbox>({unread:0,items:[]});const [open,setOpen]=useState(false);const panel=useRef<HTMLDivElement>(null);
 const read=useCallback(async()=>{const {data,error}=await supabase.rpc('dietforge_notifications_read');if(error)throw error;return data as Inbox;},[]);
 const apply=useCallback((data:Inbox)=>setInbox(data),[]);const failed=useAutoRefresh(read,apply);
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node))setOpen(false);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);panel.current?.querySelector('button')?.focus();}};document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);};},[open]);
 return <div className="coach-notifications" ref={panel}><button type="button" className="notification-bell" aria-label={`Notificaciones${inbox.unread?`, ${inbox.unread} sin leer`:''}`} aria-expanded={open} aria-controls="coach-inbox" onClick={()=>setOpen(v=>!v)}><Bell size={20}/>{inbox.unread>0&&<b>{inbox.unread>99?'99+':inbox.unread}</b>}</button>{open&&<section id="coach-inbox" className="notification-panel" aria-label="Notificaciones"><header><strong>Notificaciones</strong><button aria-label="Cerrar notificaciones" onClick={()=>setOpen(false)}><X size={18}/></button></header>{failed&&<p role="status">No se pudo sincronizar. Reintentando automáticamente.</p>}{!failed&&!inbox.items.length&&<p>No tienes notificaciones nuevas.</p>}<div>{inbox.items.map(n=><Link key={`${n.client_id}-${n.activity_id}`} href={`/clients/${n.client_id}/care?tab=progress&checkin=${n.activity_id}`} className={n.read_at?'':'unread'} onClick={()=>setOpen(false)}><strong>{n.client_name}</strong><span>Envió un nuevo check-in</span><time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'})}</time>{!n.read_at&&<small>Sin leer</small>}</Link>)}</div></section>}</div>;
}
