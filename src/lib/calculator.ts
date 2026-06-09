import type { ActivityLevel, Goal, MacroResult } from "@/types";

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_ADJUSTMENTS: Record<Goal, { kcal: number }> = {
  lose_fat: { kcal: -500 },
  maintain: { kcal: 0 },
  build_muscle: { kcal: 300 },
  gain_weight: { kcal: 500 },
};

export function calculateBodyFatFromSkinfolds(
  skinfolds: {
    chest?: number;
    abdominal?: number;
    thigh?: number;
    triceps?: number;
    subscapular?: number;
    suprailiac?: number;
    midaxillary?: number;
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

export function calculateMacros(
  weight: number,
  height: number,
  age: number,
  sex: "male" | "female",
  activityLevel: ActivityLevel,
  goal: Goal,
  bodyFat?: number,
): MacroResult {
  let tmb: number;
  if (bodyFat && bodyFat > 0) {
    tmb = calculateKatchMcArdle(weight, bodyFat);
  } else {
    tmb = calculateMifflinStJeor(weight, height, age, sex);
  }

  const tdee = Math.round(tmb * ACTIVITY_MULTIPLIERS[activityLevel]);
  const adjustedKcal = tdee + GOAL_ADJUSTMENTS[goal].kcal;

  const protein = Math.round(weight * (goal === "build_muscle" ? 2.2 : 1.8));
  const fat = Math.round(weight * 0.8);
  const proteinKcal = protein * 4;
  const fatKcal = fat * 9;
  const carbsKcal = adjustedKcal - proteinKcal - fatKcal;
  const carbs = Math.round(Math.max(0, carbsKcal / 4));
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
  let mealIndex = 0;

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
    mealIndex = 3;
  }

  const remainingMeals = mealCount - mealIndex;
  const perMeal = remaining / remainingMeals;

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
