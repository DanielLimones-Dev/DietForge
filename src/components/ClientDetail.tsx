import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { db } from "@/lib/db";
import { calculateMacros, calculateBodyFatFromSkinfolds } from "@/lib/calculator";
import { generateDietPDF } from "@/lib/pdf";
import { ArrowLeft, FileText, TrendingUp, History, Ruler } from "lucide-react";
import type {
  Client,
  ClientMeasurement,
  ActivityLevel,
  Goal,
  MacroResult,
  DietTemplate,
  MealTime,
} from "@/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const clientId = Number(id);
  const [client] = useState<Client | null>(() => db.getClient(clientId) ?? null);
  const [measurements, setMeasurements] = useState<ClientMeasurement[]>(() => db.getMeasurements(clientId));
  const [plans, setPlans] = useState(() => db.getMealPlans(clientId));
  const [templates, setTemplates] = useState<DietTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  const [showCalc, setShowCalc] = useState(false);
  const [calcForm, setCalcForm] = useState({
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

  useEffect(() => {
    const c = db.getClient(clientId);
    if (!c) {
      navigate("/clients");
    }
  }, [clientId, navigate]);

  if (!client) return null;

  const latest = measurements[0];
  const weightChart = measurements
    .map((m) => ({ date: m.date.slice(0, 10), weight: m.weight, bodyFat: m.body_fat }))
    .reverse();

  const handleCalc = () => {
    const w = Number(calcForm.weight);
    const h = Number(calcForm.height);
    const a = Number(calcForm.age);
    if (!w || !h || !a) return;

    let bf = calcForm.bodyFat ? Number(calcForm.bodyFat) : undefined;
    let skinfolds = undefined;
    let bfMethod: "direct" | "skinfold" | undefined = undefined;

    if (calcForm.bfMethod === "skinfold") {
      const sf = {
        chest: calcForm.chest ? Number(calcForm.chest) : undefined,
        abdominal: calcForm.abdominal ? Number(calcForm.abdominal) : undefined,
        thigh: calcForm.thigh ? Number(calcForm.thigh) : undefined,
        triceps: calcForm.triceps ? Number(calcForm.triceps) : undefined,
        suprailiac: calcForm.suprailiac ? Number(calcForm.suprailiac) : undefined,
      };
      const calculated = calculateBodyFatFromSkinfolds(sf, calcForm.sex, a);
      if (calculated !== null) {
        bf = calculated;
        bfMethod = "skinfold";
        skinfolds = sf;
      }
    } else if (bf) {
      bfMethod = "direct";
    }

    const macros = calculateMacros(w, h, a, calcForm.sex, calcForm.activityLevel, calcForm.goal, bf);

    const measurement: ClientMeasurement = {
      id: 0,
      client_id: clientId,
      date: new Date().toISOString(),
      weight: w,
      height: h,
      age: a,
      sex: calcForm.sex,
      body_fat: bf,
      body_fat_method: bfMethod,
      skinfolds,
      activity_level: calcForm.activityLevel,
      goal: calcForm.goal,
      ...macros,
    };

    db.saveMeasurement(measurement);
    setResult(macros);
    setMeasurements(db.getMeasurements(clientId));
  };

  const handleCreatePlan = () => {
    if (!result || !latest) return;

    const plan = db.saveMealPlan(
      {
        client_id: clientId,
        measurement_id: latest.id,
        date: new Date().toISOString(),
        name: `Plan ${new Date().toLocaleDateString("es-MX")}`,
        total_kcal: result.tdee,
        total_protein: result.protein,
        total_carbs: result.carbs,
        total_fat: result.fat,
        total_fiber: result.fiber,
        total_antioxidants: result.antioxidants,
      },
      [],
    );

    setPlans(db.getMealPlans(clientId));
    navigate(`/plans/${plan.id}`);
  };

  const handleLoadTemplate = () => {
    setTemplates(db.getTemplates());
    setShowTemplates(true);
  };

  const handleApplyTemplate = (t: DietTemplate) => {
    setShowTemplates(false);
    const itemFoods: { foodId: number; meal_time: string; quantity: number; serving_unit: string }[] = [];
    for (const item of t.items) {
      let food = db.getFoods().find((f) => f.name === item.food.name);
      if (!food) {
        food = db.saveFood({ ...item.food, source: "manual" });
      }
      itemFoods.push({ foodId: food.id, meal_time: item.meal_time, quantity: item.quantity, serving_unit: item.serving_unit });
    }
    const plan = db.saveMealPlan(
      {
        client_id: clientId,
        measurement_id: latest?.id || 0,
        date: new Date().toISOString(),
        name: `${t.name} ${new Date().toLocaleDateString("es-MX")}`,
        total_kcal: t.total_kcal,
        total_protein: t.total_protein,
        total_carbs: t.total_carbs,
        total_fat: t.total_fat,
        total_fiber: t.total_fiber,
        total_antioxidants: 0,
      },
      itemFoods.map((i) => ({
        meal_plan_id: 0,
        meal_time: i.meal_time as MealTime,
        food_id: i.foodId,
        quantity: i.quantity,
        serving_unit: i.serving_unit,
      })),
    );
    setPlans(db.getMealPlans(clientId));
    navigate(`/plans/${plan.id}`);
  };

  const handleExportPDF = (planId: number) => {
    const data = db.getMealPlan(planId);
    if (!data || !client) return;
    const meas = db.getLatestMeasurement(data.plan.client_id);
    if (!meas) return;

    const items = data.items.map((i) => {
      const food = db.getFood(i.food_id);
      return { ...i, food: food || { id: 0, name: "Desconocido", category: "other", protein: 0, carbs: 0, fat: 0, fiber: 0, antioxidants: 0, kcal: 0, serving_size: 100, serving_unit: "g", source: "manual" as const } };
    });

    const html = generateDietPDF({ client, measurement: meas, plan: data.plan, items });
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/clients")} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold dark:text-white">{client.name}</h2>
        <Link
          to={`/clients/${clientId}/edit`}
          className="ml-auto text-sm text-brand-600 hover:underline"
        >
          Editar
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 text-sm">@</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
              <p className="font-medium dark:text-white">{client.email || "—"}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <span className="text-green-600 dark:text-green-400 text-sm">📞</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Teléfono</p>
              <p className="font-medium dark:text-white">{client.phone || "—"}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Planes generados</p>
              <p className="font-medium dark:text-white">{plans.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 mb-8">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2 dark:text-white">
            <TrendingUp className="w-4 h-4 text-brand-600" />
            Calculadora de Macros
          </h3>
          <button
            onClick={() => setShowCalc(!showCalc)}
            className="text-sm text-brand-600 hover:underline"
          >
            {showCalc ? "Ocultar" : "Nuevo cálculo"}
          </button>
        </div>

        {showCalc && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Peso (kg) *</label>
                <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={calcForm.weight} onChange={(e) => setCalcForm({ ...calcForm, weight: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Altura (cm) *</label>
                <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={calcForm.height} onChange={(e) => setCalcForm({ ...calcForm, height: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Edad *</label>
                <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={calcForm.age} onChange={(e) => setCalcForm({ ...calcForm, age: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">% Grasa corporal</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCalcForm({ ...calcForm, bfMethod: "direct" })}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${calcForm.bfMethod === "direct" ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600"}`}
                  >
                    Directo
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalcForm({ ...calcForm, bfMethod: "skinfold" })}
                    className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${calcForm.bfMethod === "skinfold" ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600"}`}
                  >
                    <Ruler className="w-3 h-3" />
                    Pliegues
                  </button>
                </div>
                {calcForm.bfMethod === "direct" ? (
                  <input type="number" placeholder="Ej: 15" className="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm" value={calcForm.bodyFat} onChange={(e) => setCalcForm({ ...calcForm, bodyFat: e.target.value })} />
                ) : (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 dark:text-gray-500">Pectoral</label>
                      <input type="number" placeholder="mm" className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs dark:bg-gray-800 dark:text-gray-100" value={calcForm.chest} onChange={(e) => setCalcForm({ ...calcForm, chest: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 dark:text-gray-500">Abdominal</label>
                      <input type="number" placeholder="mm" className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs dark:bg-gray-800 dark:text-gray-100" value={calcForm.abdominal} onChange={(e) => setCalcForm({ ...calcForm, abdominal: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 dark:text-gray-500">Muslo</label>
                      <input type="number" placeholder="mm" className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs dark:bg-gray-800 dark:text-gray-100" value={calcForm.thigh} onChange={(e) => setCalcForm({ ...calcForm, thigh: e.target.value })} />
                    </div>
                    {calcForm.sex === "female" && (
                      <>
                        <div>
                          <label className="block text-[10px] text-gray-400 dark:text-gray-500">Tríceps</label>
                          <input type="number" placeholder="mm" className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs dark:bg-gray-800 dark:text-gray-100" value={calcForm.triceps} onChange={(e) => setCalcForm({ ...calcForm, triceps: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 dark:text-gray-500">Suprailíaco</label>
                          <input type="number" placeholder="mm" className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs dark:bg-gray-800 dark:text-gray-100" value={calcForm.suprailiac} onChange={(e) => setCalcForm({ ...calcForm, suprailiac: e.target.value })} />
                        </div>
                      </>
                    )}
                    <div className="flex items-end text-[10px] text-gray-400 dark:text-gray-500 pb-1">
                      {calcForm.bfMethod === "skinfold" && (
                        calcForm.sex === "male"
                          ? "3 pliegues: Pectoral + Abdominal + Muslo"
                          : "3 pliegues: Tríceps + Suprailíaco + Muslo"
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Sexo</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={calcForm.sex} onChange={(e) => setCalcForm({ ...calcForm, sex: e.target.value as "male" | "female" })}>
                  <option value="male">Hombre</option>
                  <option value="female">Mujer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Actividad</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={calcForm.activityLevel} onChange={(e) => setCalcForm({ ...calcForm, activityLevel: e.target.value as ActivityLevel })}>
                  <option value="sedentary">Sedentario</option>
                  <option value="light">Ligero</option>
                  <option value="moderate">Moderado</option>
                  <option value="active">Activo</option>
                  <option value="very_active">Muy activo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Objetivo</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={calcForm.goal} onChange={(e) => setCalcForm({ ...calcForm, goal: e.target.value as Goal })}>
                  <option value="lose_fat">Perder grasa</option>
                  <option value="maintain">Mantener</option>
                  <option value="build_muscle">Ganar músculo</option>
                  <option value="gain_weight">Subir de peso</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Comidas al día</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={calcForm.mealCount} onChange={(e) => setCalcForm({ ...calcForm, mealCount: e.target.value })}>
                  {[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm dark:text-gray-300">
              <input type="checkbox" checked={calcForm.hasWorkout} onChange={(e) => setCalcForm({ ...calcForm, hasWorkout: e.target.checked })} className="rounded" />
              Incluye entrenamiento (pre/intra/post)
            </label>
            <div className="flex gap-3">
              <button onClick={handleCalc} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-all duration-200">
                Calcular Macros
              </button>
              {result && (
                <button onClick={handleCreatePlan} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-all duration-200">
                  Crear Plan de Comidas
                </button>
              )}
              <button onClick={handleLoadTemplate} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-all duration-200">
                Cargar Plantilla
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="p-5 pt-0">
            <div className="grid grid-cols-5 gap-3">
              <MacroBox label="Calorías" value={`${result.tdee}`} unit="kcal" color="text-gray-900 dark:text-gray-100" />
              <MacroBox label="Proteína" value={`${result.protein}`} unit="g" color="text-macro-protein" />
              <MacroBox label="Carbohidratos" value={`${result.carbs}`} unit="g" color="text-macro-carbs" />
              <MacroBox label="Grasas" value={`${result.fat}`} unit="g" color="text-macro-fat" />
              <MacroBox label="Fibra" value={`${result.fiber}`} unit="g" color="text-macro-fiber" />
            </div>
          </div>
        )}

        {!showCalc && !result && latest && (
          <div className="p-5 pt-0">
            <p className="text-sm text-gray-500 dark:text-gray-400">Último registro:</p>
            <div className="grid grid-cols-5 gap-3 mt-2">
              <MacroBox label="Calorías" value={`${latest.tdee}`} unit="kcal" color="text-gray-900 dark:text-gray-100" />
              <MacroBox label="Proteína" value={`${latest.protein}`} unit="g" color="text-macro-protein" />
              <MacroBox label="Carbohidratos" value={`${latest.carbs}`} unit="g" color="text-macro-carbs" />
              <MacroBox label="Grasas" value={`${latest.fat}`} unit="g" color="text-macro-fat" />
              <MacroBox label="Fibra" value={`${latest.fiber}`} unit="g" color="text-macro-fiber" />
            </div>
          </div>
        )}
      </div>

      {weightChart.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-4 dark:text-white">
              <History className="w-4 h-4 text-brand-600" />
              Historial de Peso
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weightChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="weight" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} name="Peso (kg)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {weightChart.some((m) => m.bodyFat) && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-4 dark:text-white">
                <History className="w-4 h-4 text-brand-600" />
                Historial de % Grasa
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weightChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} domain={["auto", "auto"]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="bodyFat" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="% Grasa" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold flex items-center gap-2 dark:text-white">
            <FileText className="w-4 h-4 text-brand-600" />
            Planes Anteriores
          </h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {plans.map((p) => (
            <div key={p.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium dark:text-white">{p.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {p.total_kcal} kcal · P:{p.total_protein}g · C:{p.total_carbs}g · G:{p.total_fat}g
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => navigate(`/plans/${p.id}`)} className="text-sm text-brand-600 hover:underline">
                  Ver
                </button>
                <button onClick={() => handleExportPDF(p.id)} className="text-sm text-gray-600 dark:text-gray-300 hover:underline">
                  PDF
                </button>
              </div>
            </div>
          ))}
          {plans.length === 0 && (
            <p className="p-5 text-sm text-gray-400 dark:text-gray-500 text-center">
              Aún no hay planes. Calcula macros y crea el primer plan.
            </p>
          )}
        </div>
      </div>

      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowTemplates(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4 dark:text-white">Cargar Plantilla</h3>
            {templates.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No hay plantillas guardadas. Crea una desde el plan de comidas.</p>
            )}
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 mb-2">
                <div>
                  <p className="font-medium text-sm dark:text-white">{t.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t.items.length} alimentos · {Math.round(t.total_kcal)} kcal</p>
                </div>
                <button onClick={() => handleApplyTemplate(t)} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-all duration-200 text-xs px-3 py-1.5">
                  Usar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MacroBox({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  const bgMap: Record<string, string> = {
    "text-macro-protein": "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900",
    "text-macro-carbs": "bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900",
    "text-macro-fat": "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-900",
    "text-macro-fiber": "bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900",
  };
  const bg = bgMap[color] || "bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700";
  return (
    <div className={`text-center p-3 ${bg} rounded-lg border`}>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">{unit}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
