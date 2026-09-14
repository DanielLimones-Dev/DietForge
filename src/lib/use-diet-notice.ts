'use client';
import {useCallback,useRef,useState} from 'react';
import {supabase} from './supabase';
import {useAutoRefresh} from './use-auto-refresh';
export interface DietNotice {revision:string|null;pending:boolean}
export function useDietNotice(owner:string,client:number,enabled:boolean){
 const [notice,setNotice]=useState<DietNotice>({revision:null,pending:false});
 const [closing,setClosing]=useState(false);const [error,setError]=useState('');
 const dismissed=useRef(new Set<string>());
 const read=useCallback(async()=>{
  if(!enabled||!owner)return {revision:null,pending:false};
  const {data,error}=await supabase.rpc('dietforge_diet_notice_read',{o:owner,c:client});
  if(error)throw error;return data as DietNotice;
 },[owner,client,enabled]);
 const apply=useCallback((value:DietNotice)=>setNotice({...value,pending:value.pending&&!dismissed.current.has(value.revision??'')}),[]);
 const failed=useAutoRefresh(read,apply);
 async function close(){
  const revision=notice.revision;if(!revision||closing)return;
  setClosing(true);setError('');
  try{
   const {data:accepted,error}=await supabase.rpc('dietforge_diet_notice_seen',{o:owner,c:client,v:revision});if(error)throw error;
   if(!accepted){apply(await read());return;}
   // A late poll of this revision cannot revive a dismissed notice; newer revisions stay visible.
   dismissed.current.add(revision);
   setNotice(current=>current.revision===revision?{...current,pending:false}:current);
  }catch{setError('No se pudo cerrar el aviso. Inténtalo de nuevo.');}finally{setClosing(false);}
 }
 return {pending:enabled&&notice.pending,closing,close,error,failed:enabled&&failed};
}
