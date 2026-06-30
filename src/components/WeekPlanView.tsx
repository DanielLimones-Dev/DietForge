import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import { getCarbDayLabel, getCarbDayColor, getCarbDayKcalAdjustment, calculateDayMacros } from "@/lib/carbCycle";
import { DEFAULT_CARB_PATTERNS, type CarbDay, type CarbCyclePattern, type MealPlan, type MacroResult } from "@/types";
import { ArrowLeft, Check, ChevronRight, Moon } from "lucide-react";

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function WeekPlanView() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const cid = Number(clientId);
  const [client] = useState(() => db.getClient(cid));
  const [latest] = useState(() => db.getLatestMeasurement(cid));
  const [weekPlans] = useState(() => db.getWeekPlans(cid));
  const [existingWeekPlan] = useState(() => weekPlans[0]);
  const [pattern, setPattern] = useState<CarbCyclePattern>(DEFAULT_CARB_PATTERNS[0]);

  const [days, setDays] = useState<CarbDay[]>(() => existingWeekPlan?.day_plans.map((d) => d.carb_day) || DEFAULT_CARB_PATTERNS[0].days);
  const [restDays, setRestDays] = useState<boolean[]>(() =>
    existingWeekPlan ? existingWeekPlan.day_plans.map((d) => d.rest_day ?? false) : Array(7).fill(false),
  );
  const [dayPlans, setDayPlans] = useState<(MealPlan | null)[]>(() =>
    existingWeekPlan ? existingWeekPlan.day_plans.map((dp) => db.getMealPlan(dp.meal_plan_id)?.plan ?? null) : Array(7).fill(null),
  );

  useEffect(() => {
    if (!client) navigate("/clients");
  }, [client, navigate]);

  if (!client || !latest) return (
    <div className="p-6 text-center text-gray-400">Cliente no encontrado o sin mediciones</div>
  );

  const baseMacros: MacroResult = {
    tmb: latest.tmb, tdee: latest.tdee, protein: latest.protein,
    carbs: latest.carbs, fat: latest.fat, fiber: latest.fiber, antioxidants: latest.antioxidants,
  };

  const handleSetPattern = (p: CarbCyclePattern) => {
    setPattern(p);
    setDays([...p.days]);
    if (existingWeekPlan) {
      db.deleteWeekPlan(existingWeekPlan.id);
    }
    setDayPlans(Array(7).fill(null));
  };

  const toggleDay = (index: number, day: CarbDay) => {
    const next = [...days];
    next[index] = day;
    setDays(next);
  };

  const toggleRestDay = (index: number) => {
    const next = [...restDays];
    next[index] = !next[index];
    setRestDays(next);
  };

  const handleCreateDay = (index: number) => {
    const dayMacros = calculateDayMacros(baseMacros, days[index], restDays[index]);
    const plan = db.saveMealPlan({
      client_id: cid, measurement_id: latest.id, date: new Date().toISOString(),
      name: `${DAY_LABELS[index]} — ${getCarbDayLabel(days[index])}`,
      total_kcal: dayMacros.tdee, total_protein: dayMacros.protein,
      total_carbs: dayMacros.carbs, total_fat: dayMacros.fat,
      total_fiber: dayMacros.fiber, total_antioxidants: dayMacros.antioxidants,
    }, []);
    const newPlans = [...dayPlans];
    newPlans[index] = plan;
    setDayPlans(newPlans);
    navigate(`/plans/${plan.id}`);
  };

  const handleSaveWeek = () => {
    const planIds = dayPlans.map((dp) => dp?.id ?? 0);
    db.saveWeekPlan({
      client_id: cid, start_date: new Date().toISOString(),
      name: `Semana ${new Date().toLocaleDateString("es-MX")}`,
      day_plans: days.map((carb_day, i) => ({ day: i, carb_day, meal_plan_id: planIds[i], rest_day: restDays[i] || undefined })),
    });
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(`/clients/${cid}`)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors active:scale-[0.97]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
          Plan Semanal — {client.name}
        </h2>
      </div>

      <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
        <h3 className="font-semibold text-sm mb-3 dark:text-white">Patrón de Carb Cycling</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {DEFAULT_CARB_PATTERNS.map((p) => (
            <button key={p.name} onClick={() => handleSetPattern(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all active:scale-[0.97] ${
                pattern.name === p.name
                  ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400"
              }`}>
              {p.name}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">{pattern.description}</p>
      </div>

      <div className="grid grid-cols-7 gap-3 mb-6">
        {days.map((day, i) => {
          const adj = getCarbDayKcalAdjustment(baseMacros.tdee, day);
          const hasPlan = dayPlans[i] !== null;
          const isRest = restDays[i];
          return (
            <div key={i} className={`rounded-xl border p-3.5 text-center transition-all ${isRest ? "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800" : "bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 border-gray-200 dark:border-gray-700 shadow-sm"}`}>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">{DAY_LABELS[i]}</p>
              {isRest ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                  <Moon className="w-2.5 h-2.5" /> Rest Day
                </span>
              ) : (
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${getCarbDayColor(day)}`}>
                  {getCarbDayLabel(day)}
                </span>
              )}
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">{isRest ? "-25% kcal" : adj.label}</p>
              <div className="mt-2.5 space-y-1.5">
                {hasPlan ? (
                  <button onClick={() => navigate(`/plans/${dayPlans[i]!.id}`)} className="w-full inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-brand-50 text-brand-600 hover:bg-brand-500 hover:text-white dark:bg-brand-900/20 dark:text-brand-400 dark:hover:bg-brand-500 dark:hover:text-white transition-all active:scale-[0.97]">
                    <Check className="w-3 h-3" /> Plan <ChevronRight className="w-3 h-3" />
                  </button>
                ) : (
                  <button onClick={() => handleCreateDay(i)} className="w-full inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border border-dashed border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all active:scale-[0.97]">
                    + Crear plan
                  </button>
                )}
              </div>
              <div className="mt-2 space-y-1">
                <button onClick={() => toggleRestDay(i)}
                  className={`w-full text-[9px] py-1 rounded-lg border transition-all active:scale-[0.97] ${isRest ? "bg-indigo-500 text-white border-indigo-500" : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-indigo-300"}`}
                >
                  <Moon className="w-2.5 h-2.5 inline-block mr-0.5" />
                  Rest
                </button>
                {!isRest && (
                  <select value={day} onChange={(e) => toggleDay(i, e.target.value as CarbDay)}
                    className="text-[9px] px-1.5 py-1 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-800 dark:text-gray-100 w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-500/30">
                    <option value="high">Alto</option>
                    <option value="moderate">Medio</option>
                    <option value="low">Bajo</option>
                    <option value="refeed">Refeed</option>
                  </select>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button onClick={handleSaveWeek} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700 active:scale-[0.97] transition-all shadow-sm">
          Guardar Semana
        </button>
        <button onClick={() => navigate(`/clients/${cid}`)} className="px-5 py-2.5 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-[0.97] transition-all">
          Volver al cliente
        </button>
      </div>
    </div>
  );
}
