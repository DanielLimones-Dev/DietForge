'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {ClipboardList,BookOpen} from 'lucide-react';
import {db} from '@/lib/db';
import {supabase} from '@/lib/supabase';
import {DietMenus} from './DietMenus';
import {tabKeys} from './shared';
export function DietTabs({children,menus}:{children:ReactNode;menus:ReactNode}){
 const [tab,setTab]=useState<'plan'|'menus'>('plan');
 return <div className="dm-diet-workspace"><nav className="dm-diet-tabs" aria-label="Apartados de dieta" role="tablist" onKeyDown={tabKeys}><button role="tab" id="dm-plan-tab" aria-controls="dm-plan-content" aria-selected={tab==='plan'} tabIndex={tab==='plan'?0:-1} onClick={()=>setTab('plan')}><ClipboardList size={18}/>Plan de alimentación</button><button role="tab" id="dm-menus-tab" aria-controls="dm-menus-content" aria-selected={tab==='menus'} tabIndex={tab==='menus'?0:-1} onClick={()=>setTab('menus')}><BookOpen size={18}/>Menús y recetas</button></nav>
 <div role="tabpanel" id="dm-plan-content" aria-labelledby="dm-plan-tab" hidden={tab!=='plan'}>{children}</div>
 <div role="tabpanel" id="dm-menus-content" aria-labelledby="dm-menus-tab" hidden={tab!=='menus'}>{menus}</div></div>;
}
function AvailableMenus({clientId,clientName}:{clientId:number;clientName:string}){
 const [status,setStatus]=useState<'loading'|'ready'|'unavailable'>(process.env.NODE_ENV==='development'?'ready':'loading');
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
  if(process.env.NODE_ENV==='development')return;
  let active=true;
  void (async()=>{try{const {data,error}=await supabase.auth.getUser();if(error||!data.user)throw new Error('Session unavailable');const response=await supabase.rpc('dietforge_menus_read',{o:data.user.id,c:clientId});if(response.error)throw response.error;if(active)setStatus('ready');}catch{if(active)setStatus('unavailable');}})();
  return()=>{active=false;};
 },[clientId,attempt]);
 if(status==='ready')return <DietMenus clientId={clientId} clientName={clientName}/>;
 return <section className="dm-workspace" role="status"><p>{status==='loading'?'Comprobando disponibilidad de menús…':'Menús y recetas no está disponible todavía. Tu plan de alimentación sigue disponible.'}</p>{status==='unavailable'&&<button className="dm-secondary" onClick={()=>{setStatus('loading');setAttempt(n=>n+1);}}>Reintentar</button>}</section>;
}
export function DietWorkspace({clientId,children}:{clientId:number;children:ReactNode}){
 const client=db.getClient(clientId);
 if(!client)return <p>Cliente no disponible.</p>;
 return <DietTabs menus={<AvailableMenus key={clientId} clientId={clientId} clientName={client.name}/>}>{children}</DietTabs>;
}
