import { useState, useCallback, useMemo } from "react";
import { calculateMacros, distributeMeals, calculateBodyFatFromSkinfolds, adjustMacroField, macroKcal } from "@/lib/calculator";
import { Ruler, RotateCcw, Lock, Unlock, AlertTriangle } from "lucide-react";
import type { ActivityLevel, Goal, MacroResult } from "@/types";

export function CalculatorPage() {
  const [form, setForm] = useState({
    weight: "",
    height: "",
    age: "",
    sex: "male" as "male" | "female",
    bodyFat: "",
    bfMethod: "direct" as "direct" | "skinfold",
    chest: "",
    abdominal: "",
    thigh: "",
    triceps: "",
    suprailiac: "",
    activityLevel: "moderate" as ActivityLevel,
    goal: "maintain" as Goal,
    mealCount: "3",
    hasWorkout: true,
  });
  const [result, setResult] = useState<MacroResult | null>(null);
  const [adjusted, setAdjusted] = useState<{ protein: number; carbs: number; fat: number } | null>(null);
  const [lastField, setLastField] = useState<"protein" | "carbs" | "fat" | null>(null);
  const [calcError, setCalcError] = useState("");

  const handleCalc = () => {
    const w = Number(form.weight);
    const h = Number(form.height);
    const a = Number(form.age);
    if (!w || !h || !a) {
      setCalcError("Completa peso, altura y edad para calcular");
      return;
    }
    setCalcError("");

    let bf = form.bodyFat ? Number(form.bodyFat) : undefined;
    if (form.bfMethod === "skinfold") {
      const sf = {
        chest: form.chest ? Number(form.chest) : undefined,
        abdominal: form.abdominal ? Number(form.abdominal) : undefined,
        thigh: form.thigh ? Number(form.thigh) : undefined,
        triceps: form.triceps ? Number(form.triceps) : undefined,
        suprailiac: form.suprailiac ? Number(form.suprailiac) : undefined,
      };
      const calculated = calculateBodyFatFromSkinfolds(sf, form.sex, a);
      if (calculated !== null) bf = calculated;
    }

    const r = calculateMacros(w, h, a, form.sex, form.activityLevel, form.goal, bf);
    setResult(r);
    setAdjusted({ protein: r.protein, carbs: r.carbs, fat: r.fat });
    setLastField(null);
  };

  const handleMacroChange = useCallback((field: "protein" | "carbs" | "fat", value: number) => {
    if (!result || !adjusted) return;
    setAdjusted(adjustMacroField(adjusted, field, value, result.tdee));
    setLastField(field);
  }, [result, adjusted]);

  const handleReset = () => {
    if (!result) return;
    setAdjusted({ protein: result.protein, carbs: result.carbs, fat: result.fat });
    setLastField(null);
  };

  const display = adjusted || (result ? { protein: result.protein, carbs: result.carbs, fat: result.fat } : null);

  const fillers = useMemo(() => {
    if (!result || !display) return null;
    const tdee = result.tdee;
    const maxProtein = Math.round((tdee - display.fat * 9) / 4);
    const maxFat = Math.round((tdee - display.protein * 4) / 9);
    const maxCarbs = Math.round((tdee - display.protein * 4) / 4);
    return { maxProtein, maxFat, maxCarbs, tdee };
  }, [result, display]);

  const atLimit = fillers && display && (
    (lastField === "protein" && display.carbs === 0) ||
    (lastField === "fat" && display.carbs === 0) ||
    (lastField === "carbs" && display.fat === 0)
  );

  const meals = display && result ? distributeMeals(
    { ...result, protein: display.protein, carbs: display.carbs, fat: display.fat },
    3,
    form.hasWorkout,
  ) : [];

  const totalKcal = display ? macroKcal(display) : 0;

  return (
    <div>
      <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-2">Calculadora de Macros</h2>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Los campos con <span className="text-red-400">*</span> son obligatorios</p>

      <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Peso <span className="text-red-400">*</span></label>
            <div className="relative">
              <input type="number" className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 dark:focus:border-brand-400 transition-all" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-400 dark:text-gray-600 pointer-events-none">kg</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Altura <span className="text-red-400">*</span></label>
            <div className="relative">
              <input type="number" className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 dark:focus:border-brand-400 transition-all" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-400 dark:text-gray-600 pointer-events-none">cm</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Edad <span className="text-red-400">*</span></label>
            <div className="relative">
              <input type="number" className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 dark:focus:border-brand-400 transition-all" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-400 dark:text-gray-600 pointer-events-none">años</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Sexo</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm({ ...form, sex: "male" })}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-all active:scale-[0.97] ${form.sex === "male" ? "bg-brand-600 text-white border-brand-600 shadow-sm" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400"}`}>Hombre</button>
              <button type="button" onClick={() => setForm({ ...form, sex: "female" })}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-all active:scale-[0.97] ${form.sex === "female" ? "bg-brand-600 text-white border-brand-600 shadow-sm" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400"}`}>Mujer</button>
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">% Grasa corporal</label>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => setForm({ ...form, bfMethod: "direct" })}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all active:scale-[0.97] ${form.bfMethod === "direct" ? "bg-brand-600 text-white border-brand-600 shadow-sm" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400"}`}>
                Directo
              </button>
              <button type="button" onClick={() => setForm({ ...form, bfMethod: "skinfold" })}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all active:scale-[0.97] ${form.bfMethod === "skinfold" ? "bg-brand-600 text-white border-brand-600 shadow-sm" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400"}`}>
                <Ruler className="w-3 h-3" /> Pliegues
              </button>
            </div>
            {form.bfMethod === "direct" ? (
              <div className="relative max-w-[200px]">
                <input type="number" placeholder="Ej: 15" className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 dark:focus:border-brand-400 transition-all" value={form.bodyFat} onChange={(e) => setForm({ ...form, bodyFat: e.target.value })} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-400 dark:text-gray-600 pointer-events-none">%</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Pectoral</label>
                  <input type="number" placeholder="mm" className="w-full px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 dark:focus:border-brand-400 transition-all" value={form.chest} onChange={(e) => setForm({ ...form, chest: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Abdominal</label>
                  <input type="number" placeholder="mm" className="w-full px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 dark:focus:border-brand-400 transition-all" value={form.abdominal} onChange={(e) => setForm({ ...form, abdominal: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Muslo</label>
                  <input type="number" placeholder="mm" className="w-full px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 dark:focus:border-brand-400 transition-all" value={form.thigh} onChange={(e) => setForm({ ...form, thigh: e.target.value })} />
                </div>
                {form.sex === "female" && (
                  <>
                    <div>
                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Tríceps</label>
                      <input type="number" placeholder="mm" className="w-full px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 dark:focus:border-brand-400 transition-all" value={form.triceps} onChange={(e) => setForm({ ...form, triceps: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Suprailíaco</label>
                      <input type="number" placeholder="mm" className="w-full px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 dark:focus:border-brand-400 transition-all" value={form.suprailiac} onChange={(e) => setForm({ ...form, suprailiac: e.target.value })} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Actividad</label>
            <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 dark:focus:border-brand-400 transition-all" value={form.activityLevel} onChange={(e) => setForm({ ...form, activityLevel: e.target.value as ActivityLevel })}>
              <option value="sedentary">Sedentario</option>
              <option value="light">Ligero</option>
              <option value="moderate">Moderado</option>
              <option value="active">Activo</option>
              <option value="very_active">Muy activo</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Objetivo</label>
            <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 dark:focus:border-brand-400 transition-all" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value as Goal })}>
              <option value="lose_fat">Perder grasa — Déficit</option>
              <option value="maintain">Mantener peso</option>
              <option value="build_muscle">Ganar músculo — Volumen</option>
              <option value="gain_weight">Subir de peso — Aumento</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm mb-4 text-gray-600 dark:text-gray-300 cursor-pointer select-none">
          <input type="checkbox" checked={form.hasWorkout} onChange={(e) => setForm({ ...form, hasWorkout: e.target.checked })} className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500/30" />
          Incluye entrenamiento (pre/intra/post)
        </label>
        {calcError && (
          <div className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
            {calcError}
          </div>
        )}
        <button onClick={handleCalc} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700 active:scale-[0.97] transition-all shadow-sm">
          Calcular Macros
        </button>
      </div>

      {result && display && (
        <>
          <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-6 relative overflow-hidden animate-slide-down">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-500 to-brand-600" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold dark:text-white">Macros Diarios</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Target: <strong className="text-gray-700 dark:text-gray-300">{result.tdee} kcal</strong>
                </span>
                {lastField && (
                  <button onClick={handleReset} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-[0.97] animate-scale-in">
                    <RotateCcw className="w-3 h-3" />
                    Restaurar
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="stagger-1"><MacroBox label="TMB" value={`${result.tmb}`} unit="kcal" /></div>
              <div className="stagger-2"><MacroBox label="Calorías" value={`${result.tdee}`} unit="kcal" color="text-gray-900 dark:text-gray-100" /></div>
              <div className="stagger-3"><MacroBox label="Fibra" value={`${result.fiber}`} unit="g" color="text-macro-fiber" /></div>
              <div className="stagger-4"><MacroBox label="Antioxidantes" value={`${result.antioxidants}`} unit="porción" /></div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="stagger-1"><MacroInput
                label="Proteína"
                value={display.protein}
                unit="g"
                color="text-macro-protein"
                accent="#f87171"
                changed={lastField === "protein"}
                maxVal={fillers?.maxProtein}
                fillerLabel="Carbs"
                fillerVal={display.carbs}
                atLimit={!!(lastField === "protein" && display.carbs === 0)}
                onChange={(v) => handleMacroChange("protein", v)}
              /></div>
              <div className="stagger-2"><MacroInput
                label="Carbohidratos"
                value={display.carbs}
                unit="g"
                color="text-macro-carbs"
                accent="#fbbf24"
                changed={lastField === "carbs"}
                maxVal={fillers?.maxCarbs}
                fillerLabel="Grasas"
                fillerVal={display.fat}
                atLimit={!!(lastField === "carbs" && display.fat === 0)}
                onChange={(v) => handleMacroChange("carbs", v)}
              /></div>
              <div className="stagger-3"><MacroInput
                label="Grasas"
                value={display.fat}
                unit="g"
                color="text-macro-fat"
                accent="#60a5fa"
                changed={lastField === "fat"}
                maxVal={fillers?.maxFat}
                fillerLabel="Carbs"
                fillerVal={display.carbs}
                atLimit={!!(lastField === "fat" && display.carbs === 0)}
                onChange={(v) => handleMacroChange("fat", v)}
              /></div>
            </div>

            {lastField && (
              <div className="mt-4 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden animate-slide-up">
                <div className="grid grid-cols-4 gap-px bg-gray-100 dark:bg-gray-700 text-[11px]">
                  <div className="bg-white dark:bg-gray-800 px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Macro</div>
                  <div className="bg-white dark:bg-gray-800 px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Original</div>
                  <div className="bg-white dark:bg-gray-800 px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Ajustado</div>
                  <div className="bg-white dark:bg-gray-800 px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Diferencia</div>

                  <MacroDiffRow label="Proteína" orig={result.protein} adj={display.protein} mult={4} color="text-macro-protein" />
                  <MacroDiffRow label="Carbohidratos" orig={result.carbs} adj={display.carbs} mult={4} color="text-macro-carbs" />
                  <MacroDiffRow label="Grasas" orig={result.fat} adj={display.fat} mult={9} color="text-macro-fat" />

                  <div className="bg-white dark:bg-gray-800 px-3 py-2 font-semibold text-gray-900 dark:text-gray-100">Total kcal</div>
                  <div className="bg-white dark:bg-gray-800 px-3 py-2 font-semibold text-right text-gray-900 dark:text-gray-100">{result.tdee}</div>
                  <div className="bg-white dark:bg-gray-800 px-3 py-2 font-semibold text-right text-gray-900 dark:text-gray-100">{totalKcal}</div>
                  <div className="bg-white dark:bg-gray-800 px-3 py-2 font-semibold text-right">
                    <span className={totalKcal === result.tdee ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}>
                      {totalKcal - result.tdee > 0 ? "+" : ""}{totalKcal - result.tdee}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="text-gray-500 dark:text-gray-400">
                P: {display.protein}g <span className="text-gray-400">× 4</span> = <strong className={display.protein ? "text-macro-protein" : ""}>{display.protein * 4}</strong> kcal
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                C: {display.carbs}g <span className="text-gray-400">× 4</span> = <strong className={display.carbs ? "text-macro-carbs" : ""}>{display.carbs * 4}</strong> kcal
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                G: {display.fat}g <span className="text-gray-400">× 9</span> = <strong className={display.fat ? "text-macro-fat" : ""}>{display.fat * 9}</strong> kcal
              </span>
              <span className={`font-semibold ${totalKcal === result.tdee ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                Total: {totalKcal} kcal
                {totalKcal === result.tdee && <Lock className="w-3 h-3 inline ml-1" />}
              </span>
              {atLimit && (
                <span className="flex items-center gap-1 text-[10px] text-red-500 dark:text-red-400 font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  Límite alcanzado — el filler está en 0
                </span>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 relative overflow-hidden animate-slide-down">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-green-500 to-emerald-500" />
            <h3 className="font-semibold mb-4 dark:text-white">Distribución por Comidas</h3>
            <div className="space-y-3">
              {meals.map((m, i) => (
                <div key={m.key} className={`flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm stagger-${Math.min(i + 1, 5)}`}>
                  <div>
                    <p className="font-medium text-sm dark:text-white">{m.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{m.percentage}%</p>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-300">
                    <span className="text-macro-protein font-medium">{m.protein}g P</span>
                    <span className="text-macro-carbs font-medium">{m.carbs}g C</span>
                    <span className="text-macro-fat font-medium">{m.fat}g G</span>
                    <span className="text-gray-900 dark:text-gray-100 font-semibold">
                      ~{Math.round(m.protein * 4 + m.carbs * 4 + m.fat * 9)} kcal
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MacroBox({ label, value, unit, color }: { label: string; value: string; unit: string; color?: string }) {
  const accentMap: Record<string, string> = {
    "text-macro-protein": "#f87171",
    "text-macro-carbs": "#fbbf24",
    "text-macro-fat": "#60a5fa",
    "text-macro-fiber": "#a78bfa",
  };
  const accent = color && accentMap[color] ? accentMap[color] : undefined;
  return (
    <div className="text-center p-3.5 rounded-xl border shadow-sm" style={accent ? { borderColor: accent + "44", background: `linear-gradient(to bottom, ${accent}08, transparent)` } : {}}>
      <p className={`text-xl font-bold ${color || "text-gray-700 dark:text-gray-300"}`}>{value}</p>
      <p className="text-[10px] text-gray-400 dark:text-gray-500">{unit}</p>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function MacroDiffRow({ label, orig, adj, mult, color }: { label: string; orig: number; adj: number; mult: number; color: string }) {
  const diff = adj - orig;
  const diffKcal = diff * mult;
  return (
    <>
      <div className="bg-white dark:bg-gray-800 px-3 py-2 text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${color} `} style={{ backgroundColor: color.replace("text-", "") }} />
        {label}
      </div>
      <div className="bg-white dark:bg-gray-800 px-3 py-2 text-right text-gray-700 dark:text-gray-300">{orig}g ({orig * mult} kcal)</div>
      <div className="bg-white dark:bg-gray-800 px-3 py-2 text-right text-gray-700 dark:text-gray-300">{adj}g ({adj * mult} kcal)</div>
      <div className={`bg-white dark:bg-gray-800 px-3 py-2 text-right font-medium ${diff === 0 ? "text-gray-400" : diff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
        {diff > 0 ? "+" : ""}{diff}g ({diffKcal > 0 ? "+" : ""}{diffKcal} kcal)
      </div>
    </>
  );
}

function MacroInput({ label, value, unit, color, accent, changed, onChange, maxVal, fillerLabel, fillerVal, atLimit }: {
  label: string; value: number; unit: string; color: string; accent: string; changed: boolean;
  onChange: (v: number) => void;
  maxVal?: number; fillerLabel?: string; fillerVal?: number; atLimit?: boolean;
}) {
  return (
    <div className={`p-3.5 rounded-xl border shadow-sm transition-all duration-300 ${changed ? "ring-2 ring-offset-1" : ""}`}
      style={{
        borderColor: atLimit ? "#ef444488" : (changed ? accent + "88" : accent + "44"),
        background: `linear-gradient(to bottom, ${atLimit ? "#ef444408" : accent + "08"}, transparent)`,
      }}>
      <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className={`w-full pr-8 py-1.5 border-0 border-b-2 bg-transparent text-lg font-bold outline-none transition-all ${color}`}
          style={{ borderBottomColor: atLimit ? "#ef4444" : accent + "66" }}
        />
        <span className="absolute right-1 bottom-1.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 pointer-events-none">{unit}</span>
      </div>
      {maxVal !== undefined && changed && (
        <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-1">
          {atLimit
            ? <span className="text-red-500 dark:text-red-400 font-medium">Max: {maxVal}g — el filler llegó a 0</span>
            : <>Max: {maxVal}g · {fillerLabel}: {fillerVal}g</>
          }
        </p>
      )}
    </div>
  );
}
