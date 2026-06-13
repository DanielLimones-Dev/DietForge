import type { ClientMeasurement, CheckIn } from "@/types";

export interface WeightTrend {
  currentWeight: number;
  rollingAverage7: number | null;
  rollingAverage14: number | null;
  weeklyChange: number | null;
  weeklyChangePercent: number | null;
  dailyRate: number | null;
  trend: "losing" | "gaining" | "stable";
}

export function calculateWeightTrend(
  dataPoints: (ClientMeasurement | CheckIn)[],
): WeightTrend {
  if (dataPoints.length === 0) {
    return {
      currentWeight: 0,
      rollingAverage7: null,
      rollingAverage14: null,
      weeklyChange: null,
      weeklyChangePercent: null,
      dailyRate: null,
      trend: "stable",
    };
  }

  const sorted = [...dataPoints].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const currentWeight = sorted[0].weight;
  const last7 = sorted.slice(0, Math.min(7, sorted.length));
  const last14 = sorted.slice(0, Math.min(14, sorted.length));

  const rollingAverage7 = last7.length >= 2
    ? Math.round(last7.reduce((s, d) => s + d.weight, 0) / last7.length * 10) / 10
    : null;

  const rollingAverage14 = last14.length >= 2
    ? Math.round(last14.reduce((s, d) => s + d.weight, 0) / last14.length * 10) / 10
    : null;

  const oldest7 = last7[last7.length - 1];
  let weeklyChange: number | null = null;
  let weeklyChangePercent: number | null = null;
  let dailyRate: number | null = null;

  if (oldest7 && rollingAverage7 !== null) {
    weeklyChange = Math.round((rollingAverage7 - oldest7.weight) * 10) / 10;
    weeklyChangePercent = Math.round((weeklyChange / oldest7.weight) * 100 * 10) / 10;
    const daysDiff = (new Date(sorted[0].date).getTime() - new Date(oldest7.date).getTime()) / (1000 * 86400);
    if (daysDiff > 0) dailyRate = Math.round((weeklyChange / daysDiff) * 10) / 10;
  }

  let trend: "losing" | "gaining" | "stable" = "stable";
  if (weeklyChange !== null) {
    if (weeklyChange < -0.3) trend = "losing";
    else if (weeklyChange > 0.3) trend = "gaining";
  }

  return { currentWeight, rollingAverage7, rollingAverage14, weeklyChange, weeklyChangePercent, dailyRate, trend };
}

export function getRateLabel(changePercent: number | null): string {
  if (changePercent === null) return "Sin datos";
  const abs = Math.abs(changePercent);
  if (abs < 0.3) return "Estable";
  if (abs < 0.7) return "Lento";
  if (abs < 1.0) return "Moderado";
  if (abs < 1.5) return "Rápido";
  return "Agresivo";
}

export function isRateSafe(changePercent: number | null, phase: "offseason" | "precontest" | "peak_week" | "transition"): boolean {
  if (changePercent === null) return true;
  const abs = Math.abs(changePercent);
  if (phase === "precontest") return abs <= 1.0;
  if (phase === "offseason") return abs <= 0.5;
  if (phase === "peak_week") return abs <= 2.0;
  return abs <= 1.0;
}
