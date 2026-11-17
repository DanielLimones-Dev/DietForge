"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  Dumbbell,
  FileSpreadsheet,
  ShieldCheck,
  Users,
  AlertTriangle,
} from "lucide-react";
import { db, exportCloudBackup, hasPendingCloudWrites, retryCloudSave } from "@/lib/db";
import { monitoredErrors } from "@/lib/error-monitor";
import { revealFocusedCascade } from "@/lib/page-cascade";

export function QualityPanel() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const stats = useMemo(() => {
    const base = db.getStats();
    const recipes = db.getRecipes().length;
    const exercises = db.getExercises().length;
    return {
      ...base,
      recipes,
      exercises,
    };
  }, []);

  const errors = monitoredErrors();
  const pendingWrites = hasPendingCloudWrites();

  async function handleDownloadAll() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await retryCloudSave();
      exportCloudBackup();
      const time = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
      setNotice(`Respaldo completo descargado (${time}). Incluye ${stats.clients} ${stats.clients === 1 ? "cliente" : "clientes"} y toda su programación.`);
    } catch {
      exportCloudBackup();
      setNotice("Se descargó el respaldo con el estado local actual. Hay cambios pendientes de sincronizar en la nube.");
    } finally {
      setBusy(false);
    }
  }

  const cards = [
    {
      label: "Clientes",
      value: stats.clients,
      detail: `${stats.activeClients} activos en 14 días`,
      icon: Users,
      tone: "green",
    },
    {
      label: "Planes nutricionales",
      value: stats.mealPlans,
      detail: `${stats.foods} alimentos · ${stats.recipes} recetas`,
      icon: FileSpreadsheet,
      tone: "teal",
    },
    {
      label: "Rutinas y ejercicios",
      value: stats.trainingPrograms,
      detail: `${stats.exercises} ejercicios personalizados`,
      icon: Dumbbell,
      tone: "blue",
    },
    {
      label: "Check-ins acumulados",
      value: stats.checkins,
      detail: `${stats.competitions} competencias registradas`,
      icon: ClipboardCheck,
      tone: "amber",
    },
  ];

  const includedItems = [
    "Expedientes completos de todos los clientes",
    "Mediciones antropométricas y composición corporal",
    "Planes de alimentación, menús semanales y recetas",
    "Mesociclos, rutinas de entrenamiento y biblioteca propia",
    "Historial de check-ins, adherencia y competencias",
    "Catálogo completo de alimentos y preferencias de cuenta",
  ];

  return (
    <div className="quality-page" data-page-cascade onFocusCapture={revealFocusedCascade}>
      <header className="quality-hero" data-cascade="0">
        <div>
          <span className="admin-master-pill">
            <i />
            Respaldo integral
          </span>
          <h1>Calidad y respaldo</h1>
          <p>
            Descarga un único archivo con todos tus clientes, dietas, rutinas, mediciones, check-ins y catálogo
            completo.
          </p>
        </div>
        <button type="button" className="df-button quality-download-btn" disabled={busy} onClick={() => void handleDownloadAll()}>
          <Download size={17} />
          {busy ? "Preparando archivo…" : "Descargar respaldo completo"}
        </button>
      </header>

      <div className="quality-metrics" data-cascade="1">
        {cards.map((card) => (
          <article key={card.label} className={`quality-metric metric-${card.tone}`}>
            <div>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.detail}</small>
            </div>
            <span>
              <card.icon size={18} />
            </span>
          </article>
        ))}
      </div>

      {error && (
        <div role="alert" className="admin-alert is-error">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div role="status" className="admin-alert is-notice">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      )}

      <div className="quality-grid" data-cascade="2">
        <section className="quality-card">
          <div className="quality-card-head">
            <div>
              <p className="df-eyebrow">ARCHIVO ÚNICO (.JSON)</p>
              <h2>Qué incluye tu respaldo descargable</h2>
            </div>
            <span className="quality-format-pill">
              <Database size={13} />
              dietforge-respaldo.json
            </span>
          </div>
          <ul className="quality-include-list">
            {includedItems.map((item) => (
              <li key={item}>
                <CheckCircle2 size={15} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="quality-card-footer">
            <p>El archivo se genera al instante con la información más reciente de tu espacio de trabajo.</p>
            <button type="button" className="df-button" disabled={busy} onClick={() => void handleDownloadAll()}>
              <Download size={16} />
              Descargar ahora
            </button>
          </div>
        </section>

        <aside className="quality-side">
          <section className="quality-card quality-status-card">
            <div className="quality-card-head">
              <div>
                <p className="df-eyebrow">ESTADO DEL SISTEMA</p>
                <h2>Salud de la sesión</h2>
              </div>
              <ShieldCheck size={18} className="text-[var(--clinical-primary)]" />
            </div>

            <div className="quality-status-list">
              <div className="quality-status-row">
                <span>Sincronización</span>
                <strong className={pendingWrites ? "is-warn" : "is-ok"}>
                  {pendingWrites ? "Cambios pendientes" : "Al día"}
                </strong>
              </div>
              <div className="quality-status-row">
                <span>Errores de ejecución</span>
                <strong className={errors.length ? "is-warn" : "is-ok"}>
                  {errors.length === 0 ? "Sin incidencias" : `${errors.length} detectados`}
                </strong>
              </div>
            </div>

            {errors.length > 0 && (
              <div className="quality-error-log">
                {errors.slice(0, 5).map((entry, idx) => (
                  <p key={idx}>
                    <span>{entry.at}</span>
                    <b>{entry.type}</b>
                  </p>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
