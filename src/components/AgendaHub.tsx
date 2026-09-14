'use client';
import {useMemo,useState} from 'react';
import {Search} from 'lucide-react';
import {db} from '@/lib/db';
import {ClientCare} from './ClientCare';
const normalized=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-MX').trim();
export function AgendaHub(){
 const clients=db.getClients();const [client,setClient]=useState(clients[0]?.id??0);const [query,setQuery]=useState('');
 const visible=useMemo(()=>{const term=normalized(query);return term?clients.filter(c=>normalized(c.name).includes(term)):clients;},[clients,query]);
 const activeClient=visible.some(c=>c.id===client)?client:(visible[0]?.id??0);
 return <div className="care-page"><section className="care-card agenda-intro"><div><span className="training-kicker">AGENDA DEL COACH</span><h1>¿Qué toca hoy con cada cliente?</h1><p>Consulta las fechas de Peak Week y check-ins de cada cliente, con sus pendientes y avances.</p></div><div className="agenda-client-picker"><span>PASO 1 · BUSCA Y ELIGE AL CLIENTE</span><label className="agenda-client-search"><Search size={15}/><input aria-label="Buscar cliente por nombre" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por nombre…"/></label><select aria-label="Cliente de la agenda" value={activeClient} disabled={!visible.length} onChange={e=>setClient(Number(e.target.value))}>{visible.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>{query&&!visible.length&&<small>No encontramos clientes con ese nombre.</small>}</div><div className="agenda-guide"><article><b>1</b><div><strong>Busca un cliente</strong><p>Escribe su nombre y selecciónalo para ver su seguimiento.</p></div></article><article><b>2</b><div><strong>Selecciona un día</strong><p>Consulta la Peak Week y los check-ins de esa fecha.</p></div></article><article><b>3</b><div><strong>Revisa el seguimiento</strong><p>Identifica qué está pendiente, atrasado o completado.</p></div></article></div></section>{activeClient>0?<ClientCare key={activeClient} clientId={activeClient} coach initialTab="agenda" showAccess={false} agendaOnly/>:<section className="care-card agenda-empty"><strong>{clients.length?'Sin coincidencias':'Primero registra un cliente'}</strong><p>{clients.length?'Cambia la búsqueda para seleccionar otro cliente.':'Cuando exista un cliente, su agenda aparecerá aquí.'}</p></section>}</div>;
}
