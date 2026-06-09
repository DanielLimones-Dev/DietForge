export interface Client {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SkinfoldMeasurements {
  chest?: number;
  abdominal?: number;
  thigh?: number;
  triceps?: number;
  subscapular?: number;
  suprailiac?: number;
  midaxillary?: number;
}

export interface ClientMeasurement {
  id: number;
  client_id: number;
  date: string;
  weight: number;
  height: number;
  age: number;
  sex: "male" | "female";
  body_fat?: number;
  body_fat_method?: "direct" | "skinfold";
  skinfolds?: SkinfoldMeasurements;
  activity_level: ActivityLevel;
  goal: Goal;
  tmb: number;
  tdee: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  antioxidants: number;
}

export interface Food {
  id: number;
  name: string;
  barcode?: string;
  category: FoodCategory;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  antioxidants: number;
  kcal: number;
  serving_size: number;
  serving_unit: string;
  source: "api" | "manual";
  carb_type?: "fast" | "slow" | "mixed";
}

export interface MealPlan {
  id: number;
  client_id: number;
  measurement_id: number | null;
  date: string;
  name: string;
  total_kcal: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  total_fiber: number;
  total_antioxidants: number;
}

export interface MealPlanItem {
  id: number;
  meal_plan_id: number;
  meal_time: MealTime;
  food_id: number;
  quantity: number;
  serving_unit: string;
}

export interface DietTemplate {
  id: number;
  name: string;
  total_kcal: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  total_fiber: number;
  items: {
    meal_time: MealTime;
    food: Omit<Food, "id" | "source">;
    quantity: number;
    serving_unit: string;
  }[];
  created_at: string;
}

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type Goal = "lose_fat" | "maintain" | "build_muscle" | "gain_weight";

export type MealTime =
  | "pre_workout"
  | "intra_workout"
  | "post_workout"
  | "meal1"
  | "meal2"
  | "meal3"
  | "meal4"
  | "meal5"
  | "meal6";

export type FoodCategory =
  | "protein"
  | "carbs"
  | "vegetables"
  | "fruits"
  | "fats"
  | "dairy"
  | "grains"
  | "legumes"
  | "nuts"
  | "seeds"
  | "beverages"
  | "supplements"
  | "other";

export interface MacroResult {
  tmb: number;
  tdee: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  antioxidants: number;
}
