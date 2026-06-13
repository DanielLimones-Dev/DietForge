import type { CarbDay, MacroResult } from "@/types";

const CARB_MODIFIERS: Record<CarbDay, number> = {
  high: 1.4,
  moderate: 1.0,
  low: 0.6,
  refeed: 1.8,
};

const FAT_MODIFIERS: Record<CarbDay, number> = {
  high: 0.7,
  moderate: 1.0,
  low: 1.3,
  refeed: 0.4,
};

const PROTEIN_MODIFIERS: Record<CarbDay, number> = {
  high: 1.0,
  moderate: 1.0,
  low: 1.1,
  refeed: 1.0,
};

export function calculateDayMacros(
  base: MacroResult,
  carbDay: CarbDay,
): MacroResult {
  const carbMod = CARB_MODIFIERS[carbDay];
  const fatMod = FAT_MODIFIERS[carbDay];
  const proteinMod = PROTEIN_MODIFIERS[carbDay];

  const protein = Math.round(base.protein * proteinMod);
  const fat = Math.round(base.fat * fatMod);
  const carbs = Math.round(base.carbs * carbMod);

  const proteinKcal = protein * 4;
  const fatKcal = fat * 9;
  const carbsKcal = carbs * 4;
  const tdee = proteinKcal + fatKcal + carbsKcal;

  return {
    ...base,
    tdee,
    protein,
    carbs,
    fat,
  };
}

export function getWeeklyAverage(
  base: MacroResult,
  days: CarbDay[],
): MacroResult {
  if (days.length === 0) return base;

  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalKcal = 0;

  for (const day of days) {
    const d = calculateDayMacros(base, day);
    totalProtein += d.protein;
    totalCarbs += d.carbs;
    totalFat += d.fat;
    totalKcal += d.tdee;
  }

  const count = days.length;
  return {
    ...base,
    tdee: Math.round(totalKcal / count),
    protein: Math.round(totalProtein / count),
    carbs: Math.round(totalCarbs / count),
    fat: Math.round(totalFat / count),
  };
}

export function getCarbDayLabel(day: CarbDay): string {
  const labels: Record<CarbDay, string> = {
    high: "Alto",
    moderate: "Medio",
    low: "Bajo",
    refeed: "Refeed",
  };
  return labels[day];
}

export function getCarbDayColor(day: CarbDay): string {
  const colors: Record<CarbDay, string> = {
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    moderate: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    low: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    refeed: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  };
  return colors[day];
}

export function getCarbDayKcalAdjustment(baseKcal: number, day: CarbDay): { kcal: number; label: string } {
  const mod = CARB_MODIFIERS[day];
  const avg = (CARB_MODIFIERS.high + CARB_MODIFIERS.moderate + CARB_MODIFIERS.low) / 3;
  const diff = Math.round(baseKcal * (mod - avg));
  if (diff > 0) return { kcal: diff, label: `+${diff} kcal` };
  if (diff < 0) return { kcal: diff, label: `${diff} kcal` };
  return { kcal: 0, label: "±0 kcal" };
}
