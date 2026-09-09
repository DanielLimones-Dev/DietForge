export interface Client {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  prep_type?: string;
  tags?: string[];
  check_in_interval_days?: number;
  next_check_in_date?: string;
  created_at: string;
  updated_at: string;
}

export const TAGS_LIST = [
  "recreativo",
  "competidor",
  "precontest",
] as const;

export const PREP_TYPES = [
  { value: "competition", label: "Preparación", color: "bg-rose-500" },
  { value: "recreational", label: "Recreativo", color: "bg-emerald-500" },
  { value: "offseason", label: "Offseason", color: "bg-amber-500" },
  { value: "transition", label: "Transición", color: "bg-blue-500" },
] as const;

export interface SkinfoldMeasurements {
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
}

export interface Isak1Girths {
  armRelaxed?: number;
  armFlexed?: number;
  waist?: number;
  hip?: number;
  calfMax?: number;
}

export interface Isak1Breadths {
  humerus?: number;
  femur?: number;
}

export interface Isak1Data {
  girths?: Isak1Girths;
  breadths?: Isak1Breadths;
  sittingHeight?: number;
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
  body_fat_method?: "direct" | "isak1";
  skinfolds?: SkinfoldMeasurements;
  isak_data?: Isak1Data;
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

export interface Competition {
  id: number;
  client_id: number;
  name: string;
  date: string;
  category?: string;
  weight?: number;
  placement?: number;
  notes?: string;
  peak_week_config?: string;
}

export type PeakWeekMarker = "inicio_competencia" | "macro_adjust" | "water_manip" | "sodium_manip" | "carb_load" | "puesta_punto" | "show_day";

export interface PeakWeekDayConfig {
  reminder?: string;
  date: string;
  phase: string;
  markers: PeakWeekMarker[];
  notes: string;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export type CompetitionPhase = "offseason" | "precontest" | "peak_week" | "transition";

export interface PhaseConfig {
  phase: CompetitionPhase;
  client_id: number;
  start_date: string;
  end_date?: string;
  competition_id?: number;
  protein_multiplier: number;
  carb_range: { min: number; max: number };
  fat_range: { min: number; max: number };
}

export type CarbDay = "high" | "moderate" | "low" | "refeed";

export interface CarbCyclePattern {
  name: string;
  days: CarbDay[];
  description: string;
}

export const DEFAULT_CARB_PATTERNS: CarbCyclePattern[] = [
  { name: "Balanceado", days: ["moderate", "moderate", "moderate", "moderate", "moderate", "moderate", "moderate"], description: "Macros iguales todos los días" },
  { name: "Alto-Bajo", days: ["high", "low", "high", "low", "high", "low", "moderate"], description: "Día alto → día bajo, descarga gradual" },
  { name: "Alto-Medio-Bajo", days: ["high", "moderate", "low", "high", "moderate", "low", "refeed"], description: "Rotación 3 días + refeed" },
  { name: "Pre-Contest", days: ["low", "moderate", "low", "high", "low", "low", "refeed"], description: "Bajos la mayoría, refeed fin de semana" },
  { name: "Peak Loading", days: ["low", "low", "moderate", "moderate", "high", "high", "high"], description: "Descarga → carga progresiva para show" },
];

export interface BodyMeasurements {
  neck?: number;
  shoulders?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  left_arm?: number;
  right_arm?: number;
  left_thigh?: number;
  right_thigh?: number;
  left_calf?: number;
  right_calf?: number;
}

export interface CheckIn {
  id: number;
  client_id: number;
  date: string;
  weight: number;
  body_fat?: number;
  measurements?: BodyMeasurements;
  photos?: PhotoRef[];
  adherence?: Adherence;
  notes?: string;
  coach_feedback?: string;
}

export interface PhotoRef {
  id: number;
  checkin_id: number;
  angle: PhotoAngle;
  data: string;
  date: string;
}

export type PhotoAngle = "front_relaxed" | "back_relaxed" | "front_double_biceps" | "back_lat_spread" | "side_chest" | "side_triceps" | "ab_thigh" | "most_muscular";

export interface Adherence {
  meals: number;
  supplements: number;
  training: number;
  cardio: number;
  energy: number;
  sleep: number;
  hunger: number;
  libido: number;
  digestion: number;
}

export interface WeekPlan {
  id: number;
  client_id: number;
  phase?: CompetitionPhase;
  start_date: string;
  name: string;
  day_plans: DayPlan[];
  notes?: string;
}

export interface DayPlan {
  day: number;
  carb_day: CarbDay;
  meal_plan_id: number;
  rest_day?: boolean;
}

export type TrainingGoal = "hypertrophy" | "strength" | "recomposition" | "conditioning" | "maintenance";
export type TrainingProgramStatus = "draft" | "active" | "archived";

export interface ExerciseLibraryItem {
  id: string;
  name: string;
  muscle_group: string;
  video_url?: string | null;
  notes?: string;
}

/** Exercise created by the coach and persisted in the account catalog. */
export interface CustomExercise {
  id: number;
  name: string;
  muscle_group: string;
  video_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingPrescription {
  load_kg?: number;
  week: number;
  sets: number;
  reps_min: number;
  reps_max: number;
  rir_start: number;
  rir_end: number;
}

export interface TrainingExercise {
  video_custom?: boolean;
  secondary_muscles?: string[];
  indirect_factor?: number;
  id: string;
  library_id?: string;
  name: string;
  muscle_group: string;
  video_url?: string;
  notes?: string;
  prescriptions: TrainingPrescription[];
}

export interface TrainingDay {
  weekday_offset?: number;
  id: string;
  day_number: number;
  name: string;
  notes?: string;
  exercises: TrainingExercise[];
}

export interface TrainingBlockReview {
  session_fatigue: number[];
  general_fatigue?: number;
  volume_tolerance?: number;
  soreness?: string;
  hardest_session?: string;
  uncomfortable_exercises?: string;
  keep_exercises?: string;
}

export interface TrainingProgram {
  /** Independent schedule for each week. `days` remains the week-one legacy view. */
  week_days?: Record<string, TrainingDay[]>;
  /** Coach target by week and muscle; compared with calculated exercise sets. */
  weekly_volume_targets?: Record<string, Record<string, number>>;
  resources?: { id: string; title: string; url: string }[];
  volume_ranges?: Record<string, { min: number; max: number }>;
  approval_history?: { date: string; exercise_id: string; week: number; message: string }[];
  id: number;
  client_id: number;
  name: string;
  objective: TrainingGoal;
  start_date: string;
  duration_weeks: number;
  mesocycle_number: number;
  rotation_number: number;
  priorities: string[];
  split: string;
  notes?: string;
  status: TrainingProgramStatus;
  days: TrainingDay[];
  review?: TrainingBlockReview;
  created_at: string;
  updated_at: string;
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
  competition_id?: number;
  peak_week_date?: string;
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
  /** Missing on historical items, which belong to the normal day. */
  day_type?: "normal" | "rest";
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
