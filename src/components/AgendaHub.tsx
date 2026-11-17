'use client';
import {useMemo,useState} from 'react';
import {revealFocusedCascade} from '@/lib/page-cascade';
import {Search} from 'lucide-react';
import {db} from '@/lib/db';
import {ClientCare} from './ClientCare';
const normalized=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-MX').trim();
export function AgendaHub(){
 const clients=db.getClients();const [client,setClient]=useState(clients[0]?.id??0);const [query,setQuery]=useState('');
 const visible=useMemo(()=>{const term=normalized(query);return term?clients.filter(c=>normalized(c.name).includes(term)):clients;},[clients,query]);
 const activeClient=visible.some(c=>c.id===client)?client:(visible[0]?.id??0);
 return <div className="care-page" data-page-cascade onFocusCapture={revealFocusedCascade}><section className="care-card agenda-intro" data-cascade="0"><div><span className="training-kicker">AGENDA DEL COACH</span><h1>Citas y seguimiento por cliente</h1><p>Elige un cliente para ver sus citas, su Peak Week y sus check-ins. El cliente solicita citas desde su portal.</p></div><div className="agenda-client-picker"><label className="agenda-client-search"><Search size={15} aria-hidden="true"/><input aria-label="Buscar cliente por nombre" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar por nombre…"/></label><select aria-label="Cliente de la agenda" value={activeClient} disabled={!visible.length} onChange={event=>setClient(Number(event.target.value))}>{visible.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>{query&&!visible.length&&<small>No encontramos clientes con ese nombre.</small>}</div></section>{activeClient>0?<ClientCare key={activeClient} clientId={activeClient} coach initialTab="agenda" showAccess={false} agendaOnly/>:<section className="care-card agenda-empty"><strong>{clients.length?'Sin coincidencias':'Primero registra un cliente'}</strong><p>{clients.length?'Cambia la búsqueda para seleccionar otro cliente.':'Cuando exista un cliente, su agenda aparecerá aquí.'}</p></section>}</div>;
}
