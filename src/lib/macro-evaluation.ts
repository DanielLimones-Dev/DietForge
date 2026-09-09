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
