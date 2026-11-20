import type { Activity } from "./training-tracking";

export interface Medal {
  id: string;
  title: string;
  description: string;
  thresholdLabel: string;
  unlocked: boolean;
}

export interface GamificationSummary {
  points: number;
  mealsCompleted: number;
  sessionsCompleted: number;
  checkinsCount: number;
  activeDays: number;
  challengeStartDate: string | null;
  challengeDay: number;
  challengeProgressPct: number;
  medals: Medal[];
}

export function computeGamification(activity: Activity[], todayIso: string): GamificationSummary {
  const mealsCompleted = activity.filter(
    (a) => a.kind === "meal" && Boolean(a.data?.completed)
  ).length;
  const sessionsCompleted = activity.filter(
    (a) => a.kind === "session" && Boolean(a.data?.completed)
  ).length;
  const checkinsCount = activity.filter((a) => a.kind === "checkin").length;

  const activeDaySet = new Set<string>();
  for (const a of activity) {
    if (a.kind === "meal" || a.kind === "session" || a.kind === "checkin") {
      const rawDate = typeof a.data?.date === "string" ? a.data.date.slice(0, 10) : "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) activeDaySet.add(rawDate);
    }
  }
  const activeDays = activeDaySet.size;
  const points = mealsCompleted * 10 + sessionsCompleted * 25 + checkinsCount * 30;

  const challengeEntry = activity
    .filter((a) => (a.kind === "challenge_90" || (a.kind === "event" && a.data?.event_type === "challenge_90")) && typeof a.data?.start_date === "string")
    .sort((a, b) => String(b.data.start_date).localeCompare(String(a.data.start_date)))[0];

  const challengeStartDate = challengeEntry ? String(challengeEntry.data.start_date).slice(0, 10) : null;
  let challengeDay = 0;
  if (challengeStartDate) {
    const startMs = new Date(`${challengeStartDate}T00:00:00Z`).getTime();
    const todayMs = new Date(`${todayIso.slice(0, 10)}T00:00:00Z`).getTime();
    if (Number.isFinite(startMs) && Number.isFinite(todayMs)) {
      challengeDay = Math.min(90, Math.max(1, Math.floor((todayMs - startMs) / 86_400_000) + 1));
    }
  }
  const challengeProgressPct = challengeStartDate ? Math.min(100, Math.round((challengeDay / 90) * 100)) : 0;

  const medals: Medal[] = [
    {
      id: "first_checkin",
      title: "Primer Check-in",
      description: "Enviaste tu primera evaluación de seguimiento.",
      thresholdLabel: "1 check-in",
      unlocked: checkinsCount >= 1,
    },
    {
      id: "streak_7",
      title: "Semana Activa",
      description: "Registraste actividad en al menos 7 días distintos.",
      thresholdLabel: "7 días activos",
      unlocked: activeDays >= 7,
    },
    {
      id: "sessions_10",
      title: "10 Entrenos",
      description: "Completaste 10 sesiones de entrenamiento.",
      thresholdLabel: "10 sesiones",
      unlocked: sessionsCompleted >= 10,
    },
    {
      id: "meals_50",
      title: "50 Comidas",
      description: "Marcaste 50 comidas cumplidas de tu plan.",
      thresholdLabel: "50 comidas",
      unlocked: mealsCompleted >= 50,
    },
    {
      id: "points_500",
      title: "Club 500 pts",
      description: "Superaste los 500 puntos acumulados de adherencia.",
      thresholdLabel: "500 pts",
      unlocked: points >= 500,
    },
    {
      id: "challenge_90_done",
      title: "Reto 90 Días",
      description: "Completaste los 90 días del reto con tu coach.",
      thresholdLabel: "Día 90 / 90",
      unlocked: challengeDay >= 90,
    },
  ];

  return {
    points,
    mealsCompleted,
    sessionsCompleted,
    checkinsCount,
    activeDays,
    challengeStartDate,
    challengeDay,
    challengeProgressPct,
    medals,
  };
}
