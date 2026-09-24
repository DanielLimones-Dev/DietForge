'use client';
import {useEffect,useRef} from 'react';
import {AlertTriangle} from 'lucide-react';
export function UnsavedChangesAlert({onContinue,onDiscard}:{onContinue:()=>void;onDiscard:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;if(!dialog)return;const previous=document.activeElement as HTMLElement|null;dialog.showModal();dialog.querySelector<HTMLButtonElement>('button')?.focus();return()=>{dialog.close();previous?.focus();};},[]);
 return <dialog ref={ref} className="dm-unsaved-alert" aria-labelledby="dm-unsaved-title" aria-describedby="dm-unsaved-description" onCancel={e=>{e.preventDefault();onContinue();}}><div className="dm-unsaved-icon"><AlertTriangle size={24}/></div><h2 id="dm-unsaved-title">Tienes cambios sin guardar</h2><p id="dm-unsaved-description">Los cambios que hiciste todavía no se han guardado. Puedes seguir editando o descartarlos para continuar.</p><div className="dm-unsaved-actions"><button className="dm-secondary" onClick={onContinue}>Seguir editando</button><button className="dm-primary" onClick={onDiscard}>Descartar cambios</button></div></dialog>;
}
