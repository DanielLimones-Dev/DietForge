"use client";
import {useEffect} from "react";
import {recordError} from "@/lib/error-monitor";

export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(()=>{recordError("react");},[]);
  return (
    <div role="alert" className="space-y-4 p-6 dark:text-white">
      <h1 className="text-xl font-bold">No se pudo abrir esta página</h1>
      <p>Puedes volver a intentarlo sin salir de tu cuenta.</p>
      <button onClick={reset} className="rounded-lg bg-brand-600 px-4 py-2 text-white">Volver a intentar</button>
    </div>
  );
}
