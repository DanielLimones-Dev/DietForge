"use client";

import { Activity, ChevronRight, RotateCcw, Sparkles } from "lucide-react";
import type { Food } from "@/types";

export type MacroKey = "protein" | "carbs" | "fat";

const MACROS: Record<MacroKey, {
  label: string;
  shortLabel: string;
  color: string;
  text: string;
  soft: string;
  range: string;
  density: string;
  description: string;
}> = {
  protein: {
    label: "Proteínas",
    shortLabel: "Proteína",
    color: "#00855d",
    text: "text-emerald-700 dark:text-emerald-300",
    soft: "bg-emerald-50 dark:bg-emerald-950/45",
    range: "20–30%",
    density: "4 kcal por gramo",
    description: "Ayudan a construir y conservar tejido muscular, y participan en la recuperación.",
  },
  carbs: {
    label: "Carbohidratos",
    shortLabel: "Carbos",
    color: "#e89923",
    text: "text-amber-700 dark:text-amber-300",
    soft: "bg-amber-50 dark:bg-amber-950/40",
    range: "40–55%",
    density: "4 kcal por gramo",
    description: "Son una fuente directa de energía y ayudan a sostener el rendimiento y el glucógeno.",
  },
  fat: {
    label: "Grasas",
    shortLabel: "Grasas",
    color: "#e15562",
    text: "text-rose-700 dark:text-rose-300",
    soft: "bg-rose-50 dark:bg-rose-950/40",
    range: "20–35%",
    density: "9 kcal por gramo",
    description: "Contribuyen a funciones hormonales y a la absorción de vitaminas liposolubles.",
  },
};

const KEYS = Object.keys(MACROS) as MacroKey[];
const kcalFactor: Record<MacroKey, number> = { protein: 4, carbs: 4, fat: 9 };

function macroValue(food: Food, macro: MacroKey) {
  return Number(food[macro]) || 0;
}

export function dominantMacro(food: Food): MacroKey {
  return KEYS.reduce((best, key) =>
    macroValue(food, key) * kcalFactor[key] > macroValue(food, best) * kcalFactor[best] ? key : best,
  "protein" as MacroKey);
}

export function NutritionWheel({
  foods,
  active,
  onChange,
  onClear,
}: {
  foods: Food[];
  active: MacroKey;
  onChange: (macro: MacroKey) => void;
  onClear: () => void;
}) {
  const energy = KEYS.map((key) => foods.reduce((sum, food) => sum + macroValue(food, key) * kcalFactor[key], 0));
  const totalEnergy = energy.reduce((sum, value) => sum + value, 0);
  const fallback = [30, 45, 25];
  const percentages = energy.map((value, index) => totalEnergy > 0 ? (value / totalEnergy) * 100 : fallback[index]);
  const totalGrams = foods.reduce((sum, food) => sum + macroValue(food, active), 0);
  const topSources = [...foods]
    .filter((food) => macroValue(food, active) > 0)
    .sort((a, b) => macroValue(b, active) - macroValue(a, active))
    .slice(0, 3);
  const activeIndex = KEYS.indexOf(active);
  const activeData = MACROS[active];
  const radius = 126;
  const circumference = 2 * Math.PI * radius;
  const gap = 9;
  const segments = KEYS.map((key, index) => ({
    key,
    length: (percentages[index] / 100) * circumference,
    offset: percentages.slice(0, index).reduce((sum, percentage) => sum + (percentage / 100) * circumference, 0),
  }));

  return (
    <section className="nutrition-wheel-card" aria-labelledby="nutrition-wheel-title">
      <div className="nutrition-wheel-heading">
        <div>
          <p className="df-eyebrow">MATRIZ NUTRICIONAL</p>
          <h2 id="nutrition-wheel-title">Distribución del catálogo</h2>
        </div>
        <span className="nutrition-live-pill"><Activity size={13} /> Datos reales</span>
      </div>

      <div className="nutrition-wheel-stage">
        <div className="nutrition-wheel-wrap">
          <svg viewBox="0 0 320 320" className="nutrition-wheel" aria-label="Selecciona un macronutriente">
            <circle cx="160" cy="160" r={radius} fill="none" stroke="currentColor" strokeWidth="30" className="nutrition-wheel-track" />
            {segments.map(({ key, length, offset: currentOffset }) => {
              return (
                <circle
                  key={key}
                  cx="160"
                  cy="160"
                  r={radius}
                  fill="none"
                  stroke={MACROS[key].color}
                  strokeWidth={active === key ? 38 : 30}
                  strokeLinecap="round"
                  strokeDasharray={`${Math.max(0, length - gap)} ${circumference - Math.max(0, length - gap)}`}
                  strokeDashoffset={-currentOffset}
                  pathLength={circumference}
                  className="nutrition-wheel-segment"
                  data-active={active === key}
                  role="button"
                  tabIndex={0}
                  aria-label={`${MACROS[key].label}: ${Math.round(percentages[KEYS.indexOf(key)])}% del catálogo`}
                  onClick={() => onChange(key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onChange(key);
                    }
                  }}
                />
              );
            })}
          </svg>
          <div className="nutrition-wheel-center" aria-live="polite">
            <span style={{ color: activeData.color }}>{Math.round(percentages[activeIndex])}%</span>
            <strong>{activeData.shortLabel}</strong>
            <small>{foods.length ? `${Math.round(totalGrams)} g registrados` : "Sin alimentos aún"}</small>
          </div>
        </div>

        <div className="nutrition-wheel-legend" role="list" aria-label="Macronutrientes">
          {KEYS.map((key, index) => (
            <button key={key} type="button" data-active={active === key} onClick={() => onChange(key)}>
              <span className="nutrition-legend-dot" style={{ background: MACROS[key].color }} />
              <span><strong>{MACROS[key].label}</strong><small>{Math.round(percentages[index])}% de energía</small></span>
              <ChevronRight size={15} />
            </button>
          ))}
          <button type="button" className="nutrition-clear-filter" onClick={onClear}>
            <RotateCcw size={14} /> Ver todos los alimentos
          </button>
        </div>
      </div>

      <div className={`nutrition-insight ${activeData.soft}`} key={active}>
        <div className="nutrition-insight-icon" style={{ color: activeData.color }}><Sparkles size={18} /></div>
        <div className="nutrition-insight-copy">
          <p className={activeData.text}>{activeData.label}</p>
          <span>{activeData.description}</span>
        </div>
        <dl>
          <div><dt>Rango general</dt><dd>{activeData.range}</dd></div>
          <div><dt>Densidad</dt><dd>{activeData.density}</dd></div>
        </dl>
      </div>

      <div className="nutrition-top-sources">
        <span>Fuentes más concentradas en tu base</span>
        <div>
          {topSources.length ? topSources.map((food) => (
            <button type="button" key={food.id} onClick={() => onChange(active)}>
              {food.name}<strong style={{ color: activeData.color }}>{macroValue(food, active)} g</strong>
            </button>
          )) : <small>Agrega alimentos para generar recomendaciones desde tu catálogo.</small>}
        </div>
      </div>
    </section>
  );
}
