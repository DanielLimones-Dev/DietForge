import type { CompetitionPhase } from "@/types";

export interface Alert {
  type: "danger" | "warning" | "info";
  message: string;
  actionable: boolean;
}

export function checkWeightRate(
  changePercent: number | null,
  phase: CompetitionPhase,
): Alert | null {
  if (changePercent === null) return null;
  const abs = Math.abs(changePercent);

  if (phase === "precontest") {
    if (abs > 1.5) return { type: "danger", message: `Pérdida muy agresiva (${abs}%/sem). Riesgo de pérdida muscular. Aumentar carbos`, actionable: true };
    if (abs > 1.0) return { type: "warning", message: `Pérdida rápida (${abs}%/sem). Monitorear rendimiento y sueño`, actionable: false };
    if (abs < 0.3) return { type: "warning", message: `Pérdida muy lenta (${abs}%/sem). Reducir carbos o aumentar cardio`, actionable: true };
  }

  if (phase === "offseason") {
    if (abs > 1.0) return { type: "danger", message: `Ganancia muy rápida (${abs}%/sem). Exceso de grasa innecesario`, actionable: true };
    if (abs < 0.2 && changePercent > 0) return { type: "warning", message: `Ganancia casi nula. Aumentar calorías`, actionable: true };
  }

  return null;
}

export function checkAdherenceWarning(adherence: {
  meals: number;
  supplements: number;
  training: number;
  cardio: number;
}): Alert | null {
  const avg = (adherence.meals + adherence.supplements + adherence.training + adherence.cardio) / 4;
  if (avg < 50) return { type: "danger", message: `Adherencia crítica (${avg}%). Intervención necesaria`, actionable: true };
  if (avg < 70) return { type: "warning", message: `Adherencia baja (${avg}%). Reforzar compromiso`, actionable: false };
  return null;
}

export function checkConsecutiveMissedCheckins(missedDays: number): Alert | null {
  if (missedDays >= 14) return { type: "danger", message: `${missedDays} días sin check-in. Contactar urgente`, actionable: true };
  if (missedDays >= 7) return { type: "warning", message: `${missedDays} días sin check-in. Cliente desconectado`, actionable: true };
  return null;
}
