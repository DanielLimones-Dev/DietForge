'use client';
import {useEffect,useState} from 'react';
import {startAutoRefresh} from '@/lib/auto-refresh';
export function useAutoRefresh<T>(read:()=>Promise<T>,apply:(value:T)=>void) {
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  const loop=startAutoRefresh({read,apply(value){apply(value);setFailed(false);},error(){setFailed(true);},active:()=>!document.hidden&&navigator.onLine,schedule:setTimeout,cancel:clearTimeout});
  const refresh=()=>void loop.refresh();
  refresh();window.addEventListener('online',refresh);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return ()=>{loop.stop();window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[read,apply]);
 return failed;
}
