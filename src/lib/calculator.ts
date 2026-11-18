import type { ActivityLevel, Goal, MacroResult } from "@/types";

export type BmrFormula = "auto" | "mifflin" | "katch" | "cunningham" | "harris" | "iiaff";
export type GoalAdjustmentMode = "standard" | "kcal" | "percent";
export type MacroDistributionMode = "percent" | "per_kg";

export interface ClinicalCalcOptions {
  formula?: BmrFormula;
  includeTef?: boolean;
  goalMode?: GoalAdjustmentMode;
  customGoalDelta?: number;
  macroMode?: MacroDistributionMode;
  proteinPerKg?: number;
  fatPerKg?: number;
}

export interface BmrFormulaMeta {
  id: BmrFormula;
  label: string;
  shortLabel: string;
  requiresBodyFat: boolean;
  summary: string;
}

export const BMR_FORMULAS: BmrFormulaMeta[] = [
  {
    id: "auto",
    label: "Automática",
    shortLabel: "Auto",
    requiresBodyFat: false,
    summary: "Usa IIAFF si hay % de grasa y Mifflin-St Jeor cuando no se registra.",
  },
  {
    id: "mifflin",
    label: "Mifflin-St Jeor",
    shortLabel: "Mifflin",
    requiresBodyFat: false,
    summary: "Estándar clínico general basado en peso, estatura, edad y sexo.",
  },
  {
    id: "katch",
    label: "Katch-McArdle",
    shortLabel: "Katch",
    requiresBodyFat: true,
    summary: "Basada en masa libre de grasa (370 + 21.6 × MLG). Ideal para atletas.",
  },
  {
    id: "cunningham",
    label: "Cunningham",
    shortLabel: "Cunningham",
    requiresBodyFat: true,
    summary: "Enfocada en deportistas con alta masa muscular (500 + 22 × MLG).",
  },
  {
    id: "harris",
    label: "Harris-Benedict",
    shortLabel: "Harris-B",
    requiresBodyFat: false,
    summary: "Ecuación revisada (Roza & Shizgal) para población adulta general.",
  },
  {
    id: "iiaff",
    label: "IIAFF",
    shortLabel: "IIAFF",
    requiresBodyFat: true,
    summary: "Considera masa magra, masa grasa, edad y sexo.",
  },
];

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const GOAL_ADJUSTMENTS: Record<Goal, { kcal: number }> = {
  lose_fat: { kcal: -500 },
  maintain: { kcal: 0 },
  build_muscle: { kcal: 300 },
  gain_weight: { kcal: 500 },
};

const MACRO_SPLIT = { carbs: 0.5, protein: 0.23, fat: 0.27 };

export function calculateBodyFatFromSkinfolds(
  skinfolds: {
    chest?: number;
    abdominal?: number;
    thigh?: number;
    triceps?: number;
    subscapular?: number;
    suprailiac?: number;
    biceps?: number;
    iliacCrest?: number;
    supraspinale?: number;
    medialCalf?: number;
  },
  sex: "male" | "female",
  age: number,
): number | null {
  if (sex === "male") {
    if (skinfolds.chest && skinfolds.abdominal && skinfolds.thigh) {
      const sum = skinfolds.chest + skinfolds.abdominal + skinfolds.thigh;
      const bd = 1.10938 - 0.0008267 * sum + 0.0000016 * sum * sum - 0.0002574 * age;
      return Math.round((495 / bd - 450) * 10) / 10;
    }
  } else {
    if (skinfolds.triceps && skinfolds.suprailiac && skinfolds.thigh) {
      const sum = skinfolds.triceps + skinfolds.suprailiac + skinfolds.thigh;
      const bd = 1.0994921 - 0.0009929 * sum + 0.0000023 * sum * sum - 0.0001392 * age;
      return Math.round((495 / bd - 450) * 10) / 10;
    }
  }
  return null;
}

export function calculateMifflinStJeor(
  weight: number,
  height: number,
  age: number,
  sex: "male" | "female",
): number {
  if (sex === "male") {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  }
  return 10 * weight + 6.25 * height - 5 * age - 161;
}

