import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Printer, Plus, Scale, X, Target, Pencil, Globe } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { db } from "@/lib/db";
import { generateDietPDF } from "@/lib/pdf";
import { searchFatSecret, classifyCarbs } from "@/lib/nutrition";
import { adjustMacroField } from "@/lib/calculator";
import type { Food, MealPlanItem, MealTime } from "@/types";
import { ConfirmDialog, PromptDialog } from "./ui";

const MEAL_LABELS: Record<string, string> = {
  pre_workout: "Pre-Entreno",
  intra_workout: "Intra-Entreno",
  post_workout: "Post-Entreno",
  meal1: "Comida 1",
  meal2: "Comida 2",
  meal3: "Comida 3",
  meal4: "Comida 4",
  meal5: "Comida 5",
  meal6: "Comida 6",
};

const CARB_SUGGESTIONS: Record<string, { label: string; type: "fast" | "slow" | "mixed"; desc: string; color: string }> = {
  pre_workout: { label: "Pre-Entreno", type: "fast", desc: "Carbos rápidos (fruta, pan, miel)", color: "text-orange-600 bg-orange-50 border-orange-200" },
  intra_workout: { label: "Intra-Entreno", type: "fast", desc: "Carbos rápidos (jugo, deportivo)", color: "text-orange-600 bg-orange-50 border-orange-200" },
  post_workout: { label: "Post-Entreno", type: "mixed", desc: "Carbos mixtos (arroz, papa, plátano)", color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  meal1: { label: "Comida 1", type: "slow", desc: "Carbos lentos (avena, integrales)", color: "text-green-600 bg-green-50 border-green-200" },
  meal2: { label: "Comida 2", type: "slow", desc: "Carbos lentos (legumbres, verduras)", color: "text-green-600 bg-green-50 border-green-200" },
  meal3: { label: "Comida 3", type: "slow", desc: "Carbos lentos (integrales)", color: "text-green-600 bg-green-50 border-green-200" },
  meal4: { label: "Comida 4", type: "slow", desc: "Carbos lentos", color: "text-green-600 bg-green-50 border-green-200" },
  meal5: { label: "Comida 5", type: "slow", desc: "Carbos lentos", color: "text-green-600 bg-green-50 border-green-200" },
  meal6: { label: "Comida 6", type: "slow", desc: "Carbos lentos", color: "text-green-600 bg-green-50 border-green-200" },
};

const CARB_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  fast: { label: "Rápido", color: "text-orange-600 bg-orange-100" },
  slow: { label: "Lento", color: "text-green-600 bg-green-100" },
  mixed: { label: "Mixto", color: "text-yellow-600 bg-yellow-100" },
};

