import type { CheckIn, ClientMeasurement } from "@/types";

export interface ProgressComparison {
  current?: number;
  previous?: number;
  previousSource?: "checkin" | "evaluation";
}

export interface ProgressChartPoint {
  date: string;
  weight: number;
  bodyFat?: number;
  source: "checkin" | "evaluation";
}

function metricComparison(
  checkins: CheckIn[],
  evaluations: ClientMeasurement[],
  checkInValue: (checkin: CheckIn) => number | undefined,
  evaluationValue: (evaluation: ClientMeasurement) => number | undefined,
): ProgressComparison {
  const candidates = [
    ...checkins.flatMap((checkin) => {
      const value = checkInValue(checkin);
      return value == null ? [] : [{ id: checkin.id, date: checkin.date.slice(0, 10), value, source: "checkin" as const }];
    }),
    ...evaluations.flatMap((evaluation) => {
      const value = evaluationValue(evaluation);
      return value == null ? [] : [{ id: evaluation.id, date: evaluation.date.slice(0, 10), value, source: "evaluation" as const }];
    }),
  ].sort((a, b) =>
      b.date.localeCompare(a.date)
      || Number(b.source === "checkin") - Number(a.source === "checkin")
      || b.id - a.id,
    )
    .filter((candidate, index, rows) => rows.findIndex((row) => row.date === candidate.date) === index);
  const current = candidates[0];
  const baseline = candidates[1];
  return {
    current: current?.value,
    previous: baseline?.value,
    previousSource: baseline?.source,
  };
}

/** Compares the two most recent weight records across check-ins and evaluations. */
export function weightComparison(
  checkins: CheckIn[],
  evaluations: ClientMeasurement[],
): ProgressComparison {
  return metricComparison(checkins, evaluations, (checkin) => checkin.weight, (evaluation) => evaluation.weight);
}

/** Compares the two most recent body-fat records across check-ins and evaluations. */
export function bodyFatComparison(
  checkins: CheckIn[],
  evaluations: ClientMeasurement[],
): ProgressComparison {
  return metricComparison(checkins, evaluations, (checkin) => checkin.body_fat, (evaluation) => evaluation.body_fat);
}

/** Combines anthropometric evaluations and check-ins; a same-day check-in has priority. */
export function progressChart(
  evaluations: ClientMeasurement[],
  checkins: CheckIn[],
): ProgressChartPoint[] {
  const candidates: Array<ProgressChartPoint & { id: number }> = [
    ...evaluations.map((evaluation) => ({
      id: evaluation.id,
      date: evaluation.date.slice(0, 10),
      weight: evaluation.weight,
      bodyFat: evaluation.body_fat,
      source: "evaluation" as const,
    })),
    ...checkins.map((checkin) => ({
      id: checkin.id,
      date: checkin.date.slice(0, 10),
      weight: checkin.weight,
      bodyFat: checkin.body_fat,
      source: "checkin" as const,
    })),
  ]
    .filter((point) => point.weight > 0)
    .sort((a, b) =>
      a.date.localeCompare(b.date)
      || Number(a.source === "checkin") - Number(b.source === "checkin")
      || a.id - b.id,
    )
    .reduce<Array<ProgressChartPoint & { id: number }>>((points, point) => {
      const previous = points[points.length - 1];
      if (previous?.date === point.date) {
        points[points.length - 1] = {
          ...point,
          bodyFat: point.bodyFat ?? previous.bodyFat,
        };
      } else {
        points.push(point);
      }
      return points;
    }, []);
  return candidates.map((point) => ({
    date: point.date,
    weight: point.weight,
    bodyFat: point.bodyFat,
    source: point.source,
  }));
}