export function calculateKatchMcArdle(
  weight: number,
  bodyFat: number,
): number {
  const lbm = weight * (1 - bodyFat / 100);
  return 370 + 21.6 * lbm;
}

export function calculateCunningham(
  weight: number,
  bodyFat: number,
): number {
  const lbm = weight * (1 - bodyFat / 100);
  return 500 + 22 * lbm;
}

export function calculateHarrisBenedict(
  weight: number,
  height: number,
  age: number,
  sex: "male" | "female",
): number {
  if (sex === "male") {
    return 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age;
  }
  return 447.593 + 9.247 * weight + 3.098 * height - 4.330 * age;
}

export function calculateIIAFF(
  weight: number,
  bodyFat: number,
  age: number,
  sex: "male" | "female",
): number {
  const lbm = weight * (1 - bodyFat / 100);
  const fm = weight - lbm;
  if (sex === "male") {
    return 13.587 * lbm + 9.613 * fm + 198 - 3.351 * age + 674;
  }
  return 13.587 * lbm + 9.613 * fm - 3.351 * age + 674;
}

export function resolveTmb(
  weight: number,
  height: number,
  age: number,
  sex: "male" | "female",
  bodyFat?: number,
  formula: BmrFormula = "auto",
): { tmb: number; resolvedFormula: Exclude<BmrFormula, "auto">; usedFallback: boolean } {
  const hasBodyFat = typeof bodyFat === "number" && Number.isFinite(bodyFat) && bodyFat > 0 && bodyFat < 100;

  if (formula === "auto") {
    if (hasBodyFat) {
      return { tmb: calculateIIAFF(weight, bodyFat, age, sex), resolvedFormula: "iiaff", usedFallback: false };
    }
    return { tmb: calculateMifflinStJeor(weight, height, age, sex), resolvedFormula: "mifflin", usedFallback: false };
  }
  if (formula === "mifflin") {
    return { tmb: calculateMifflinStJeor(weight, height, age, sex), resolvedFormula: "mifflin", usedFallback: false };
  }
  if (formula === "harris") {
    return { tmb: calculateHarrisBenedict(weight, height, age, sex), resolvedFormula: "harris", usedFallback: false };
  }
  if (formula === "katch") {
    if (hasBodyFat) {
      return { tmb: calculateKatchMcArdle(weight, bodyFat), resolvedFormula: "katch", usedFallback: false };
    }
    return { tmb: calculateMifflinStJeor(weight, height, age, sex), resolvedFormula: "mifflin", usedFallback: true };
  }
  if (formula === "cunningham") {
    if (hasBodyFat) {
      return { tmb: calculateCunningham(weight, bodyFat), resolvedFormula: "cunningham", usedFallback: false };
    }
    return { tmb: calculateMifflinStJeor(weight, height, age, sex), resolvedFormula: "mifflin", usedFallback: true };
  }
  if (hasBodyFat) {
    return { tmb: calculateIIAFF(weight, bodyFat, age, sex), resolvedFormula: "iiaff", usedFallback: false };
  }
  return { tmb: calculateMifflinStJeor(weight, height, age, sex), resolvedFormula: "mifflin", usedFallback: true };
}

function computeTargetEnergy(
  tmb: number,
  activityLevel: ActivityLevel,
  goal: Goal,
  options?: ClinicalCalcOptions,
): { maintenanceTdee: number; adjustedKcal: number; goalDeltaKcal: number } {
  const tefMultiplier = options?.includeTef === false ? 1 : 1.1;
  const maintenanceTdee = Math.round(tmb * ACTIVITY_MULTIPLIERS[activityLevel] * tefMultiplier);

  const goalMode = options?.goalMode ?? "standard";
  let adjustedKcal = maintenanceTdee;
  if (goalMode === "kcal") {
    const delta = Number.isFinite(options?.customGoalDelta) ? Number(options?.customGoalDelta) : 0;
    adjustedKcal = Math.max(800, Math.round(maintenanceTdee + delta));
  } else if (goalMode === "percent") {
    const pct = Number.isFinite(options?.customGoalDelta) ? Number(options?.customGoalDelta) : 0;
    adjustedKcal = Math.max(800, Math.round(maintenanceTdee * (1 + pct / 100)));
  } else {
    adjustedKcal = Math.max(800, maintenanceTdee + GOAL_ADJUSTMENTS[goal].kcal);
  }

  return {
    maintenanceTdee,
    adjustedKcal,
    goalDeltaKcal: adjustedKcal - maintenanceTdee,
  };
}

