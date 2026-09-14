'use client';

import { useEffect, useRef, useState } from 'react';
import type { PhotoAngle } from '@/types';
import type { Activity } from '@/lib/training-tracking';
import { writeActivity } from '@/lib/client-portal';
import { uploadCheckinPhoto, checkinPhotoUrl } from '@/lib/checkin-media';
import { adherenceFields, emptyPortalCheckIn, measurementFields, photoAngles, validatePortalCheckIn, wellbeingFields, type PortalCheckInDraft } from '@/lib/portal-checkin';

function PrivatePhoto({path,alt}:{path:string;alt:string}) {
 const [url,setUrl]=useState('');
 const [failed,setFailed]=useState(false);const retried=useRef(false);
 useEffect(()=>{let active=true;checkinPhotoUrl(path).then(value=>{if(active)setUrl(value);}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[path]);
 if(failed)return <span>No se pudo cargar la foto.</span>;
 if(!url)return <span>Cargando foto…</span>;
 // Signed private storage URLs are short-lived and should not pass through image optimization.
 // eslint-disable-next-line @next/next/no-img-element
 return <img src={url} onError={()=>{if(retried.current){setFailed(true);return;}retried.current=true;void checkinPhotoUrl(path).then(setUrl).catch(()=>setFailed(true));}} alt={alt} loading="lazy" style={{width:'100%',maxWidth:180,height:160,objectFit:'contain',borderRadius:12}}/>;
}

function History({activity,coach=false,targetId,onViewed}:{activity:Activity[];coach?:boolean;targetId?:string;onViewed?:(id:string)=>void|Promise<void>}) {
 const root=useRef<HTMLDivElement>(null);
 const viewed=useRef<string|null>(null);
 useEffect(()=>{
  if(!targetId){viewed.current=null;return;}
  if(viewed.current===targetId||!activity.some(a=>a.kind==='checkin'&&a.id===targetId))return;
  const details=Array.from(root.current?.querySelectorAll('details')??[]).find(el=>el.id===`checkin-${targetId}`);
  if(!details)return;
  details.open=true;
  details.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
  if(viewed.current!==targetId){viewed.current=targetId;void Promise.resolve(onViewed?.(targetId)).catch(()=>{if(viewed.current===targetId)viewed.current=null;});}
 },[activity,targetId,onViewed]);
 const records=activity.filter(a=>a.kind==='checkin').sort((a,b)=>String(b.data.date).localeCompare(String(a.data.date)));
 return <div className="care-stack" ref={root}><h3>{coach?'Check-ins del cliente':'Mis check-ins enviados'}</h3>{targetId&&!records.some(a=>a.id===targetId)&&<p role="status">No se encontró el check-in solicitado en los datos disponibles.</p>}{!records.length&&<p>{coach?'Este cliente aún no ha enviado check-ins.':'Aún no has enviado un check-in.'}</p>}{records.map(record=>{
 const d=record.data;
 const measures=d.measurements&&typeof d.measurements==='object'?d.measurements as Record<string,unknown>:{};
 const adherence=d.adherence&&typeof d.adherence==='object'?d.adherence as Record<string,unknown>:{};
 const photos=Array.isArray(d.photos)?d.photos.filter((p):p is {angle:PhotoAngle;path:string}=>!!p&&typeof p==='object'&&typeof p.path==='string'&&Object.prototype.hasOwnProperty.call(photoAngles,p.angle)):[];
 return <details className="care-inset" key={record.id} id={`checkin-${record.id}`}><summary>{String(d.date)} · {String(d.weight)} kg{typeof d.body_fat==='number'?` · ${d.body_fat}% grasa`:''}</summary><dl className="care-form">{Object.entries(measurementFields).filter(([k])=>typeof measures[k]==='number').map(([k,label])=><div key={k}><dt>{label}</dt><dd>{String(measures[k])} cm</dd></div>)}{Object.entries({...adherenceFields,...wellbeingFields}).filter(([k])=>typeof adherence[k]==='number').map(([k,label])=><div key={k}><dt>{label}</dt><dd>{String(adherence[k])}{k in wellbeingFields?' / 5':'%'}</dd></div>)}</dl>{typeof d.notes==='string'&&d.notes&&<p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{d.notes}</p>}<div className="care-form">{photos.map(p=><figure key={p.angle}><PrivatePhoto key={p.path} path={p.path} alt={photoAngles[p.angle]}/><figcaption>{photoAngles[p.angle]}</figcaption></figure>)}</div></details>;
 })}</div>;
}

interface PortalCheckInProps { owner:string;clientId:number;activity:Activity[];onSaved:()=>void;coach?:boolean;targetId?:string;onViewed?:(id:string)=>void|Promise<void> }
export function PortalCheckIn(props:PortalCheckInProps) {
 return <CheckInFields key={`${props.owner}:${props.clientId}`} {...props}/>;
}
function CheckInFields({owner,clientId,activity,onSaved,coach=false,targetId,onViewed}:PortalCheckInProps) {
 const [draft,setDraft]=useState<PortalCheckInDraft>(emptyPortalCheckIn);
 const attempt=useRef<string|null>(null);
 const pendingKey=`dietforge:checkin-attempt:${owner}:${clientId}`;
 const [recovered,setRecovered]=useState(false);
 useEffect(()=>{
  if(coach)return;
  // Restore external browser state after hydration; server rendering cannot read sessionStorage.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  try{const saved=sessionStorage.getItem(pendingKey);if(saved){const item=JSON.parse(saved) as {id:string;draft:PortalCheckInDraft};if(/^[a-f0-9-]{36}$/.test(item.id)&&validatePortalCheckIn(item.draft).data){attempt.current=item.id;setDraft(item.draft);setRecovered(true);}}}catch{/* A denied browser store must not prevent manual use. */}
 },[pendingKey,coach]);
 const lock=useRef(false);
 const [busy,setBusy]=useState(false);
 const [uploading,setUploading]=useState<PhotoAngle|null>(null);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const set=(key:'date'|'weight'|'notes',value:string)=>setDraft(d=>({...d,[key]:value}));
 async function upload(angle:PhotoAngle,file:File){
  if(lock.current)return;lock.current=true;setUploading(angle);setError('');
  try{const path=await uploadCheckinPhoto(owner,clientId,file);setDraft(d=>({...d,photos:[...d.photos.filter(p=>p.angle!==angle),{angle,path}]}));}
  catch(e){setError(e instanceof Error?e.message:'No se pudo subir la foto. Puedes intentarlo otra vez.');}
  finally{lock.current=false;setUploading(null);}
 }
 async function save(){
  if(lock.current)return;
  const result=validatePortalCheckIn(draft);setError('');setMessage('');
  if(!result.data){setError(result.errors.join(' '));return;}
  lock.current=true;setBusy(true);
  try{attempt.current??=crypto.randomUUID();try{sessionStorage.setItem(pendingKey,JSON.stringify({id:attempt.current,draft}));}catch{/* Retain the in-memory retry ID. */}await writeActivity(owner,clientId,{id:attempt.current,kind:'checkin',data:result.data});attempt.current=null;try{sessionStorage.removeItem(pendingKey);}catch{}setRecovered(false);setDraft(emptyPortalCheckIn());setMessage('Check-in enviado. Tu coach puede consultar tus datos y fotos en Progreso.');onSaved();}
  catch(e){setError(e instanceof Error?e.message:'No se pudo enviar. Tu borrador se conserva para reintentarlo.');}
  finally{lock.current=false;setBusy(false);}
 }
 const disabled=busy||uploading!==null;
 if(coach)return <section className="care-card care-stack"><History activity={activity} coach targetId={targetId} onViewed={onViewed}/></section>;
 return <section className="care-card care-stack"><header><h2>Mi check-in</h2><p>Comparte tu avance con tu coach. Solo la fecha y el peso son obligatorios; completa los demás datos si los tienes.</p></header><p hidden={!recovered} role="status">Recuperamos un envío pendiente de esta pestaña. Puedes reintentarlo; se usará el mismo registro.</p><form onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={disabled} style={{border:0,padding:0,margin:0,minWidth:0}}><div className="care-form"><label>Fecha *<input required type="date" value={draft.date} onChange={e=>set('date',e.target.value)}/></label><label>Peso (kg) *<input required type="number" min={20} max={500} step="any" value={draft.weight} onChange={e=>set('weight',e.target.value)}/></label></div>
 <details className="care-inset"><summary>Medidas corporales · opcionales</summary><div className="care-form">{Object.entries(measurementFields).map(([key,label])=><label key={key}>{label} (cm)<input type="number" min={0.1} max={300} step="any" value={draft.measurements[key]??''} onChange={e=>setDraft(d=>({...d,measurements:{...d.measurements,[key]:e.target.value}}))}/></label>)}</div></details>
 <details className="care-inset"><summary>Adherencia y bienestar · opcionales</summary><p>Porcentaje de cumplimiento y sensaciones del periodo. En bienestar, 1 significa muy bajo y 5 muy alto; en hambre indica la intensidad del hambre.</p><div className="care-form">{Object.entries(adherenceFields).map(([key,label])=><label key={key}>{label} (%)<input type="number" min={0} max={100} step="any" value={draft.adherence[key]??''} onChange={e=>setDraft(d=>({...d,adherence:{...d.adherence,[key]:e.target.value}}))}/></label>)}{Object.entries(wellbeingFields).map(([key,label])=><label key={key}>{label}<select value={draft.adherence[key]??''} onChange={e=>setDraft(d=>({...d,adherence:{...d.adherence,[key]:e.target.value}}))}><option value="">Sin registrar</option>{[1,2,3,4,5].map(v=><option key={v} value={v}>{v} / 5</option>)}</select></label>)}</div></details>
 <details className="care-inset"><summary>Fotos de progreso · opcionales</summary><p>Una foto por posición. Puedes subir solo las que tu coach te solicite.</p><div className="care-form">{(Object.entries(photoAngles) as [PhotoAngle,string][]).map(([angle,label])=>{const photo=draft.photos.find(p=>p.angle===angle);return <div key={angle}><label>{label}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void upload(angle,file);}}/></label>{photo&&<><PrivatePhoto key={photo.path} path={photo.path} alt={label}/><button type="button" onClick={()=>setDraft(d=>({...d,photos:d.photos.filter(p=>p.angle!==angle)}))}>Quitar {label.toLowerCase()}</button></>}</div>;})}</div></details>
 <label className="care-stack">Notas para tu coach<textarea maxLength={5000} value={draft.notes} onChange={e=>set('notes',e.target.value)} placeholder="Cuéntale cómo te fue, dudas o cambios que notaste."/></label><button type="submit" disabled={disabled}>{busy?'Enviando check-in…':uploading?'Subiendo foto…':'Enviar check-in al coach'}</button></fieldset></form>{error&&<p role="alert" className="care-notice">{error} Tu borrador se conserva.</p>}{message&&<p role="status" className="care-notice">{message}</p>}<History activity={activity} targetId={targetId} onViewed={onViewed}/></section>;
}
