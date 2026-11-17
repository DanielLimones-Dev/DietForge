import type { Food } from '@/types';

export type FoodMacroKey = 'protein' | 'carbs' | 'fat' | 'kcal';
export type FoodMacroDraft = Record<FoodMacroKey, string>;
export type FoodMacroValues = Record<FoodMacroKey, number>;

const MACRO_KEYS: FoodMacroKey[] = ['protein', 'carbs', 'fat', 'kcal'];

export function foodMacroDraft(food: Pick<Food, FoodMacroKey>): FoodMacroDraft {
  return {
    protein: String(food.protein),
    carbs: String(food.carbs),
    fat: String(food.fat),
    kcal: String(food.kcal),
  };
}

/**
 * The editor accepts decimals and zero but never an empty, negative or
 * non-numeric value, because those would silently distort every plan that
 * uses the food.
 */
export function parseFoodMacroDraft(draft: FoodMacroDraft):
  { ok: true; values: FoodMacroValues } | { ok: false; error: string } {
  const values = {} as FoodMacroValues;
  for (const key of MACRO_KEYS) {
    const raw = draft[key]?.trim() ?? '';
    if (!raw) {
      return { ok: false, error: 'Completa calorías, proteína, carbohidratos y grasas.' };
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      return { ok: false, error: 'Usa números iguales o mayores que cero; se permiten decimales.' };
    }
    values[key] = value;
  }
  return { ok: true, values };
}

export function applyFoodMacros<T extends Food>(food: T, values: FoodMacroValues): T {
  return { ...food, ...values };
}
