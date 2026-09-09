import type { CustomExercise, ExerciseLibraryItem } from "@/types";

function normalizedPart(value: string) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

/** Stable identity used to replace an included exercise with the coach's personalized copy. */
export function exerciseLibraryKey(item: Pick<ExerciseLibraryItem, "name" | "muscle_group">) {
  return `${normalizedPart(item.name)}::${normalizedPart(item.muscle_group)}`;
}

/** Coach copies take priority so the library and routine selector never show duplicates. */
export function mergedExerciseLibrary(custom: CustomExercise[], included: ExerciseLibraryItem[]): ExerciseLibraryItem[] {
  const own = custom.map(item => ({
    id: `coach-${item.id}`,
    name: item.name,
    muscle_group: item.muscle_group,
    video_url: item.video_url,
    notes: item.notes,
  }));
  const personalized = new Set(own.map(exerciseLibraryKey));
  return [...own, ...included.filter(item => !personalized.has(exerciseLibraryKey(item)))];
}
