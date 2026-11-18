'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Sparkles,X} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {useAutoRefresh} from '@/lib/use-auto-refresh';
import {NotificationBell} from '@/components/ui/notification-bell';
import {openSystemUpdateModal,useSystemUpdateStatus} from './SystemUpdateNotice';
import {SHELL_COPY,useAppLanguage} from '@/lib/language';
interface Notification {client_id:number;activity_id:string;client_name:string;created_at:string;read_at:string|null}
interface Inbox {unread:number;items:Notification[]}
export function CoachNotifications(){
 const [inbox,setInbox]=useState<Inbox>({unread:0,items:[]});const [open,setOpen]=useState(false);const panel=useRef<HTMLDivElement>(null);
 const update=useSystemUpdateStatus();
 const {lang}=useAppLanguage();
 const t=SHELL_COPY[lang];
 const read=useCallback(async()=>{const {data,error}=await supabase.rpc('dietforge_notifications_read');if(error)throw error;return data as Inbox;},[]);
 const apply=useCallback((data:Inbox)=>setInbox(data),[]);const failed=useAutoRefresh(read,apply);
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node))setOpen(false);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);panel.current?.querySelector('button')?.focus();}};document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);};},[open]);
 const totalUnread=inbox.unread+(update.unread?1:0);
 return <div className="coach-notifications" ref={panel}><NotificationBell count={totalUnread} aria-label={`${t.notifications}${totalUnread?`, ${totalUnread} ${t.unreadLabel}`:''}`} aria-expanded={open} aria-controls="coach-inbox" onClick={()=>setOpen(v=>!v)}/>{open&&<section id="coach-inbox" className="notification-panel" aria-label={t.notifications}><header><strong>{t.notifications}</strong><button aria-label={t.closeNotifications} onClick={()=>setOpen(false)}><X size={18}/></button></header><button type="button" className={`notification-update-item ${update.unread?'unread':''}`.trim()} onClick={()=>{setOpen(false);openSystemUpdateModal();}}><span className="notification-update-icon"><Sparkles size={14}/></span><span><strong>{t.systemUpdatedItem} · v{update.latest.version}</strong><small>{lang==='en'?update.latest.titleEn:update.latest.title}</small>{update.unread&&<em>{t.newUpdateBadge}</em>}</span></button>{failed&&<p role="status">{t.syncError}</p>}{!failed&&!inbox.items.length&&<p>{t.noClientNotifications}</p>}<div>{inbox.items.map(n=><Link key={`${n.client_id}-${n.activity_id}`} href={`/clients/${n.client_id}/care?tab=progress&checkin=${n.activity_id}`} className={n.read_at?'':'unread'} onClick={()=>setOpen(false)}><strong>{n.client_name}</strong><span>{t.newCheckIn}</span><time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString(lang==='en'?'en-US':'es-MX',{dateStyle:'medium',timeStyle:'short'})}</time>{!n.read_at&&<small>{t.unreadBadge}</small>}</Link>)}</div></section>}</div>;
}
