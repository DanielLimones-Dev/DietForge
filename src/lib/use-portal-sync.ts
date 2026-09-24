'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {startAutoRefresh} from './auto-refresh';
import {portalFailure,type PortalFailure} from './portal-errors';

export function usePortalSync<T>(read:()=>Promise<T>) {
 const [state,setState]=useState<{source:typeof read;data:T|null;error:PortalFailure|null}>({source:read,data:null,error:null});
 const [offline,setOffline]=useState(false);
 const control=useRef<ReturnType<typeof startAutoRefresh<T>>|null>(null);
 useEffect(()=>{
  const loop=startAutoRefresh({
   read,
   apply:data=>setState({source:read,data,error:null}),
   error:cause=>{
    const error=portalFailure(cause);
    setState(previous=>({source:read,data:previous.source===read&&error.kind!=='session'&&error.kind!=='forbidden'?previous.data:null,error}));
   },
   shouldRetry:cause=>portalFailure(cause).retryable,
   active:()=>!document.hidden&&navigator.onLine,
   schedule:(fn,delay)=>window.setTimeout(fn,delay) as unknown as ReturnType<typeof setTimeout>,
   cancel:id=>window.clearTimeout(id as unknown as number),
  });
  control.current=loop;
  const refresh=()=>{setOffline(!navigator.onLine);void loop.refresh();};
  refresh();
  window.addEventListener('online',refresh);window.addEventListener('offline',refresh);
  window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return ()=>{
   loop.stop();if(control.current===loop)control.current=null;
   window.removeEventListener('online',refresh);window.removeEventListener('offline',refresh);
   window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);
  };
 },[read]);
 const reload=useCallback(()=>control.current?.reload()??Promise.resolve(),[]);
 const current=state.source===read?state:{data:null,error:null};
 const restricted=current.error?.kind==='session'||current.error?.kind==='forbidden';
 const message=restricted?current.error!.message:offline?'Sin conexión a internet. Conservamos lo que estás editando y sincronizaremos al reconectar.':current.error?.message??(current.data?'Sincronización automática activa':'Cargando expediente…');
 return {...current,offline,message,reload,restricted,needsAttention:offline||!!current.error};
}