export function calculateMacros(
  weight: number,
  height: number,
  age: number,
  sex: "male" | "female",
  activityLevel: ActivityLevel,
  goal: Goal,
  bodyFat?: number,
  options?: ClinicalCalcOptions,
): MacroResult {
  const { tmb } = resolveTmb(weight, height, age, sex, bodyFat, options?.formula ?? "auto");
  const { adjustedKcal } = computeTargetEnergy(tmb, activityLevel, goal, options);

  let protein: number;
  let fat: number;
  let carbs: number;

  if (options?.macroMode === "per_kg") {
    const pPerKg = Number.isFinite(options.proteinPerKg) && (options.proteinPerKg ?? 0) >= 0 ? Number(options.proteinPerKg) : 2.0;
    const fPerKg = Number.isFinite(options.fatPerKg) && (options.fatPerKg ?? 0) >= 0 ? Number(options.fatPerKg) : 0.8;
    protein = Math.round(weight * pPerKg);
    fat = Math.round(weight * fPerKg);
    carbs = Math.max(0, Math.round((adjustedKcal - protein * 4 - fat * 9) / 4));
  } else {
    protein = Math.round((adjustedKcal * MACRO_SPLIT.protein) / 4);
    fat = Math.round((adjustedKcal * MACRO_SPLIT.fat) / 9);
    carbs = Math.round((adjustedKcal * MACRO_SPLIT.carbs) / 4);
  }

  const fiber = Math.round(weight * 0.3);
  const antioxidants = 1;

  return {
    tmb: Math.round(tmb),
    tdee: adjustedKcal,
    protein,
    carbs,
    fat,
    fiber,
    antioxidants,
  };
}

export interface ClinicalFormulaComparison {
  id: Exclude<BmrFormula, "auto">;
  label: string;
  tmb: number;
  maintenanceTdee: number;
  targetKcal: number;
  available: boolean;
}

export interface ClinicalPreview {
  macros: MacroResult;
  maintenanceTdee: number;
  goalDeltaKcal: number;
  weeklyWeightDeltaKg: number;
  resolvedFormula: Exclude<BmrFormula, "auto">;
  usedFallback: boolean;
  perKg: { protein: number; carbs: number; fat: number };
  formulaComparisons: ClinicalFormulaComparison[];
}

