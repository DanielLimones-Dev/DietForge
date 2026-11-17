"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Download, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_DELETION_PHRASE,
  PRIVACY_NOTICE_VERSION,
  consentSummary,
  deletionConfirmationError,
  privacyExportFilename,
  type StoredConsent,
} from "@/lib/privacy";

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Acciones de privacidad del titular. Funciona igual para el coach y para el
 * cliente del portal: ambas identidades tienen sesión de Supabase propia.
 */
export function AccountPrivacy({ context = "coach" }: { context?: "coach" | "portal" }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState<StoredConsent | null>(null);
  const [consentNotice, setConsentNotice] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [confirmError, setConfirmError] = useState("");

  useEffect(() => {
    let live = true;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!live) return;
      setEmail(data.user?.email ?? "");
      try {
        const result = await supabase.rpc("dietforge_privacy_read_consent");
        if (!live) return;
        if (result.error) throw result.error;
        const payload = result.data as { consent?: StoredConsent | null } | null;
        setConsent(payload?.consent ?? null);
      } catch {
        if (live) setConsentNotice("El registro de consentimiento se activa al publicar la migración de privacidad.");
      }
    })();
    return () => { live = false; };
  }, []);

  async function exportData() {
    setError(""); setNotice(""); setExporting(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
      const requestId = crypto.randomUUID();
      const result = await supabase.rpc("dietforge_privacy_export", { p_request_id: requestId });
      if (result.error) throw result.error;
      if (!result.data) throw new Error("No pudimos preparar tu exportación. Intenta de nuevo.");
      downloadJson(result.data, privacyExportFilename());
      setNotice("Descarga lista. El archivo JSON contiene tu cuenta, clientes, dietas y actividad.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo exportar tu información.");
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    setConfirmError("");
    const invalid = deletionConfirmationError({ email: confirmEmail, phrase: confirmPhrase }, email);
    if (invalid) { setConfirmError(invalid); return; }
    setDeleting(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: crypto.randomUUID() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "No se pudo eliminar la cuenta.");
      // La cuenta ya no existe: cerrar sesión no debe impedir la confirmación al titular.
      await supabase.auth.signOut().catch(() => {});
      window.location.replace("/privacidad?eliminada=1");
    } catch (reason) {
      setConfirmError(reason instanceof Error ? reason.message : "No se pudo eliminar la cuenta.");
      setDeleting(false);
    }
  }

  return (
    <section className="care-card privacy-settings" aria-labelledby="privacy-settings-title">
      <header className="care-heading">
        <div>
          <h2 id="privacy-settings-title">Privacidad y mis datos</h2>
          <p className="df-muted">
            Aviso vigente: <Link href="/privacidad" target="_blank" rel="noopener noreferrer">versión {PRIVACY_NOTICE_VERSION}</Link>
          </p>
        </div>
        <span className="df-badge df-badge-green"><ShieldCheck size={14} /> LFPDPPP</span>
      </header>

      <dl className="privacy-status">
        <div><dt>Cuenta</dt><dd>{email || "—"}</dd></div>
        <div><dt>Consentimiento</dt><dd>{consentNotice || consentSummary(consent)}</dd></div>
      </dl>

      <div className="privacy-actions">
        <button type="button" className="df-button" disabled={exporting} onClick={() => void exportData()}>
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {exporting ? "Preparando…" : "Exportar mis datos"}
        </button>
        <p className="df-muted">
          Descarga un JSON con tu cuenta, consentimiento, clientes, dietas, mediciones, check-ins y actividad.
        </p>
      </div>

      {notice && <p role="status" className="df-notice">{notice}</p>}
      {error && <p role="alert" className="privacy-error">{error}</p>}

      <div className="privacy-actions privacy-danger">
        <button type="button" className="df-button-secondary" onClick={() => { setConfirmOpen(true); setConfirmError(""); }}>
          <Trash2 size={16} /> Eliminar mi cuenta
        </button>
        <p className="df-muted">
          Borra tu espacio de trabajo, respaldos, consentimiento y cuenta de acceso. Esta acción no se puede deshacer.
          {context === "portal" && " El expediente clínico permanece bajo responsabilidad y conservación de tu coach."}
        </p>
      </div>

      {confirmOpen && (
        <div className="privacy-confirm" role="group" aria-labelledby="privacy-confirm-title">
          <h3 id="privacy-confirm-title"><AlertTriangle size={18} /> Confirmación final</h3>
          <p>
            Escribe tu correo y la palabra <strong>{PRIVACY_DELETION_PHRASE}</strong> para eliminar
            <strong> {email}</strong>. Se purgan los respaldos y el snapshot con tus datos.
          </p>
          <label className="df-label">
            Correo de la cuenta
            <input
              className="df-input mt-2"
              type="email"
              autoComplete="off"
              value={confirmEmail}
              onChange={(event) => setConfirmEmail(event.target.value)}
              disabled={deleting}
            />
          </label>
          <label className="df-label">
            Escribe {PRIVACY_DELETION_PHRASE}
            <input
              className="df-input mt-2"
              type="text"
              autoComplete="off"
              value={confirmPhrase}
              onChange={(event) => setConfirmPhrase(event.target.value)}
              disabled={deleting}
            />
          </label>
          {confirmError && <p role="alert" className="privacy-error">{confirmError}</p>}
          <div className="privacy-confirm-actions">
            <button type="button" className="df-button-secondary" disabled={deleting} onClick={() => { setConfirmOpen(false); setConfirmPhrase(""); }}>
              Cancelar
            </button>
            <button type="button" className="df-button privacy-delete" disabled={deleting} onClick={() => void deleteAccount()}>
              {deleting ? "Eliminando…" : "Eliminar definitivamente"}
            </button>
          </div>
          <p className="df-muted">
            ¿Solo necesitas corregir algo? Escribe a <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>.
          </p>
        </div>
      )}
    </section>
  );
}
