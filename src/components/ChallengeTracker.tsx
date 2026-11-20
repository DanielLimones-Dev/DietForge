"use client";

import { useState } from "react";
import { Award, Flame, Play, Trophy } from "lucide-react";
import { computeGamification } from "@/lib/gamification";
import { trainingDateValue } from "@/lib/training";
import type { Activity } from "@/lib/training-tracking";

interface Props {
  activity: Activity[];
  coach?: boolean;
  onSave: (activity: Activity) => Promise<void>;
  onSaved: () => void;
}

export function ChallengeTracker({ activity, coach = false, onSave, onSaved }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const today = trainingDateValue();
  const summary = computeGamification(activity, today);
  const unlockedCount = summary.medals.filter((m) => m.unlocked).length;

  const startChallenge = async () => {
    setBusy(true);
    setError("");
    try {
      await onSave({
        id: crypto.randomUUID(),
        kind: "event",
        data: {
          date: today,
          completed: false,
          title: "Reto 90 Días",
          event_type: "challenge_90",
          start_date: today,
        },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar el reto.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="care-card portal-section" aria-labelledby="challenge-tracker-title">
      <header className="portal-section-head">
        <div>
          <span className="portal-kicker">GAMIFICACIÓN Y ADHERENCIA</span>
          <h2 id="challenge-tracker-title">Reto 90 días, puntos y medallas</h2>
          <p>Cada comida (+10 pts), sesión completada (+25 pts) y check-in (+30 pts) suma puntos y desbloquea medallas.</p>
        </div>
        {coach && !summary.challengeStartDate && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void startChallenge()}
            className="portal-button portal-button-primary"
          >
            <Play size={15} aria-hidden="true" />
            {busy ? "Iniciando…" : "Iniciar Reto 90 días"}
          </button>
        )}
      </header>

      {error && <p role="alert" className="care-notice mt-3">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-1">
            <Trophy size={13} className="text-amber-500" aria-hidden="true" /> Puntos
          </p>
          <strong className="text-2xl font-bold block mt-1 dark:text-white">{summary.points}</strong>
        </div>
        <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-1">
            <Flame size={13} className="text-orange-500" aria-hidden="true" /> Días activos
          </p>
          <strong className="text-2xl font-bold block mt-1 dark:text-white">{summary.activeDays}</strong>
        </div>
        <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-1">
            <Award size={13} className="text-emerald-600" aria-hidden="true" /> Medallas
          </p>
          <strong className="text-2xl font-bold block mt-1 dark:text-white">
            {unlockedCount} / {summary.medals.length}
          </strong>
        </div>
        <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Reto 90 días</p>
          <strong className="text-2xl font-bold block mt-1 dark:text-white">
            {summary.challengeStartDate ? `Día ${summary.challengeDay}/90` : "Sin iniciar"}
          </strong>
        </div>
      </div>

      {summary.challengeStartDate && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Inicio: {summary.challengeStartDate}</span>
            <span>{summary.challengeProgressPct}% completado</span>
          </div>
          <progress
            aria-label="Progreso del reto de 90 días"
            max={100}
            value={summary.challengeProgressPct}
            className="w-full h-2.5 rounded-full overflow-hidden accent-brand-600"
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
        {summary.medals.map((medal) => (
          <article
            key={medal.id}
            className={`p-3.5 rounded-xl border transition-colors ${
              medal.unlocked
                ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-950/30"
                : "border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/40 opacity-70"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm font-semibold flex items-center gap-1.5 dark:text-white">
                <Award
                  size={15}
                  className={medal.unlocked ? "text-emerald-600" : "text-gray-400"}
                  aria-hidden="true"
                />
                {medal.title}
              </strong>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                {medal.unlocked ? "Desbloqueada" : medal.thresholdLabel}
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5">{medal.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
