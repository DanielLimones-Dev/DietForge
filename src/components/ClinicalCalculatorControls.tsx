"use client";

import { useMemo } from "react";
import {
  BMR_FORMULAS,
  calculateClinicalPreview,
  type BmrFormula,
  type ClinicalCalcOptions,
  type GoalAdjustmentMode,
  type MacroDistributionMode,
} from "@/lib/calculator";
import type { ActivityLevel, Goal } from "@/types";
import { Flame, FlaskConical, Scale, SlidersHorizontal, Sparkles } from "lucide-react";

interface ClinicalCalculatorControlsProps {
  weight: number;
  height: number;
  age: number;
  sex: "male" | "female";
  bodyFat?: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  options: ClinicalCalcOptions;
  onChange: (next: ClinicalCalcOptions) => void;
}

const FORMULA_NAME_MAP: Record<Exclude<BmrFormula, "auto">, string> = {
  mifflin: "Mifflin-St Jeor",
  katch: "Katch-McArdle",
  cunningham: "Cunningham",
  harris: "Harris-Benedict",
  iiaff: "IIAFF",
};

export function ClinicalCalculatorControls({
  weight,
  height,
  age,
  sex,
  bodyFat,
  activityLevel,
  goal,
  options,
  onChange,
}: ClinicalCalculatorControlsProps) {
  const formula = options.formula ?? "auto";
  const includeTef = options.includeTef !== false;
  const goalMode = options.goalMode ?? "standard";
  const customGoalDelta = options.customGoalDelta ?? -300;
  const macroMode = options.macroMode ?? "percent";
  const proteinPerKg = options.proteinPerKg ?? 2.0;
  const fatPerKg = options.fatPerKg ?? 0.8;

  const hasValidInputs =
    Number.isFinite(weight) && weight > 0 &&
    Number.isFinite(height) && height > 0 &&
    Number.isFinite(age) && age > 0;

  const hasBodyFat = typeof bodyFat === "number" && Number.isFinite(bodyFat) && bodyFat > 0 && bodyFat < 100;

  const activeFormulaMeta = BMR_FORMULAS.find((item) => item.id === formula) ?? BMR_FORMULAS[0];

  const preview = useMemo(() => {
    if (!hasValidInputs) return null;
    return calculateClinicalPreview(
      weight,
      height,
      age,
      sex,
      activityLevel,
      goal,
      hasBodyFat ? bodyFat : undefined,
      options,
    );
  }, [hasValidInputs, weight, height, age, sex, activityLevel, goal, hasBodyFat, bodyFat, options]);

  const setFormula = (nextFormula: BmrFormula) => onChange({ ...options, formula: nextFormula });
  const setGoalMode = (nextMode: GoalAdjustmentMode) => {
    const defaultDelta = nextMode === "percent" ? -15 : nextMode === "kcal" ? -300 : 0;
    onChange({
      ...options,
      goalMode: nextMode,
      customGoalDelta: options.goalMode === nextMode ? options.customGoalDelta : defaultDelta,
    });
  };
  const setMacroMode = (nextMode: MacroDistributionMode) => onChange({ ...options, macroMode: nextMode });

  return (
    <div className="calc-pro-stack">
      {/* Fórmula metabólica */}
      <section className="calc-pro-panel">
        <header className="calc-pro-panel-head">
          <div>
            <span className="calc-pro-kicker"><FlaskConical className="w-3.5 h-3.5" /> Ecuación de TMB</span>
            <h4>Fórmula metabólica</h4>
          </div>
          <span className="calc-pro-badge">
            {hasBodyFat ? `Grasa corporal: ${bodyFat}%` : "Sin % grasa (usa estatura y peso)"}
          </span>
        </header>

        <div className="calc-pro-formula-grid" role="radiogroup" aria-label="Fórmula metabólica">
          {BMR_FORMULAS.map((item) => {
            const active = formula === item.id;
            const needsBf = item.requiresBodyFat && !hasBodyFat;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setFormula(item.id)}
                className={`calc-pro-formula-pill ${active ? "is-active" : ""} ${needsBf ? "is-muted" : ""}`.trim()}
              >
                <span>{item.label}</span>
                {item.requiresBodyFat && (
                  <small>{hasBodyFat ? "MLG" : "Req. % grasa"}</small>
                )}
              </button>
            );
          })}
        </div>

        <p className="calc-pro-hint">
          {activeFormulaMeta.summary}
          {preview?.usedFallback && (
            <strong className="calc-pro-fallback-note">
              {" "}· Sin % grasa ingresado: usando Mifflin-St Jeor como respaldo.
            </strong>
          )}
        </p>
      </section>

      {/* Estrategia energética y distribución de macros */}
      <section className="calc-pro-strategy-grid">
        <div className="calc-pro-panel">
          <header className="calc-pro-panel-head">
            <div>
              <span className="calc-pro-kicker"><Flame className="w-3.5 h-3.5" /> Gasto y déficit</span>
              <h4>TEF y ajuste calórico</h4>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={includeTef}
              onClick={() => onChange({ ...options, includeTef: !includeTef })}
              className={`calc-pro-tef-toggle ${includeTef ? "is-on" : ""}`.trim()}
            >
              <i />
              <span>TEF {includeTef ? "+10% activo" : "desactivado"}</span>
            </button>
          </header>

          <div className="calc-pro-segmented" role="tablist" aria-label="Modo de ajuste calórico">
            {(
              [
                { id: "standard", label: "Estándar" },
                { id: "kcal", label: "Kcal exactas" },
                { id: "percent", label: "Porcentaje (%)" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={goalMode === tab.id}
                onClick={() => setGoalMode(tab.id)}
                className={goalMode === tab.id ? "is-active" : ""}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {goalMode === "standard" ? (
            <p className="calc-pro-hint">
              Aplica el delta clásico según el objetivo seleccionado (−500 / 0 / +300 / +500 kcal).
            </p>
          ) : (
            <div className="calc-pro-inline-control">
              <div className="calc-pro-number-field">
                <label>{goalMode === "kcal" ? "Delta diario (kcal)" : "Variación sobre TDEE (%)"}</label>
                <div className="relative">
                  <input
                    type="number"
                    step={goalMode === "kcal" ? 50 : 1}
                    value={customGoalDelta}
                    onChange={(e) => onChange({ ...options, customGoalDelta: Number(e.target.value) || 0 })}
                    className="calc-pro-input"
                  />
                  <span className="calc-pro-unit">{goalMode === "kcal" ? "kcal" : "%"}</span>
                </div>
              </div>
              <div className="calc-pro-presets">
                {(goalMode === "kcal" ? [-500, -300, 0, 250, 400] : [-20, -15, -10, 10, 15]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onChange({ ...options, customGoalDelta: preset })}
                    className={customGoalDelta === preset ? "is-active" : ""}
                  >
                    {preset > 0 ? `+${preset}` : preset}{goalMode === "percent" ? "%" : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="calc-pro-panel">
          <header className="calc-pro-panel-head">
            <div>
              <span className="calc-pro-kicker"><SlidersHorizontal className="w-3.5 h-3.5" /> Reparto</span>
              <h4>Distribución de macros</h4>
            </div>
            <span className="calc-pro-badge">
              {macroMode === "percent" ? "23% P · 50% C · 27% G" : "Basado en peso corporal"}
            </span>
          </header>

          <div className="calc-pro-segmented" role="tablist" aria-label="Modo de distribución de macros">
            <button
              type="button"
              role="tab"
              aria-selected={macroMode === "percent"}
              onClick={() => setMacroMode("percent")}
              className={macroMode === "percent" ? "is-active" : ""}
            >
              Porcentaje estándar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={macroMode === "per_kg"}
              onClick={() => setMacroMode("per_kg")}
              className={macroMode === "per_kg" ? "is-active" : ""}
            >
              Gramos por kg
            </button>
          </div>

          {macroMode === "percent" ? (
            <p className="calc-pro-hint">
              Reparto equilibrado: 23% proteína, 50% carbohidratos y 27% grasas sobre la meta calórica.
            </p>
          ) : (
            <div className="calc-pro-perkg-grid">
              <div className="calc-pro-number-field">
                <label>Proteína (g/kg)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="4"
                    value={proteinPerKg}
                    onChange={(e) => onChange({ ...options, proteinPerKg: Math.max(0, Number(e.target.value) || 0) })}
                    className="calc-pro-input"
                  />
                  <span className="calc-pro-unit">g/kg</span>
                </div>
              </div>
              <div className="calc-pro-number-field">
                <label>Grasas (g/kg)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.3"
                    max="2.5"
                    value={fatPerKg}
                    onChange={(e) => onChange({ ...options, fatPerKg: Math.max(0, Number(e.target.value) || 0) })}
                    className="calc-pro-input"
                  />
                  <span className="calc-pro-unit">g/kg</span>
                </div>
              </div>
              <p className="calc-pro-hint calc-pro-perkg-note">
                Los carbohidratos completan automáticamente las calorías restantes.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Vista previa de impacto en vivo */}
      <section className="calc-pro-preview">
        <header className="calc-pro-preview-head">
          <div>
            <span className="calc-pro-kicker"><Sparkles className="w-3.5 h-3.5" /> Vista previa clínica</span>
            <h4>Impacto energético estimado</h4>
          </div>
          {preview && (
            <span className="calc-pro-formula-tag">
              <Scale className="w-3.5 h-3.5" /> {FORMULA_NAME_MAP[preview.resolvedFormula]}
            </span>
          )}
        </header>

        {!preview ? (
          <div className="calc-pro-preview-empty">
            Ingresa peso, altura y edad para ver la vista previa en vivo y comparar las fórmulas metabólicas.
          </div>
        ) : (
          <>
            <div className="calc-pro-kpi-grid">
              <article>
                <span>TMB Basal</span>
                <strong>{preview.macros.tmb.toLocaleString("es-MX")} <small>kcal</small></strong>
                <p>{FORMULA_NAME_MAP[preview.resolvedFormula]}</p>
              </article>
              <article>
                <span>Mantenimiento (TDEE)</span>
                <strong>{preview.maintenanceTdee.toLocaleString("es-MX")} <small>kcal</small></strong>
                <p>{includeTef ? "Incluye TEF +10%" : "Sin ajuste TEF"}</p>
              </article>
              <article className="is-highlight">
                <span>Meta diaria</span>
                <strong>{preview.macros.tdee.toLocaleString("es-MX")} <small>kcal</small></strong>
                <p>
                  {preview.goalDeltaKcal === 0
                    ? "Balance neutro"
                    : `${preview.goalDeltaKcal > 0 ? "+" : ""}${preview.goalDeltaKcal} kcal/día`}
                </p>
              </article>
              <article>
                <span>Cambio semanal est.</span>
                <strong>
                  {preview.weeklyWeightDeltaKg > 0 ? "+" : ""}
                  {preview.weeklyWeightDeltaKg.toFixed(2)} <small>kg/sem</small>
                </strong>
                <p>
                  {preview.weeklyWeightDeltaKg < -0.05
                    ? "Ritmo de pérdida"
                    : preview.weeklyWeightDeltaKg > 0.05
                      ? "Ritmo de ganancia"
                      : "Mantenimiento"}
                </p>
              </article>
            </div>

            <div className="calc-pro-macro-strip">
              <div className="is-protein">
                <span>Proteína</span>
                <strong>{preview.macros.protein} g</strong>
                <small>{preview.perKg.protein.toFixed(2)} g/kg</small>
              </div>
              <div className="is-carbs">
                <span>Carbohidratos</span>
                <strong>{preview.macros.carbs} g</strong>
                <small>{preview.perKg.carbs.toFixed(2)} g/kg</small>
              </div>
              <div className="is-fat">
                <span>Grasas</span>
                <strong>{preview.macros.fat} g</strong>
                <small>{preview.perKg.fat.toFixed(2)} g/kg</small>
              </div>
              <div className="is-fiber">
                <span>Fibra</span>
                <strong>{preview.macros.fiber} g</strong>
                <small>0.30 g/kg</small>
              </div>
            </div>

            <div className="calc-pro-compare">
              <div className="calc-pro-compare-head">
                <span>Comparativa rápida entre fórmulas</span>
                <small>Clic en una fórmula para seleccionarla</small>
              </div>
              <div className="calc-pro-compare-grid">
                {preview.formulaComparisons.map((item) => {
                  const isCurrent = preview.resolvedFormula === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!item.available}
                      onClick={() => setFormula(item.id)}
                      className={`calc-pro-compare-item ${isCurrent ? "is-current" : ""}`.trim()}
                      title={item.available ? `Seleccionar ${item.label}` : "Requiere % de grasa corporal"}
                    >
                      <span>{item.label}</span>
                      <strong>{item.available ? `${item.targetKcal.toLocaleString("es-MX")} kcal` : "Req. % grasa"}</strong>
                      <small>{item.available ? `TMB ${item.tmb.toLocaleString("es-MX")}` : "Ingresa % BF"}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
