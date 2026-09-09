"use client";
import { LockKeyhole, RefreshCw, LogOut } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
export function SubscriptionPage({ offline }: { offline?: boolean }) {
 const {status,email,error,refresh,logout}=useSubscription();
 return <div className="access-pending"><div className="df-card max-w-lg w-full p-8 text-center">
  <span className="df-icon mx-auto"><LockKeyhole size={24}/></span>
  <p className="df-eyebrow mt-6">DIETFORGE · ACCESO</p>
  <h1 className="text-2xl font-semibold mt-2">{error?"No pudimos verificar tu acceso":status.status==="suspended"?"Acceso pausado":status.status==="expired"?"Tu periodo ha finalizado":"Tu cuenta está pendiente de activación"}</h1>
  <p className="df-muted mt-3">{error|| (offline?"Conéctate a internet para verificar tu cuenta.":"El administrador debe dar de alta tu correo y asignarte un periodo de 1 mes, 3 meses o 1 año.")}</p>
  {email&&<p className="mt-4 font-medium break-all">{email}</p>}
  <div className="mt-7 flex flex-wrap justify-center gap-3"><button className="df-button" onClick={()=>void refresh()}><RefreshCw size={16}/>Verificar acceso</button><button className="df-button-secondary" onClick={()=>void logout()}><LogOut size={16}/>Salir</button></div>
 </div></div>;
}
