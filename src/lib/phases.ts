import type { CompetitionPhase, MacroResult } from "@/types";

const PHASE_REQUIREMENTS: Record<CompetitionPhase, {
  protein: number;
  fatMin: number;
  fatMax: number;
  carbModifier: number;
  description: string;
}> = {
  offseason: { protein: 2.0, fatMin: 0.8, fatMax: 1.0, carbModifier: 1.2, description: "Off-season: construcción muscular" },
  precontest: { protein: 2.4, fatMin: 0.6, fatMax: 0.8, carbModifier: 0.7, description: "Pre-contest: definición" },
  peak_week: { protein: 2.6, fatMin: 0.4, fatMax: 0.6, carbModifier: 0.5, description: "Peak week: manipulación final" },
  transition: { protein: 2.0, fatMin: 0.7, fatMax: 0.9, carbModifier: 1.0, description: "Transición post-competencia" },
};

export function calculatePhaseMacros(
  base: MacroResult,
  weight: number,
  phase: CompetitionPhase,
): MacroResult {
  const req = PHASE_REQUIREMENTS[phase];
  const protein = Math.round(weight * req.protein);
  const fat = Math.round(weight * ((req.fatMin + req.fatMax) / 2));
  const proteinKcal = protein * 4;
  const fatKcal = fat * 9;
  const carbsKcal = Math.max(0, base.tdee - proteinKcal - fatKcal);
  const carbs = Math.round(carbsKcal / 4 * req.carbModifier);

  const adjustedKcal = proteinKcal + fatKcal + carbs * 4;

  return {
    ...base,
    tdee: adjustedKcal,
    protein,
    carbs,
    fat,
  };
}

export function getPhaseLabel(phase: CompetitionPhase): string {
  const labels: Record<CompetitionPhase, string> = {
    offseason: "Off-season",
    precontest: "Pre-contest",
    peak_week: "Peak Week",
    transition: "Transición",
  };
  return labels[phase];
}

export function getPhaseColor(phase: CompetitionPhase): string {
  const colors: Record<CompetitionPhase, string> = {
    offseason: "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800",
    precontest: "text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800",
    peak_week: "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800",
    transition: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800",
  };
  return colors[phase];
}

export function estimatePhaseDuration(phase: CompetitionPhase): number {
  const weeks: Record<CompetitionPhase, number> = {
    offseason: 52,
    precontest: 16,
    peak_week: 1,
    transition: 4,
  };
  return weeks[phase];
}

export { PHASE_REQUIREMENTS };
