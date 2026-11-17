"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const readDeletionFlag = () =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("eliminada") === "1";
const serverSnapshot = () => false;

/** Confirmación posterior a la eliminación; la página del aviso es pública y estática. */
export function PrivacyDeletedNotice() {
  const deleted = useSyncExternalStore(subscribe, readDeletionFlag, serverSnapshot);
  if (!deleted) return null;
  return (
    <p role="status" className="df-notice">
      Tu cuenta y tus datos personales fueron eliminados. La solicitud quedó registrada en la bitácora de privacidad.
    </p>
  );
}
