'use client';
import {useState} from 'react';
import {supabase} from '@/lib/supabase';
import {mediaPath,youtubeUrl,videoFileError,VIDEO_BUCKET} from '@/lib/training-media';

export function TrainingVideo({value,label='Ver video'}:{value:string;label?:string}){
 const [source,setSource]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const youtube=youtubeUrl(value);const path=mediaPath(value);
 if(youtube)return <a href={youtube} target="_blank" rel="noopener noreferrer">▶ {label} · YouTube</a>;
 if(!path)return null;
 return <div className="training-video-player"><button type="button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const {data,error}=await supabase.storage.from(VIDEO_BUCKET).createSignedUrl(path,900);if(error)throw error;setSource(data.signedUrl);}catch{setError('No se pudo abrir el video. Comprueba tu acceso e intenta otra vez.');}finally{setBusy(false);}}}>{busy?'Abriendo…':label}</button>{source&&<><video key={source} controls playsInline preload="metadata" src={source} onError={()=>setError('No se pudo reproducir. Vuelve a abrir el video o usa MP4 compatible con tu dispositivo.')}/><button type="button" onClick={()=>setSource('')}>Cerrar video</button></>}{error&&<p role="alert">{error}</p>}</div>;
}

export function TrainingVideoEditor({value,onChange,label,initiallyOpen=false}:{value:string;onChange:(value:string)=>void;label:string;initiallyOpen?:boolean}){
 const [link,setLink]=useState(youtubeUrl(value)??'');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function upload(file:File){const invalid=videoFileError(file);if(invalid){setError(invalid);return;}setBusy(true);setError('');try{
 const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user)throw new Error('Sesión no disponible.');
 const ext=file.type==='video/webm'?'webm':file.type==='video/quicktime'?'mov':'mp4';const path=`${user.id}/${crypto.randomUUID()}.${ext}`;
 const {error}=await supabase.storage.from(VIDEO_BUCKET).upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;
 onChange(`storage:${path}`);setLink('');
 }catch{setError('No se pudo subir. Revisa tu conexión y el acceso de tu cuenta.');}finally{setBusy(false);}}
 return <details className="training-media-editor" open={initiallyOpen||undefined}><summary>{label}</summary><p>Agrega un video técnico de YouTube o un archivo privado de tu cuenta.</p><div className="care-form"><label>Enlace de YouTube<input type="url" value={link} placeholder="https://www.youtube.com/watch?v=…" onChange={e=>setLink(e.target.value)}/></label><button type="button" disabled={busy} onClick={()=>{const url=youtubeUrl(link.trim());if(!url){setError('Introduce un enlace válido de un video de YouTube.');return;}setError('');onChange(url);}}>Usar enlace</button><label>Subir mi video · máximo 50 MB<input aria-label={`Subir video: ${label}`} type="file" accept="video/mp4,video/webm,video/quicktime" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value='';}}/></label></div>{busy&&<p role="status">Subiendo video…</p>}{value&&<><TrainingVideo value={value}/><button type="button" onClick={()=>{onChange('');setLink('');setError('');}}>Quitar video</button></>}{error&&<p role="alert">{error}</p>}</details>;
}
