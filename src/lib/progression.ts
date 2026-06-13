import type { MacroResult, CompetitionPhase } from "@/types";
import { calculateWeightTrend } from "./trends";
import type { ClientMeasurement, CheckIn } from "@/types";

export interface AdjustmentSuggestion {
  action: string;
  carbChange: number;
  fatChange: number;
  proteinChange: number;
  reason: string;
}

export function suggestAdjustment(
  currentMacros: MacroResult,
  dataPoints: (ClientMeasurement | CheckIn)[],
  phase: CompetitionPhase,
  targetRate: number,
): AdjustmentSuggestion {
  const trend = calculateWeightTrend(dataPoints);
  const changePercent = trend.weeklyChangePercent;

  if (changePercent === null) {
    return { action: "mantener", carbChange: 0, fatChange: 0, proteinChange: 0, reason: "Datos insuficientes para ajustar" };
  }

  const deficit = changePercent < 0;

  if (phase === "precontest" || phase === "peak_week") {
    if (deficit) {
      if (Math.abs(changePercent) > targetRate + 0.3) {
        const excess = Math.abs(changePercent) - targetRate;
        const carbCut = Math.round(excess * 100);
        return {
          action: "reducir_carbs",
          carbChange: -carbCut,
          fatChange: 0,
          proteinChange: 0,
          reason: `Pérdida muy rápida (${Math.abs(changePercent)}%/sem). Reducir ${carbCut}g de carbos`,
        };
      }
      if (Math.abs(changePercent) < targetRate - 0.3) {
        const addCarbs = Math.round((targetRate - Math.abs(changePercent)) * 80);
        return {
          action: "aumentar_carbs",
          carbChange: addCarbs,
          fatChange: 0,
          proteinChange: 0,
          reason: `Pérdida muy lenta (${Math.abs(changePercent)}%/sem). Aumentar ${addCarbs}g de carbos`,
        };
      }
      return {
        action: "mantener",
        carbChange: 0, fatChange: 0, proteinChange: 0,
        reason: `Ritmo ideal (${Math.abs(changePercent)}%/sem). Mantener macros`,
      };
    }
    return {
      action: "revisar",
      carbChange: -50,
      fatChange: -10,
      proteinChange: 0,
      reason: `El cliente está ganando peso en fase de definición. Reducir calorías`,
    };
  }

  if (phase === "offseason") {
    if (!deficit && changePercent > 0) {
      if (changePercent > targetRate + 0.3) {
        const excess = changePercent - targetRate;
        const carbCut = Math.round(excess * 80);
        return {
          action: "reducir_carbs",
          carbChange: -carbCut,
          fatChange: 0,
          proteinChange: 0,
          reason: `Ganancia muy rápida (${changePercent}%/sem). Reducir ${carbCut}g de carbos`,
        };
      }
      if (changePercent < targetRate - 0.2) {
        const addCarbs = Math.round((targetRate - changePercent) * 100);
        return {
          action: "aumentar_carbs",
          carbChange: addCarbs,
          fatChange: 0,
          proteinChange: 0,
          reason: `Ganancia muy lenta (${changePercent}%/sem). Aumentar ${addCarbs}g de carbos`,
        };
      }
      return {
        action: "mantener",
        carbChange: 0, fatChange: 0, proteinChange: 0,
        reason: `Ritmo ideal (${changePercent}%/sem). Mantener`,
      };
    }
    return {
      action: "revisar",
      carbChange: 50,
      fatChange: 10,
      proteinChange: 0,
      reason: `Cliente perdiendo peso en off-season. Aumentar calorías`,
    };
  }

  return { action: "mantener", carbChange: 0, fatChange: 0, proteinChange: 0, reason: "Sin ajustes necesarios" };
}

export function getTargetRate(phase: CompetitionPhase): number {
  const targets: Record<CompetitionPhase, number> = {
    offseason: 0.5,
    precontest: 0.7,
    peak_week: 1.5,
    transition: 0.5,
  };
  return targets[phase];
}