export function calculateClinicalPreview(
  weight: number,
  height: number,
  age: number,
  sex: "male" | "female",
  activityLevel: ActivityLevel,
  goal: Goal,
  bodyFat?: number,
  options?: ClinicalCalcOptions,
): ClinicalPreview {
  const { tmb, resolvedFormula, usedFallback } = resolveTmb(
    weight,
    height,
    age,
    sex,
    bodyFat,
    options?.formula ?? "auto",
  );
  const { maintenanceTdee, goalDeltaKcal } = computeTargetEnergy(tmb, activityLevel, goal, options);
  const macros = calculateMacros(weight, height, age, sex, activityLevel, goal, bodyFat, options);
  const weeklyWeightDeltaKg = Math.round(((goalDeltaKcal * 7) / 7700) * 100) / 100;
  const safeWeight = weight > 0 ? weight : 1;

  const hasBodyFat = typeof bodyFat === "number" && Number.isFinite(bodyFat) && bodyFat > 0 && bodyFat < 100;
  const comparisonIds: Exclude<BmrFormula, "auto">[] = ["mifflin", "harris", "katch", "cunningham", "iiaff"];
  const formulaComparisons: ClinicalFormulaComparison[] = comparisonIds.map((id) => {
    const meta = BMR_FORMULAS.find((item) => item.id === id)!;
    const available = !meta.requiresBodyFat || hasBodyFat;
    const resolved = resolveTmb(weight, height, age, sex, bodyFat, id);
    const energy = computeTargetEnergy(resolved.tmb, activityLevel, goal, options);
    return {
      id,
      label: meta.shortLabel,
      tmb: Math.round(resolved.tmb),
      maintenanceTdee: energy.maintenanceTdee,
      targetKcal: energy.adjustedKcal,
      available,
    };
  });

  return {
    macros,
    maintenanceTdee,
    goalDeltaKcal,
    weeklyWeightDeltaKg,
    resolvedFormula,
    usedFallback,
    perKg: {
      protein: Math.round((macros.protein / safeWeight) * 100) / 100,
      carbs: Math.round((macros.carbs / safeWeight) * 100) / 100,
      fat: Math.round((macros.fat / safeWeight) * 100) / 100,
    },
    formulaComparisons,
  };
}

export function adjustMacroField(
  current: { protein: number; carbs: number; fat: number },
  field: "protein" | "carbs" | "fat",
  value: number,
  targetKcal: number,
): { protein: number; carbs: number; fat: number } {
  const p = field === "protein" ? value : current.protein;
  let c = field === "carbs" ? value : current.carbs;
  let f = field === "fat" ? value : current.fat;

  if (field === "protein" || field === "fat") {
    const proteinKcal = p * 4;
    const fatKcal = f * 9;
    const remaining = targetKcal - proteinKcal - fatKcal;
    c = Math.round(Math.max(0, remaining / 4));
  } else {
    const proteinKcal = p * 4;
    const carbsKcal = c * 4;
    const remaining = targetKcal - proteinKcal - carbsKcal;
    f = Math.round(Math.max(0, remaining / 9));
  }

  return { protein: p, carbs: c, fat: f };
}

export function macroKcal(m: { protein: number; carbs: number; fat: number }): number {
  return m.protein * 4 + m.carbs * 4 + m.fat * 9;
}

export function distributeMeals(
  macros: MacroResult,
  mealCount: number,
  hasWorkout: boolean,
) {
  const meals: {
    label: string;
    key: string;
    percentage: number;
    protein: number;
    carbs: number;
    fat: number;
  }[] = [];

  let remaining = 100;
  // mealCount counts regular meals; workout meals are additional.

  if (hasWorkout) {
    meals.push({
      label: "Pre-entreno",
      key: "pre_workout",
      percentage: 15,
      protein: 0, carbs: 0, fat: 0,
    });
    meals.push({
      label: "Intra-entreno",
      key: "intra_workout",
      percentage: 5,
      protein: 0, carbs: 0, fat: 0,
    });
    meals.push({
      label: "Post-entreno",
      key: "post_workout",
      percentage: 20,
      protein: 0, carbs: 0, fat: 0,
    });
    remaining -= 40;
  }

  const remainingMeals = Number.isFinite(mealCount) ? Math.max(1, Math.min(6, Math.trunc(mealCount))) : 3;
  const perMeal = remainingMeals > 0 ? remaining / remainingMeals : 0;

  for (let i = 0; i < remainingMeals; i++) {
    const isLast = i === remainingMeals - 1;
    const num = i + 1;
    meals.push({
      label: `Comida ${num}`,
      key: `meal${num}`,
      percentage: isLast ? remaining : Math.floor(perMeal),
      protein: 0, carbs: 0, fat: 0,
    });
    remaining -= meals[meals.length - 1].percentage;
  }

  return meals.map((m) => ({
    ...m,
    protein: Math.round(macros.protein * (m.percentage / 100)),
    carbs: Math.round(macros.carbs * (m.percentage / 100)),
    fat: Math.round(macros.fat * (m.percentage / 100)),
  }));
}
