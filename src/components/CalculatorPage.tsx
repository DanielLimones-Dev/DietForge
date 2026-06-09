import { useState } from "react";
import { calculateMacros, distributeMeals, calculateBodyFatFromSkinfolds } from "@/lib/calculator";
import { Ruler } from "lucide-react";
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
    mealCount: "5",
    hasWorkout: true,
  });
  const [result, setResult] = useState<MacroResult | null>(null);

  const handleCalc = () => {
    const w = Number(form.weight);
    const h = Number(form.height);
    const a = Number(form.age);
    if (!w || !h || !a) return;

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

    setResult(calculateMacros(w, h, a, form.sex, form.activityLevel, form.goal, bf));
  };

  const meals = result ? distributeMeals(result, Number(form.mealCount), form.hasWorkout) : [];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 dark:text-white">Calculadora de Macros</h2>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Peso (kg) *</label>
            <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Altura (cm) *</label>
            <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Edad *</label>
            <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sexo</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value as "male" | "female" })}>
              <option value="male">Hombre</option>
              <option value="female">Mujer</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">% Grasa corporal</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, bfMethod: "direct" })}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${form.bfMethod === "direct" ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600"}`}
              >
                Directo
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, bfMethod: "skinfold" })}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${form.bfMethod === "skinfold" ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600"}`}
              >
                <Ruler className="w-3 h-3" />
                Pliegues
              </button>
            </div>
            {form.bfMethod === "direct" ? (
              <input type="number" placeholder="Ej: 15" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={form.bodyFat} onChange={(e) => setForm({ ...form, bodyFat: e.target.value })} />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <div>
                   <label className="block text-[10px] text-gray-400 dark:text-gray-500">Pectoral (mm)</label>
                  <input type="number" placeholder="mm" className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs dark:bg-gray-800 dark:text-gray-100" value={form.chest} onChange={(e) => setForm({ ...form, chest: e.target.value })} />
                </div>
                <div>
                   <label className="block text-[10px] text-gray-400 dark:text-gray-500">Abdominal (mm)</label>
                  <input type="number" placeholder="mm" className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs dark:bg-gray-800 dark:text-gray-100" value={form.abdominal} onChange={(e) => setForm({ ...form, abdominal: e.target.value })} />
                </div>
                <div>
                   <label className="block text-[10px] text-gray-400 dark:text-gray-500">Muslo (mm)</label>
                  <input type="number" placeholder="mm" className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs dark:bg-gray-800 dark:text-gray-100" value={form.thigh} onChange={(e) => setForm({ ...form, thigh: e.target.value })} />
                </div>
                {form.sex === "female" && (
                  <>
                    <div>
                       <label className="block text-[10px] text-gray-400 dark:text-gray-500">Tríceps (mm)</label>
                      <input type="number" placeholder="mm" className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs dark:bg-gray-800 dark:text-gray-100" value={form.triceps} onChange={(e) => setForm({ ...form, triceps: e.target.value })} />
                    </div>
                    <div>
                       <label className="block text-[10px] text-gray-400 dark:text-gray-500">Suprailíaco (mm)</label>
                      <input type="number" placeholder="mm" className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs dark:bg-gray-800 dark:text-gray-100" value={form.suprailiac} onChange={(e) => setForm({ ...form, suprailiac: e.target.value })} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Actividad</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={form.activityLevel} onChange={(e) => setForm({ ...form, activityLevel: e.target.value as ActivityLevel })}>
              <option value="sedentary">Sedentario</option>
              <option value="light">Ligero</option>
              <option value="moderate">Moderado</option>
              <option value="active">Activo</option>
              <option value="very_active">Muy activo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Objetivo</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value as Goal })}>
              <option value="lose_fat">Perder grasa</option>
              <option value="maintain">Mantener</option>
              <option value="build_muscle">Ganar músculo</option>
              <option value="gain_weight">Subir de peso</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Comidas</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={form.mealCount} onChange={(e) => setForm({ ...form, mealCount: e.target.value })}>
              {[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm mb-4 dark:text-gray-300">
          <input type="checkbox" checked={form.hasWorkout} onChange={(e) => setForm({ ...form, hasWorkout: e.target.checked })} className="rounded" />
          Incluye entrenamiento (pre/intra/post)
        </label>
        <button onClick={handleCalc} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-all duration-200">
          Calcular Macros
        </button>
      </div>

      {result && (
        <>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold mb-4 dark:text-white">Macros Diarios</h3>
            <div className="grid grid-cols-5 gap-4 mb-4">
              <MacroBox label="TMB" value={`${result.tmb}`} unit="kcal" />
              <MacroBox label="Calorías" value={`${result.tdee}`} unit="kcal" color="text-gray-900 dark:text-gray-100" />
              <MacroBox label="Proteína" value={`${result.protein}`} unit="g" color="text-macro-protein" />
              <MacroBox label="Carbohidratos" value={`${result.carbs}`} unit="g" color="text-macro-carbs" />
              <MacroBox label="Grasas" value={`${result.fat}`} unit="g" color="text-macro-fat" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <MacroBox label="Fibra" value={`${result.fiber}`} unit="g" color="text-macro-fiber" />
              <MacroBox label="Antioxidantes" value={`${result.antioxidants}`} unit="porción" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold mb-4 dark:text-white">Distribución por Comidas</h3>
            <div className="space-y-3">
              {meals.map((m) => (
                <div key={m.key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="font-medium text-sm dark:text-white">{m.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{m.percentage}%</p>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-300">
                    <span className="text-macro-protein">{m.protein}g P</span>
                    <span className="text-macro-carbs">{m.carbs}g C</span>
                    <span className="text-macro-fat">{m.fat}g G</span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">
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
  const bgMap: Record<string, string> = {
    "text-macro-protein": "bg-red-50 dark:bg-red-900/20",
    "text-macro-carbs": "bg-orange-50 dark:bg-orange-900/20",
    "text-macro-fat": "bg-yellow-50 dark:bg-yellow-900/20",
    "text-macro-fiber": "bg-green-50 dark:bg-green-900/20",
  };
  const bg = color && bgMap[color] ? bgMap[color] : "bg-gray-50 dark:bg-gray-800";
  return (
    <div className={`text-center p-4 ${bg} rounded-lg border border-gray-100 dark:border-gray-700`}>
      <p className={`text-xl font-bold ${color || "text-gray-700 dark:text-gray-300"}`}>{value}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">{unit}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
