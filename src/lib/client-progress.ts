import type { CheckIn, ClientMeasurement } from "@/types";

export interface WeightComparison {
  current?: number;
  previous?: number;
  previousSource?: "checkin" | "evaluation";
}

/** Uses the prior check-in, or the latest evaluation as the first baseline. */
export function weightComparison(
  checkins: CheckIn[],
  evaluations: ClientMeasurement[],
): WeightComparison {
  const current = checkins[0];
  if (!current) return {};
  const previousCheckIn = checkins[1];
  if (previousCheckIn) {
    return { current: current.weight, previous: previousCheckIn.weight, previousSource: "checkin" };
  }
  const currentDate = current.date.slice(0, 10);
  const baseline = evaluations.find((evaluation) => evaluation.date.slice(0, 10) <= currentDate) ?? evaluations[0];
  return {
    current: current.weight,
    previous: baseline?.weight,
    previousSource: baseline ? "evaluation" : undefined,
  };
}