export function MealPlanner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const planId = Number(id);

  const [plan, setPlan] = useState(() => db.getMealPlan(planId));
  const [client, setClient] = useState(() => db.getClient(plan?.plan.client_id || 0));
  const [foods, setFoods] = useState<Food[]>(() => db.getFoods());
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editItemQty, setEditItemQty] = useState(0);
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [foodQuantity, setFoodQuantity] = useState(100);
  const [foodUnit, setFoodUnit] = useState("g");
  const [editingTargets, setEditingTargets] = useState(false);
  const [editTargets, setEditTargets] = useState({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  const [apiResults, setApiResults] = useState<Food[]>([]);
  const [removeItemId, setRemoveItemId] = useState<number | null>(null);
  const [showTemplatePrompt, setShowTemplatePrompt] = useState(false);
  const [mealCount, setMealCount] = useState(3);
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [origTargets, setOrigTargets] = useState({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [, setTick] = useState(0);

  useEffect(() => {
    let p = db.getMealPlan(planId);
    if (!p) { navigate("/clients"); return; }
    if (!p.plan.total_kcal && !p.plan.total_protein) {
      const m = db.getLatestMeasurement(p.plan.client_id);
      if (m && (m.tdee > 0 || m.protein > 0)) {
        db.updateMealPlan(planId, {
          total_kcal: m.tdee, total_protein: m.protein, total_carbs: m.carbs,
          total_fat: m.fat, total_fiber: m.fiber,
        });
        p = db.getMealPlan(planId)!;
      }
    }
    setPlan(p);
    setClient(db.getClient(p.plan.client_id));
    setFoods(db.getFoods());
    setOrigTargets({
      kcal: p.plan.total_kcal,
      protein: p.plan.total_protein,
      carbs: p.plan.total_carbs,
      fat: p.plan.total_fat,
      fiber: p.plan.total_fiber,
    });
    setEditTargets({
      kcal: p.plan.total_kcal,
      protein: p.plan.total_protein,
      carbs: p.plan.total_carbs,
      fat: p.plan.total_fat,
      fiber: p.plan.total_fiber,
    });
  }, [planId, navigate]);

  useEffect(() => {
    const onFocus = () => setTick((t) => t + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      if (!search.trim()) { setApiResults([]); return; }
      const results = await searchFatSecret(search);
      setApiResults(results.map(r => ({ ...r, carb_type: classifyCarbs(r) })));
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const allItemsTotals = useMemo(() => {
    if (!plan) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    return plan.items.reduce(
      (acc, i) => {
        const f = db.getFood(i.food_id);
        if (!f) return acc;
        const ratio = i.quantity / f.serving_size;
        return {
          kcal: acc.kcal + f.kcal * ratio,
          protein: acc.protein + f.protein * ratio,
          carbs: acc.carbs + f.carbs * ratio,
          fat: acc.fat + f.fat * ratio,
        };
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    );
  }, [plan]);

  if (!plan || !client) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-bold dark:text-white">Plan no encontrado</h2>
        <p className="text-gray-400 mt-2">El plan de comidas no existe o fue eliminado.</p>
        <button onClick={() => navigate(-1)} className="inline-block mt-4 px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-medium">Volver</button>
      </div>
    </div>
  );

  const meas = db.getLatestMeasurement(plan.plan.client_id);
  const hasMeas = meas && meas.tdee > 0;
  const target = hasMeas
    ? { total_kcal: meas!.tdee, total_protein: meas!.protein, total_carbs: meas!.carbs, total_fat: meas!.fat, total_fiber: meas!.fiber }
    : plan.plan;
  const isLive = hasMeas;
  const noTargets = !hasMeas && !(plan.plan.total_kcal > 0);
  const filled = allItemsTotals;

  const handleOpenFoodCard = (food: Food) => {
    if (!food.id) {
      const saved = db.saveFood({
        name: food.name,
        category: food.category,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        fiber: food.fiber,
        antioxidants: food.antioxidants,
        kcal: food.kcal,
        serving_size: food.serving_size,
        serving_unit: food.serving_unit,
        source: "api",
      });
      setFoods(db.getFoods());
      setSelectedFood(saved);
      setFoodQuantity(saved.serving_size);
      setFoodUnit(saved.serving_unit);
      setApiResults([]);
      setSearch("");
      return;
    }
    setSelectedFood(food);
    setFoodQuantity(food.serving_size);
    setFoodUnit(food.serving_unit);
  };

  const handleAddFood = () => {
    if (!selectedFood || !selectedMeal) return;
    db.addMealPlanItem({
      meal_plan_id: planId,
      meal_time: selectedMeal as MealTime,
      food_id: selectedFood.id,
      quantity: foodQuantity,
      serving_unit: foodUnit,
    });
    setSelectedFood(null);
    setPlan(db.getMealPlan(planId));
  };

  const handleRemoveItem = (itemId: number) => {
    db.deleteMealPlanItem(itemId);
    setPlan(db.getMealPlan(planId));
    setRemoveItemId(null);
  };

  const handleSaveTargets = () => {
    db.updateMealPlan(planId, {
      total_kcal: Number(editTargets.kcal),
      total_protein: Number(editTargets.protein),
      total_carbs: Number(editTargets.carbs),
      total_fat: Number(editTargets.fat),
      total_fiber: Number(editTargets.fiber),
    });
    setPlan(db.getMealPlan(planId));
    setEditingTargets(false);
  };

  const handleUpdateItemQty = (itemId: number) => {
    if (editItemQty > 0) {
      db.updateMealPlanItem(itemId, { quantity: editItemQty });
      setPlan(db.getMealPlan(planId));
    }
    setEditingItemId(null);
  };

  const handleExportPDF = () => {
    const meas = db.getLatestMeasurement(plan.plan.client_id);
    if (!meas) return;
    const items = plan.items.map((i) => {
      const food = db.getFood(i.food_id);
      return { ...i, food: food || emptyFood };
    });
    const html = generateDietPDF({ client, measurement: meas, plan: plan.plan, items });
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 300); }
  };

  const handleSaveTemplate = (name: string) => {
    if (!name) return;
    const items = plan.items.map((i) => {
      const food = db.getFood(i.food_id);
      return {
        meal_time: i.meal_time,
        food: { name: food?.name || "", category: food?.category || "other", protein: food?.protein || 0, carbs: food?.carbs || 0, fat: food?.fat || 0, fiber: food?.fiber || 0, antioxidants: food?.antioxidants || 0, kcal: food?.kcal || 0, serving_size: food?.serving_size || 100, serving_unit: food?.serving_unit || "g" },
        quantity: i.quantity,
        serving_unit: i.serving_unit,
      };
    });
    db.saveTemplate({ name, total_kcal: plan.plan.total_kcal, total_protein: plan.plan.total_protein, total_carbs: plan.plan.total_carbs, total_fat: plan.plan.total_fat, total_fiber: plan.plan.total_fiber, items });
    alert("Plantilla guardada");
  };

  const groupedItems: Record<string, MealPlanItem[]> = {};
  for (const item of plan.items) {
    if (!groupedItems[item.meal_time]) groupedItems[item.meal_time] = [];
    groupedItems[item.meal_time].push(item);
  }

  const filteredFoods = foods.filter(
    (f) => (!search || f.name.toLowerCase().includes(search.toLowerCase())) && (!categoryFilter || f.category === categoryFilter),
  );
  const apiFoods = search.trim() && apiResults.length > 0
    ? apiResults.filter(r => !foods.some(f => f.name.toLowerCase() === r.name.toLowerCase()) && (!categoryFilter || r.category === categoryFilter))
    : [];

  const pieData = [
    { name: "Proteína", value: Math.round(filled.protein), color: "#ef4444" },
    { name: "Carbohidratos", value: Math.round(filled.carbs), color: "#f97316" },
    { name: "Grasas", value: Math.round(filled.fat), color: "#eab308" },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(`/clients/${client.id}`)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 dark:text-gray-100" />
        </button>
        {editingName ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={() => { db.updateMealPlan(planId, { name: editName }); setPlan(db.getMealPlan(planId)); setEditingName(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
            className="text-2xl font-bold bg-transparent border-b-2 border-brand-500 outline-none dark:text-white w-64"
          />
        ) : (
          <h2
            className="text-2xl font-bold dark:text-white cursor-pointer hover:text-brand-600 transition-colors"
            onClick={() => { setEditName(plan.plan.name); setEditingName(true); }}
          >
            {plan.plan.name}
          </h2>
        )}
        <p className="text-sm text-gray-500 dark:text-gray-400">— {client.name}</p>
        <button onClick={handleExportPDF} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-all duration-200">
          <Printer className="w-4 h-4" />
          PDF
        </button>
        <button onClick={() => setShowTemplatePrompt(true)} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-all duration-200">
          <Plus className="w-4 h-4" />
          Plantilla
        </button>
      </div>

      {/* Progress bars */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-brand-600" />
          <h3 className="font-semibold text-sm dark:text-white">Progreso contra meta</h3>
          {isLive && <span className="text-[10px] text-emerald-500 font-medium">Tiempo real</span>}
          <button
            onClick={() => {
              setEditingTargets(!editingTargets);
              if (!editingTargets) {
                const planNow = db.getMealPlan(planId);
                if (planNow) {
                  setOrigTargets({ kcal: planNow.plan.total_kcal, protein: planNow.plan.total_protein, carbs: planNow.plan.total_carbs, fat: planNow.plan.total_fat, fiber: planNow.plan.total_fiber });
                }
                setEditTargets({ kcal: target.total_kcal, protein: target.total_protein, carbs: target.total_carbs, fat: target.total_fat, fiber: target.total_fiber });
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-all shadow-sm animate-scale-in"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Editar macros
          </button>
        </div>

        {editingTargets ? (
          <div className="animate-scale-in">
            <div className="grid grid-cols-3 gap-3 mb-3">
              {(["protein","carbs","fat"] as const).map((k) => {
                const labels = { protein: "Proteína (g)", carbs: "Carbos (g)", fat: "Grasas (g)" };
                const colors = { protein: "text-red-500", carbs: "text-amber-500", fat: "text-blue-500" };
                const mult = k === "fat" ? 9 : 4;
                return (
                  <div key={k}>
                    <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-1 ${colors[k]}`}>{labels[k]}</label>
                    <input type="number"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                      value={editTargets[k]}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const adj = adjustMacroField({ protein: editTargets.protein, carbs: editTargets.carbs, fat: editTargets.fat }, k, val, editTargets.kcal);
                        setEditTargets({ ...editTargets, protein: adj.protein, carbs: adj.carbs, fat: adj.fat });
                      }} />
                    <p className="text-[9px] text-gray-400 mt-0.5">{editTargets[k] * mult} kcal</p>
                  </div>
                );
              })}
            </div>
            {(["protein","carbs","fat"] as const).some((k) => editTargets[k] !== origTargets[k]) && (
              <div className="mb-3 text-[11px] animate-slide-up">
                <table className="w-full">
                  <thead>
                    <tr className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-2 py-1">Macro</th>
                      <th className="text-right px-2 py-1">Original</th>
                      <th className="text-right px-2 py-1">Ajustado</th>
                      <th className="text-right px-2 py-1">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["protein","carbs","fat"] as const).map((k) => {
                      const orig = origTargets[k];
                      const adj = editTargets[k];
                      const diff = adj - orig;
                      const mult = k === "fat" ? 9 : 4;
                      const accent = k === "protein" ? "text-red-500" : k === "carbs" ? "text-amber-500" : "text-blue-500";
                      return (
                        <tr key={k}>
                          <td className={`px-2 py-1 font-medium ${accent}`}>{k === "protein" ? "Proteína" : k === "carbs" ? "Carbohidratos" : "Grasas"}</td>
                          <td className="text-right px-2 py-1 text-gray-600 dark:text-gray-400">{orig}g ({orig * mult} kcal)</td>
                          <td className="text-right px-2 py-1 text-gray-600 dark:text-gray-400">{adj}g ({adj * mult} kcal)</td>
                          <td className={`text-right px-2 py-1 font-medium ${diff === 0 ? "text-gray-400" : diff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                            {diff > 0 ? "+" : ""}{diff}g ({diff * mult > 0 ? "+" : ""}{diff * mult} kcal)
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-2 py-1 font-medium text-gray-800 dark:text-gray-200">Total kcal</td>
                      <td className="text-right px-2 py-1 font-semibold text-gray-800 dark:text-gray-200">{origTargets.kcal}</td>
                      <td className="text-right px-2 py-1 font-semibold text-gray-800 dark:text-gray-200">{editTargets.kcal}</td>
                      <td className="text-right px-2 py-1 font-medium text-emerald-600 dark:text-emerald-400">0</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <button onClick={handleSaveTargets}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold bg-brand-600 text-white hover:bg-brand-700 active:scale-[0.98] transition-all shadow-sm">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Guardar macros
              </button>
              <button onClick={() => { setEditTargets({ ...origTargets }); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm">
                Restaurar
              </button>
              <button onClick={() => { setEditingTargets(false); setEditTargets({ ...origTargets }); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm">
                Cancelar
              </button>
            </div>
          </div>
        ) : noTargets ? (
          <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700 text-center">
            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">No hay macros configurados</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Ve a la calculadora para establecer metas, o usa "Ajustar" para definirlas manualmente.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <MacroBar label="Calorías" current={Math.round(filled.kcal)} total={target.total_kcal} unit="kcal" color="bg-blue-500" />
            <MacroBar label="Proteína" current={Math.round(filled.protein)} total={target.total_protein} unit="g" color="bg-macro-protein" />
            <MacroBar label="Carbos" current={Math.round(filled.carbs)} total={target.total_carbs} unit="g" color="bg-macro-carbs" />
            <MacroBar label="Grasas" current={Math.round(filled.fat)} total={target.total_fat} unit="g" color="bg-macro-fat" />
          </div>
        )}

        {!noTargets && (
        <div className="flex items-center gap-6">
          <div className="h-20 w-20 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={22} outerRadius={36} dataKey="value" strokeWidth={0}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 text-xs">
            {pieData.map((e) => (
              <div key={e.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
                <span className="text-gray-600 dark:text-gray-300">{e.name}: {e.value}g</span>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {Object.entries(MEAL_LABELS).filter(([key]) => {
            if (key === "pre_workout" || key === "intra_workout" || key === "post_workout") return true;
            if (key.startsWith("meal") && Number(key.slice(4)) <= mealCount) return true;
            return (groupedItems[key] || []).length > 0;
          }).map(([key, label]) => {
            const items = groupedItems[key] || [];
            const total = items.reduce(
              (acc, i) => {
                const f = db.getFood(i.food_id);
                if (!f) return acc;
                const ratio = i.quantity / f.serving_size;
                return {
                  kcal: acc.kcal + f.kcal * ratio,
                  protein: acc.protein + f.protein * ratio,
                  carbs: acc.carbs + f.carbs * ratio,
                  fat: acc.fat + f.fat * ratio,
                };
              },
              { kcal: 0, protein: 0, carbs: 0, fat: 0 },
            );

            return (
              <div
                key={key}
                className={`overflow-hidden transition-all duration-200 ${selectedMeal === key ? "ring-2 ring-brand-500 border-brand-500 bg-brand-50 dark:bg-brand-900/15 shadow-md" : "border-gray-200 dark:border-gray-700 shadow-sm"} bg-white dark:bg-gray-900 rounded-xl border`}
              >
                <div
                  className="flex items-center justify-between cursor-pointer px-4 py-3 bg-gradient-to-r from-brand-50 to-white dark:from-brand-900/20 dark:to-gray-900 border-b border-gray-100 dark:border-gray-800"
                  onClick={() => setSelectedMeal(selectedMeal === key ? null : key)}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${items.length > 0 ? "bg-green-400" : "bg-gray-300"}`} />
                    <h4 className="font-semibold text-sm dark:text-white">{label}</h4>
                    {CARB_SUGGESTIONS[key] && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${CARB_SUGGESTIONS[key].color}`}>
                        {CARB_SUGGESTIONS[key].desc}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {Math.round(total.kcal)} kcal · P:{Math.round(total.protein)}g · C:{Math.round(total.carbs)}g · G:{Math.round(total.fat)}g
                  </span>
                </div>

                {items.length > 0 ? (
                  <div className="space-y-1.5 px-4 py-3">
                    {items.map((item) => {
                      const f = db.getFood(item.food_id);
                      if (!f) return null;
                      const ratio = item.quantity / f.serving_size;
                      return (
                        <div key={item.id} className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 group flex-wrap">
                          <span className="font-medium truncate dark:text-white min-w-0 flex-1">{f.name}</span>
                          <span className="text-gray-400 dark:text-gray-500 text-xs shrink-0">
                            ({(f.protein * ratio).toFixed(1)}p / {(f.carbs * ratio).toFixed(1)}c / {(f.fat * ratio).toFixed(1)}g)
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            {editingItemId === item.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={1}
                                  value={editItemQty}
                                  onChange={(e) => setEditItemQty(Math.max(1, Number(e.target.value) || 0))}
                                  onBlur={() => handleUpdateItemQty(item.id)}
                                  onKeyDown={(e) => e.key === "Enter" && handleUpdateItemQty(item.id)}
                                  className="w-16 text-xs text-right px-1 py-0.5 border border-brand-500 rounded outline-none focus:ring-1 focus:ring-brand-500"
                                  autoFocus
                                />
                                <span className="text-xs text-gray-400 dark:text-gray-500">{item.serving_unit}</span>
                              </div>
                            ) : (
                              <span
                                onClick={() => { setEditingItemId(item.id); setEditItemQty(item.quantity); }}
                                className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-brand-600 hover:underline"
                              >
                                {item.quantity}{item.serving_unit}
                              </span>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setRemoveItemId(item.id); }}
                              className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500 px-4 py-3">
                    Vacío. {selectedMeal === key ? "Elige un alimento de la lista →" : "Selecciona esta comida."}
                  </p>
                )}
              </div>
            );
          })}
          {mealCount < 6 && (
            <button
              onClick={() => setMealCount((c) => Math.min(6, c + 1))}
              className="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-400 hover:text-brand-600 hover:border-brand-400 dark:hover:border-brand-500 transition-all"
            >
              + Agregar comida {mealCount + 1}
            </button>
          )}
        </div>

        <div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sticky top-6">
            <h4 className="font-semibold text-sm mb-3 dark:text-white flex items-center gap-2">
              {selectedMeal ? (
                <><span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" /> Agregar a "{MEAL_LABELS[selectedMeal]}"</>
              ) : "Selecciona una comida"}
            </h4>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 mb-2"
              placeholder="Buscar alimento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex flex-wrap gap-1 mb-3">
              {["", "protein", "carbs", "vegetables", "fruits", "dairy", "grains", "legumes", "nuts", "beverages", "supplements", "other"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(categoryFilter === cat ? "" : cat)}
                  className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${categoryFilter === cat ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"}`}
                >
                  {cat ? ({ protein: "Proteínas", carbs: "Carbos", vegetables: "Verduras", fruits: "Frutas", dairy: "Lácteos", grains: "Cereales", legumes: "Legumbres", nuts: "Semillas", beverages: "Bebidas", supplements: "Supl.", other: "Otros" } as Record<string, string>)[cat] : "Todas"}
                </button>
              ))}
            </div>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {filteredFoods.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleOpenFoodCard(f)}
                  disabled={!selectedMeal}
                  className={`w-full text-left p-2 rounded-lg text-sm transition-colors ${selectedMeal ? "hover:bg-brand-50 dark:hover:bg-brand-900/20 cursor-pointer" : "opacity-50 cursor-not-allowed"} flex justify-between items-center`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate dark:text-white">{f.name}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase shrink-0">{f.category}</span>
                    {f.carb_type && CARB_TYPE_LABELS[f.carb_type] && (
                      <span className={`text-[9px] px-1 py-0.5 rounded ${CARB_TYPE_LABELS[f.carb_type].color}`}>
                        {CARB_TYPE_LABELS[f.carb_type].label}
                      </span>
                    )}
                  </div>
                      <span className="text-gray-400 dark:text-gray-500 text-xs shrink-0">{f.kcal}kcal</span>
                </button>
              ))}
              {apiFoods.length > 0 && (
                <>
                  <div className="border-t border-dashed border-gray-200 dark:border-gray-700 my-2 pt-2">
                    <span className="text-[10px] text-blue-500 font-medium flex items-center gap-1">
                      <Globe className="w-3 h-3" /> FatSecret
                    </span>
                  </div>
                  {apiFoods.map((f, i) => (
                    <button
                      key={`api-${i}`}
                      onClick={() => handleOpenFoodCard(f)}
                      disabled={!selectedMeal}
                      className={`w-full text-left p-2 rounded-lg text-sm transition-colors ${selectedMeal ? "hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer" : "opacity-50 cursor-not-allowed"} flex justify-between items-center`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate dark:text-white">{f.name}</span>
                        <span className="text-[10px] text-blue-500 uppercase shrink-0">API</span>
                        {f.carb_type && CARB_TYPE_LABELS[f.carb_type] && (
                          <span className={`text-[9px] px-1 py-0.5 rounded ${CARB_TYPE_LABELS[f.carb_type].color}`}>
                            {CARB_TYPE_LABELS[f.carb_type].label}
                          </span>
                        )}
                      </div>
                  <span className="text-gray-400 dark:text-gray-500 text-xs shrink-0">{f.kcal}kcal</span>
                    </button>
                  ))}
                </>
              )}
              {filteredFoods.length === 0 && apiFoods.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">Sin resultados.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedFood && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedFood(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg dark:text-white">{selectedFood.name}</h3>
              <button onClick={() => setSelectedFood(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <NutriRow label="Calorías" value={selectedFood.kcal} unit=" kcal" />
                <NutriRow label="Proteína" value={selectedFood.protein} unit="g" />
                <NutriRow label="Carbohidratos" value={selectedFood.carbs} unit="g" />
                <NutriRow label="Grasas" value={selectedFood.fat} unit="g" />
                <NutriRow label="Fibra" value={selectedFood.fiber} unit="g" />
                <NutriRow label="Categoría" value={selectedFood.category} unit="" />
              </div>
              {selectedFood.carb_type && (
                <div className={`text-xs text-center py-1.5 rounded-lg mb-4 ${CARB_TYPE_LABELS[selectedFood.carb_type]?.color || "bg-gray-100 dark:bg-gray-700"}`}>
                  Carbohidrato de absorción {CARB_TYPE_LABELS[selectedFood.carb_type]?.label?.toLowerCase() || ""}
                </div>
              )}
              <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-3">Valores por {selectedFood.serving_size}{selectedFood.serving_unit}</p>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <Scale className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="range"
                min={5}
                max={500}
                step={5}
                value={foodQuantity}
                onChange={(e) => setFoodQuantity(Number(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                min={1}
                max={5000}
                value={foodQuantity}
                onChange={(e) => setFoodQuantity(Math.max(1, Number(e.target.value) || 0))}
                className="w-20 text-sm font-medium text-right px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-gray-100"
              />
              <div className="flex gap-0.5 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                {["g", "ml", "unidad"].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setFoodUnit(u)}
                    className={`px-2 py-1 text-[11px] font-medium transition-colors ${foodUnit === u ? "bg-brand-600 text-white" : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs text-center mb-4 p-3 bg-brand-50 dark:bg-brand-900/20 rounded-xl">
              <div>
                <p className="font-bold text-macro-protein">{((selectedFood.protein * foodQuantity) / selectedFood.serving_size).toFixed(1)}g</p>
                <p className="text-gray-500 dark:text-gray-400">Proteína</p>
              </div>
              <div>
                <p className="font-bold text-macro-carbs">{((selectedFood.carbs * foodQuantity) / selectedFood.serving_size).toFixed(1)}g</p>
                <p className="text-gray-500 dark:text-gray-400">Carbh.</p>
              </div>
              <div>
                <p className="font-bold text-macro-fat">{((selectedFood.fat * foodQuantity) / selectedFood.serving_size).toFixed(1)}g</p>
                <p className="text-gray-500 dark:text-gray-400">Grasas</p>
              </div>
            </div>

            <button
              onClick={handleAddFood}
              disabled={!selectedMeal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-all duration-200 w-full disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Agregar a {selectedMeal ? `"${MEAL_LABELS[selectedMeal]}"` : "selecciona una comida"}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={removeItemId !== null}
        title="Quitar alimento"
        message="¿Quitar este alimento del plan?"
        onConfirm={() => removeItemId !== null && handleRemoveItem(removeItemId)}
        onCancel={() => setRemoveItemId(null)}
      />
      <PromptDialog
        open={showTemplatePrompt}
        title="Nombre de la plantilla"
        initialValue={plan?.plan.name || ""}
        onConfirm={(value) => { handleSaveTemplate(value); setShowTemplatePrompt(false); }}
        onCancel={() => setShowTemplatePrompt(false)}
      />
    </div>
  );
}

function MacroBar({ label, current, total, unit, color }: { label: string; current: number; total: number; unit: string; color: string }) {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  const status = pct >= 100 ? "bg-green-500" : color;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600 dark:text-gray-300">{label}</span>
        <span className="font-medium dark:text-white">{current}{unit} / {total}{unit}</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${status}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function NutriRow({ label, value, unit }: { label: string; value: number | string; unit: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-medium dark:text-white">{value}{unit}</span>
    </div>
  );
}

const emptyFood = {
  id: 0, name: "Desconocido", category: "other" as const,
  protein: 0, carbs: 0, fat: 0, fiber: 0, antioxidants: 0,
  kcal: 0, serving_size: 100, serving_unit: "g", source: "manual" as const,
};
