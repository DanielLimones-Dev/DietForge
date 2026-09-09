import type { ClientMeasurement } from "@/types";

interface MacroEvaluationStorage {
  saveMeasurement(measurement: Omit<ClientMeasurement, "id">): ClientMeasurement;
}

/** Persists a macro evaluation without creating or changing any check-in. */
export function saveMacroEvaluation(
  measurement: Omit<ClientMeasurement, "id">,
  storage: MacroEvaluationStorage,
) {
  return storage.saveMeasurement(measurement);
}

export function macroEvaluationAt(evaluations: ClientMeasurement[], index: number) {
  if (evaluations.length === 0) return undefined;
  return evaluations[Math.min(Math.max(0, index), evaluations.length - 1)];
}
