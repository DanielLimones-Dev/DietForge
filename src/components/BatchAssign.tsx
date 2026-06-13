import { useState } from "react";
import { db } from "@/lib/db";
import { Users, X, Check } from "lucide-react";
import type { Client, MealTime, DietTemplate } from "@/types";

interface Props {
  onClose: () => void;
}

export function BatchAssign({ onClose }: Props) {
  const [clients] = useState<Client[]>(() => db.getClients());
  const [templates] = useState<DietTemplate[]>(() => db.getTemplates());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<"select" | "template" | "custom">("select");
  const [selectedTemplate, setSelectedTemplate] = useState<DietTemplate | null>(null);
  const [customKcal, setCustomKcal] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [customCarbs, setCustomCarbs] = useState("");
  const [customFat, setCustomFat] = useState("");

  const toggleClient = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleAssign = () => {
    const selectedClients = clients.filter((c) => selected.has(c.id));
    if (selectedClients.length === 0) return;

    for (const client of selectedClients) {
      const latest = db.getLatestMeasurement(client.id);
      if (!latest) continue;

      let totalKcal: number;
      let totalProtein: number;
      let totalCarbs: number;
      let totalFat: number;
      let totalFiber: number;

      if (mode === "template" && selectedTemplate) {
        totalKcal = selectedTemplate.total_kcal;
        totalProtein = selectedTemplate.total_protein;
        totalCarbs = selectedTemplate.total_carbs;
        totalFat = selectedTemplate.total_fat;
        totalFiber = selectedTemplate.total_fiber;

        const plan = db.saveMealPlan({
          client_id: client.id,
          measurement_id: latest.id,
          date: new Date().toISOString(),
          name: `${selectedTemplate.name} — ${client.name}`,
          total_kcal: totalKcal,
          total_protein: totalProtein,
          total_carbs: totalCarbs,
          total_fat: totalFat,
          total_fiber: totalFiber,
          total_antioxidants: 0,
        }, []);

        for (const item of selectedTemplate.items) {
          let food = db.getFoods().find((f) => f.name === item.food.name);
          if (!food) food = db.saveFood({ ...item.food, source: "manual" });
          db.addMealPlanItem({
            meal_plan_id: plan.id,
            meal_time: item.meal_time as MealTime,
            food_id: food.id,
            quantity: item.quantity,
            serving_unit: item.serving_unit,
          });
        }
      } else if (mode === "custom") {
        const kcal = Number(customKcal) || latest.tdee;
        const protein = Number(customProtein) || latest.protein;
        const carbs = Number(customCarbs) || latest.carbs;
        const fat = Number(customFat) || latest.fat;
        db.saveMealPlan({
          client_id: client.id,
          measurement_id: latest.id,
          date: new Date().toISOString(),
          name: `Plan asignado ${new Date().toLocaleDateString("es-MX")}`,
          total_kcal: kcal,
          total_protein: protein,
          total_carbs: carbs,
          total_fat: fat,
          total_fiber: latest.fiber,
          total_antioxidants: latest.antioxidants,
        }, []);
      } else {
        continue;
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5" /> Asignación Masiva
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <div className="flex gap-2 mb-3">
            <button onClick={() => setMode("select")} className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${mode === "select" ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600"}`}>
              Seleccionar
            </button>
            <button onClick={() => { setMode("template"); }} className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${mode === "template" ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600"}`}>
              Desde Plantilla
            </button>
            <button onClick={() => { setMode("custom"); }} className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${mode === "custom" ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600"}`}>
              Macros Manuales
            </button>
          </div>
          <p className="text-xs text-gray-400">{selected.size} cliente(s) seleccionado(s)</p>
        </div>

        {mode === "select" && (
          <div className="space-y-1 max-h-52 overflow-y-auto mb-4">
            {clients.map((c) => {
              const latest = db.getLatestMeasurement(c.id);
              return (
                <label key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleClient(c.id)} className="rounded" />
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium dark:text-white">{c.name}</p>
                    {latest && <p className="text-[10px] text-gray-400">{latest.weight} kg · {latest.tdee} kcal</p>}
                  </div>
                </label>
              );
            })}
            {clients.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No hay clientes</p>}
          </div>
        )}

        {mode === "template" && (
          <div className="space-y-2 max-h-52 overflow-y-auto mb-4">
            {templates.map((t) => (
              <button key={t.id} onClick={() => setSelectedTemplate(t)}
                className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                  selectedTemplate?.id === t.id
                    ? "bg-brand-50 border-brand-500 dark:bg-brand-900/20 dark:border-brand-500"
                    : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                }`}>
                <p className="font-medium dark:text-white">{t.name}</p>
                <p className="text-xs text-gray-400">{Math.round(t.total_kcal)} kcal · P:{t.total_protein}g C:{t.total_carbs}g G:{t.total_fat}g</p>
              </button>
            ))}
            {templates.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No hay plantillas guardadas</p>}
          </div>
        )}

        {mode === "custom" && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: "Calorías", value: customKcal, set: setCustomKcal },
              { label: "Proteína (g)", value: customProtein, set: setCustomProtein },
              { label: "Carbos (g)", value: customCarbs, set: setCustomCarbs },
              { label: "Grasa (g)", value: customFat, set: setCustomFat },
            ].map((f) => (
              <div key={f.label}>
                <label className="block text-xs text-gray-400 mb-1">{f.label}</label>
                <input type="number" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100"
                  value={f.value} onChange={(e) => f.set(e.target.value)} />
              </div>
            ))}
          </div>
        )}

        <button onClick={handleAssign} disabled={selected.size === 0} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <Check className="w-4 h-4" /> Asignar a {selected.size} cliente(s)
        </button>
      </div>
    </div>
  );
}
