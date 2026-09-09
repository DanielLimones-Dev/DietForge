"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { LoginScreen } from "./LoginScreen";
import { supabase } from "@/lib/supabase";
import { LoadingScreen } from "./LoadingScreen";
import { db, initializeCloud, confirmLegacyImport, disconnectCloud, getStorageState, subscribeStorage, retryCloudSave, exportCloudBackup, hasPendingCloudWrites } from "@/lib/db";
import { isStorageAlert } from "@/lib/cloud/engine";

const serverStorageState = { phase: "ready" as const, message: "Conectando…" };
const getServerStorageState = () => serverStorageState;
const AccountContext = createContext<string | null>(null);

function CloudAccount({ userId, children }: { userId: string; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [needsImport, setNeedsImport] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const initial = useRef<ReturnType<typeof initializeCloud> | null>(null);
  const storage = useSyncExternalStore(subscribeStorage, getStorageState, getServerStorageState);

  useEffect(() => {
    let live = true;
    // Share the work during StrictMode's effect replay, including seeding.
    initial.current ??= initializeCloud(userId).then(result => {
      if (!result.needsImport) db.seedFoods();
      return result;
    });
    initial.current.then(result => {
      if (!live) return;
      setNeedsImport(result.needsImport);
      setCounts(result.localCounts ?? {});
      setReady(!result.needsImport);
    }).catch(error => { if (live) setError(error instanceof Error ? error.message : "No se pudieron cargar tus datos."); });
    return () => { live = false; };
  }, [userId]);

  async function importData(useLocal: boolean) {
    setBusy(true);
    try {
      await confirmLegacyImport(useLocal);
      db.seedFoods();
      setNeedsImport(false);
      setReady(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo importar.");
    } finally {
      setBusy(false);
    }
  }

  if (error || needsImport) return <div className="min-h-screen bg-gray-950 text-white p-10 space-y-5">
    <h1 className="text-xl">{error ? "No se pudo abrir tu información" : "Datos locales encontrados"}</h1>
    {error ? <p role="alert">{error}</p> : <>
      <p>¿Quieres importar estos datos a la cuenta con la que acabas de iniciar sesión? Los originales se conservan.</p>
      <p>{Object.entries(counts).map(([key, value]) => `${key}: ${value}`).join(" · ")}</p>
      <button disabled={busy} onClick={() => void importData(true)} className="bg-brand-600 p-3 rounded">Importar a mi cuenta</button>
      <button disabled={busy} onClick={() => void importData(false)} className="p-3">Empezar sin importar</button>
    </>}
    <button onClick={exportCloudBackup} className="p-3">Descargar respaldo</button>
    <button onClick={() => window.location.reload()} className="p-3">Volver a intentar</button>
    <button disabled={busy || hasPendingCloudWrites()} onClick={() => void supabase.auth.signOut()} className="p-3">Salir</button>
  </div>;
  if (!ready) return <LoadingScreen />;
  return <>
    {isStorageAlert(storage) && (
      <div role="alert" className="px-4 py-2 text-sm bg-red-100 text-red-900">
        {storage.message}
        <button className="ml-4 underline" onClick={() => void retryCloudSave()}>Reintentar</button>
        <button className="ml-4 underline" onClick={exportCloudBackup}>Descargar respaldo</button>
      </div>
    )}
    <div inert={storage.phase === "error" ? true : undefined}>{children}</div>
  </>;
}

export function CloudGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    // onAuthStateChange also emits INITIAL_SESSION; a single source prevents
    // a late getSession response from restoring the previous account.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!live) return;
      // This optional display cache must never block an Auth event when storage is full.
      try {
        if (session?.user.email) localStorage.setItem("dietforge_email", session.user.email);
        else localStorage.removeItem("dietforge_email");
      } catch { /* Auth remains the source of identity. */ }
      if (!session) disconnectCloud();
      setUser(session?.user.id ?? null);
    });
    supabase.auth.initialize().then(({ error }) => { if (live && error) setError(error.message); });
    return () => { live = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    const onBefore = (event: BeforeUnloadEvent) => {
      if (hasPendingCloudWrites()) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, []);
  if (error && !user) return <div role="alert" className="min-h-screen grid place-content-center gap-4 p-6">
    <p>No se pudo verificar el acceso: {error}</p>
    <button onClick={() => window.location.assign(window.location.pathname)}>Volver a intentar</button>
  </div>;
  if (user === undefined) return <LoadingScreen />;
  if (user === null) return <LoginScreen />;
  // Changing accounts unmounts every screen and its local state before loading.
  return <AccountContext.Provider key={user} value={user}>{children}</AccountContext.Provider>;
}

export function CloudDataGate({children}:{children:ReactNode}) {
  const user=useContext(AccountContext);
  if(!user)return <LoadingScreen/>;
  return <CloudAccount key={user} userId={user}>{children}</CloudAccount>;
}
