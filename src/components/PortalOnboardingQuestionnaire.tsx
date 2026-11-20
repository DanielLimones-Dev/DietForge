"use client";

import { useState, type FormEvent } from "react";
import { ClipboardCheck, Send } from "lucide-react";
import type { Activity } from "@/lib/training-tracking";
import { trainingDateValue } from "@/lib/training";

export interface QuestionnaireData {
  goal: string;
  experience: string;
  daysPerWeek: number;
  injuries: string;
  schedule: string;
  notes: string;
  submittedAt: string;
}

export function extractQuestionnaireState(activity: Activity[]) {
  const configs = activity
    .filter((a) => a.kind === "event" && a.data?.event_type === "onboarding_questionnaire")
    .sort((a, b) => String(a.data?.updated_at ?? a.data?.date ?? "").localeCompare(String(b.data?.updated_at ?? b.data?.date ?? "")));
  const latestConfig = configs.at(-1) ?? null;
  const enabled = Boolean(latestConfig?.data?.enabled);

  const response = activity.find(
    (a) => a.kind === "checkin" && a.data?.event_type === "onboarding_questionnaire_response"
  ) ?? null;

  return { latestConfig, enabled, response };
}

interface PortalProps {
  onSave: (activity: Activity) => Promise<void>;
  onSaved: () => void;
}

export function PortalOnboardingQuestionnaire({ onSave, onSaved }: PortalProps) {
  const [weight, setWeight] = useState("");
  const [goal, setGoal] = useState("Pérdida de grasa");
  const [experience, setExperience] = useState("Intermedio");
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [injuries, setInjuries] = useState("");
  const [schedule, setSchedule] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const numericWeight = Number(weight);
    if (!Number.isFinite(numericWeight) || numericWeight < 20 || numericWeight > 350) {
      setError("Ingresa tu peso actual aproximado (entre 20 y 350 kg).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const nowIso = new Date().toISOString();
      const summaryLines = [
        `Cuestionario inicial (Online)`,
        `Objetivo: ${goal}`,
        `Experiencia: ${experience}`,
        `Días disponibles: ${daysPerWeek} días/semana`,
        injuries.trim() ? `Lesiones/alergias: ${injuries.trim()}` : "",
        schedule.trim() ? `Horarios: ${schedule.trim()}` : "",
        notes.trim() ? `Notas: ${notes.trim()}` : "",
      ].filter(Boolean);

      await onSave({
        id: crypto.randomUUID(),
        kind: "checkin",
        data: {
          date: trainingDateValue(),
          weight: numericWeight,
          notes: summaryLines.join("\n"),
          event_type: "onboarding_questionnaire_response",
          questionnaire: {
            goal,
            experience,
            daysPerWeek,
            injuries: injuries.trim(),
            schedule: schedule.trim(),
            notes: notes.trim(),
            submittedAt: nowIso,
          } satisfies QuestionnaireData,
        },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el cuestionario.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="care-card portal-section portal-onboarding-q" aria-labelledby="portal-onboarding-q-title">
      <header className="portal-section-head">
        <div>
          <span className="portal-kicker">Bienvenida Online</span>
          <h2 id="portal-onboarding-q-title">Cuestionario inicial</h2>
          <p>Tu coach habilitó este cuestionario rápido para personalizar tu plan de entrenamiento y alimentación.</p>
        </div>
        <span className="portal-status is-on">
          <ClipboardCheck size={14} aria-hidden="true" />
          Pendiente
        </span>
      </header>

      <form onSubmit={(e) => void handleSubmit(e)} className="care-form mt-4">
        <label>
          Peso actual (kg) *
          <input
            type="number"
            min={20}
            max={350}
            step="0.1"
            required
            placeholder="Ej. 74.5"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </label>
        <label>
          Objetivo principal
          <select value={goal} onChange={(e) => setGoal(e.target.value)}>
            <option value="Pérdida de grasa">Pérdida de grasa</option>
            <option value="Ganancia muscular">Ganancia muscular</option>
            <option value="Recomposición corporal">Recomposición corporal</option>
            <option value="Rendimiento deportivo">Rendimiento deportivo</option>
            <option value="Salud y hábitos">Salud y hábitos</option>
          </select>
        </label>
        <label>
          Experiencia entrenando
          <select value={experience} onChange={(e) => setExperience(e.target.value)}>
            <option value="Principiante">Principiante (0–1 año)</option>
            <option value="Intermedio">Intermedio (1–3 años)</option>
            <option value="Avanzado">Avanzado (+3 años)</option>
          </select>
        </label>
        <label>
          Días disponibles / semana
          <select value={daysPerWeek} onChange={(e) => setDaysPerWeek(Number(e.target.value))}>
            {[2, 3, 4, 5, 6].map((d) => (
              <option key={d} value={d}>
                {d} días a la semana
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          Lesiones, molestias o alergias alimentarias
          <input
            type="text"
            maxLength={300}
            placeholder="Ej. Molestia en hombro derecho / intolerancia a la lactosa"
            value={injuries}
            onChange={(e) => setInjuries(e.target.value)}
          />
        </label>
        <label className="sm:col-span-2">
          Horario habitual de entrenamiento y comidas
          <input
            type="text"
            maxLength={250}
            placeholder="Ej. Entreno 7:00 am, 4 comidas al día"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
          />
        </label>
        <label className="sm:col-span-2">
          Comentarios adicionales para tu coach
          <textarea
            rows={2}
            maxLength={1000}
            placeholder="Cuéntale qué equipos tienes disponibles o cualquier meta específica."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" disabled={busy} className="portal-button portal-button-primary">
            <Send size={15} aria-hidden="true" />
            {busy ? "Enviando…" : "Enviar cuestionario"}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="care-notice mt-3">
          {error}
        </p>
      )}
    </section>
  );
}

export function CoachQuestionnaireSummary({ response }: { response: Activity }) {
  const q = (response.data?.questionnaire ?? {}) as Partial<QuestionnaireData>;
  return (
    <section className="care-card portal-section" aria-label="Respuestas del cuestionario inicial">
      <header className="portal-section-head">
        <div>
          <span className="portal-kicker">Cuestionario Online</span>
          <h2>Respuestas iniciales del cliente</h2>
          <p>Completado el {String(response.data?.date ?? "").slice(0, 10) || "recientemente"}.</p>
        </div>
        <span className="portal-status is-on">Completado</span>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          <span className="block text-[10px] uppercase text-gray-500 font-semibold">Peso inicial</span>
          <strong className="text-sm mt-0.5 block">{String(response.data?.weight ?? "—")} kg</strong>
        </div>
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          <span className="block text-[10px] uppercase text-gray-500 font-semibold">Objetivo</span>
          <strong className="text-sm mt-0.5 block">{q.goal || "—"}</strong>
        </div>
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          <span className="block text-[10px] uppercase text-gray-500 font-semibold">Experiencia</span>
          <strong className="text-sm mt-0.5 block">{q.experience || "—"}</strong>
        </div>
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          <span className="block text-[10px] uppercase text-gray-500 font-semibold">Disponibilidad</span>
          <strong className="text-sm mt-0.5 block">{q.daysPerWeek ? `${q.daysPerWeek} días/sem` : "—"}</strong>
        </div>
      </div>
      {(q.injuries || q.schedule || q.notes) && (
        <div className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {q.injuries && <p><strong>Lesiones / alergias:</strong> {q.injuries}</p>}
          {q.schedule && <p><strong>Horarios:</strong> {q.schedule}</p>}
          {q.notes && <p><strong>Notas:</strong> {q.notes}</p>}
        </div>
      )}
    </section>
  );
}
