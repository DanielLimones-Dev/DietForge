import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { db } from "@/lib/db";
import { calculateMacros, calculateBodyFatFromSkinfolds, adjustMacroField, macroKcal } from "@/lib/calculator";
import { generateDietPDF } from "@/lib/pdf";
import { openProgressReport } from "@/lib/progressReport";
import { calculateWeightTrend, getRateLabel } from "@/lib/trends";
import { suggestAdjustment, getTargetRate } from "@/lib/progression";
import { calculateFFMI, calculateLeanBodyMass } from "@/lib/metrics";
import { getPhaseLabel, getPhaseColor, calculatePhaseMacros } from "@/lib/phases";
import { downloadCSV, measurementsToCSV } from "@/lib/csv";
import { CheckInForm } from "./CheckInForm";
import { CheckInHistory } from "./CheckInHistory";
import { PeakWeekSimulator } from "./PeakWeekSimulator";
import { CompetitionPeakWeekEditor } from "./CompetitionPeakWeekEditor";
import { ConfirmDialog } from "./ui";
import { useToast } from "./Toast";
import { ArrowLeft, FileText, TrendingUp, History, Ruler, Camera, Download, BarChart3, Award, Activity, Moon } from "lucide-react";
import type {
  Client, ClientMeasurement, ActivityLevel, Goal, MacroResult,
  DietTemplate, MealTime, CompetitionPhase, CheckIn, Competition, PeakWeekDayConfig,
} from "@/types";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const REST_DAY_MODIFIER = 0.75;

export function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const clientId = Number(id);
  const [client] = useState<Client | null>(() => db.getClient(clientId) ?? null);
  const [now] = useState(() => Date.now());
  const [competitions, setCompetitions] = useState<Competition[]>(() => db.getCompetitions(clientId));
  const [plans, setPlans] = useState(() => db.getMealPlans(clientId));
  const [templates, setTemplates] = useState<DietTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [showRestDay, setShowRestDay] = useState(false);
  const [editingCheckin, setEditingCheckin] = useState<CheckIn | undefined>(undefined);
  const [checkinVersion, setCheckinVersion] = useState(0);
  const [showCompetitionForm, setShowCompetitionForm] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<Competition | undefined>(undefined);
  const [showPhases, setShowPhases] = useState(false);
  const [showPhaseInfo, setShowPhaseInfo] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<CompetitionPhase | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState<{ planId: number } | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const { toast } = useToast();

  const [showCalc, setShowCalc] = useState(() => !!(location.state as Record<string, unknown>)?.openCalc);
  const [calcForm, setCalcForm] = useState({
    weight: "", height: "", age: "", sex: "male" as "male" | "female",
    bodyFat: "", bfMethod: "direct" as "direct" | "isak1",
    chest: "", abdominal: "", thigh: "", triceps: "", suprailiac: "", subscapular: "", biceps: "", iliacCrest: "", supraspinale: "", medialCalf: "",
    armRelaxed: "", armFlexed: "", waist: "", hip: "", calfMax: "",
    humerus: "", femur: "", sittingHeight: "",
    activityLevel: "moderate" as ActivityLevel,
    goal: "maintain" as Goal,
    hasWorkout: true, usePhase: false,
  });
  const [result, setResult] = useState<MacroResult | null>(null);
  const [editResult, setEditResult] = useState<MacroResult | null>(null);
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  const [calcError, setCalcError] = useState("");
  const [compEditorData, setCompEditorData] = useState<{ name: string; date: string; category: string; weight: string; placement: string; config: PeakWeekDayConfig[] } | null>(null);

  const macroFields = ["protein", "carbs", "fat"] as const;

  const handleEditMacro = (field: string, value: number) => {
    if (!editResult) return;
    if (field === "tdee") {
      setEditResult({
        ...editResult,
        tdee: value,
        protein: Math.round(value * 0.23 / 4),
        carbs: Math.round(value * 0.50 / 4),
        fat: Math.round(value * 0.27 / 9),
      });
      setChangedFields((prev) => new Set(prev).add("tdee"));
      return;
    }
    setEditResult({ ...editResult, [field]: value });
    setChangedFields((prev) => new Set(prev).add(field));
  };

  const resetMacros = () => {
    const orig = result || latest;
    if (orig) {
      setEditResult({ ...orig });
      setChangedFields(new Set());
    }
  };

  useEffect(() => {
    const c = db.getClient(clientId);
    if (!c) navigate("/clients");
  }, [clientId, navigate]);

  if (!client) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-bold dark:text-white">Cliente no encontrado</h2>
        <p className="text-gray-400 mt-2">El cliente que buscas no existe o fue eliminado.</p>
        <Link to="/clients" className="inline-block mt-4 px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-medium">Volver a clientes</Link>
      </div>
    </div>
  );

  const measurements = db.getMeasurements(clientId);
  const latest = measurements[0];
  const checkins = db.getCheckIns(clientId);
  const trend = calculateWeightTrend([...measurements, ...checkins]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _carouselKey = checkinVersion;
  const suggestion = latest && selectedPhase
    ? suggestAdjustment(
        { tmb: latest.tmb, tdee: latest.tdee, protein: latest.protein, carbs: latest.carbs, fat: latest.fat, fiber: latest.fiber, antioxidants: latest.antioxidants },
        [...measurements, ...checkins],
        selectedPhase,
        getTargetRate(selectedPhase),
      )
    : null;

  const GOAL_BADGES: Record<Goal, { label: string; classes: string }> = {
    lose_fat: { label: "Déficit", classes: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800" },
    maintain: { label: "Mantenimiento", classes: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800" },
    build_muscle: { label: "Volumen", classes: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800" },
    gain_weight: { label: "Aumento", classes: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800" },
  };

  const calcMeas = measurements.find((m) => m.protein > 0 || m.tdee > 0);
  interface ChartPoint { date: string; weight: number; bodyFat: number | undefined }
  const weightChart: ChartPoint[] = [
    ...checkins.map((c) => ({ date: c.date.slice(0, 10), weight: c.weight, bodyFat: c.body_fat })),
  ]
    .filter((p) => p.weight > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .reduce<ChartPoint[]>((acc, p) => {
      const last = acc[acc.length - 1];
      if (last && last.date === p.date) {
        acc[acc.length - 1] = p;
      } else {
        acc.push(p);
      }
      return acc;
    }, []);

  const handleCalc = () => {
    const w = Number(calcForm.weight);
    const h = Number(calcForm.height);
    const a = Number(calcForm.age);
    if (!w || !h || !a) {
      setCalcError("Completa peso, altura y edad para calcular");
      return;
    }
    setCalcError("");

    let bf = calcForm.bodyFat ? Number(calcForm.bodyFat) : undefined;
    let skinfolds = undefined;
    let bfMethod: "direct" | "isak1" | undefined = undefined;

    if (calcForm.bfMethod === "isak1") {
      const sf = {
        chest: calcForm.chest ? Number(calcForm.chest) : undefined,
        abdominal: calcForm.abdominal ? Number(calcForm.abdominal) : undefined,
        thigh: calcForm.thigh ? Number(calcForm.thigh) : undefined,
        triceps: calcForm.triceps ? Number(calcForm.triceps) : undefined,
        suprailiac: calcForm.suprailiac ? Number(calcForm.suprailiac) : undefined,
        subscapular: calcForm.subscapular ? Number(calcForm.subscapular) : undefined,
        biceps: calcForm.biceps ? Number(calcForm.biceps) : undefined,
        iliacCrest: calcForm.iliacCrest ? Number(calcForm.iliacCrest) : undefined,
        supraspinale: calcForm.supraspinale ? Number(calcForm.supraspinale) : undefined,
        medialCalf: calcForm.medialCalf ? Number(calcForm.medialCalf) : undefined,
      };
      const calculated = calculateBodyFatFromSkinfolds(sf, calcForm.sex, a);
      if (calculated !== null) { bf = calculated; bfMethod = "isak1"; skinfolds = sf; }
    } else if (bf) { bfMethod = "direct"; }

    let macros = calculateMacros(w, h, a, calcForm.sex, calcForm.activityLevel, calcForm.goal, bf);
    if (calcForm.usePhase && selectedPhase) {
      macros = calculatePhaseMacros(macros, w, selectedPhase);
    }

    const calcDate = new Date();
    const calcDateLocal = new Date(calcDate.getFullYear(), calcDate.getMonth(), calcDate.getDate());

    const measurement: ClientMeasurement = {
      id: 0, client_id: clientId, date: calcDateLocal.toISOString(),
      weight: w, height: h, age: a, sex: calcForm.sex,
      body_fat: bf, body_fat_method: bfMethod, skinfolds,
      isak_data: calcForm.bfMethod === "isak1" ? {
        girths: {
          armRelaxed: calcForm.armRelaxed ? Number(calcForm.armRelaxed) : undefined,
          armFlexed: calcForm.armFlexed ? Number(calcForm.armFlexed) : undefined,
          waist: calcForm.waist ? Number(calcForm.waist) : undefined,
          hip: calcForm.hip ? Number(calcForm.hip) : undefined,
          calfMax: calcForm.calfMax ? Number(calcForm.calfMax) : undefined,
        },
        breadths: {
          humerus: calcForm.humerus ? Number(calcForm.humerus) : undefined,
          femur: calcForm.femur ? Number(calcForm.femur) : undefined,
        },
        sittingHeight: calcForm.sittingHeight ? Number(calcForm.sittingHeight) : undefined,
      } : undefined,
      activity_level: calcForm.activityLevel, goal: calcForm.goal,
      ...macros,
    };

    db.saveMeasurement(measurement);
    const checkinDate = `${calcDate.getFullYear()}-${String(calcDate.getMonth() + 1).padStart(2, '0')}-${String(calcDate.getDate()).padStart(2, '0')}`;
    db.saveCheckIn({ client_id: clientId, date: checkinDate, weight: w, body_fat: bf });
    setResult(macros);
    setEditResult({ ...macros });
    setCheckinVersion((v) => v + 1);
  };

  const handleCreatePlan = (isRestDay?: boolean) => {
    let macros = editResult || result || latest;
    if (!macros) return;
    if (selectedPhase && latest) {
      macros = calculatePhaseMacros(macros, latest.weight, selectedPhase);
    }
    const useRest = isRestDay ?? showRestDay;
    const suffix = useRest ? " — Rest Day" : "";
    const planMacros = useRest ? {
      tdee: Math.round(macros.tdee * REST_DAY_MODIFIER),
      protein: Math.round(macros.protein * REST_DAY_MODIFIER),
      carbs: Math.round(macros.carbs * REST_DAY_MODIFIER),
      fat: Math.round(macros.fat * REST_DAY_MODIFIER),
      fiber: macros.fiber,
      antioxidants: macros.antioxidants,
      tmb: macros.tmb,
    } : macros;
    const plan = db.saveMealPlan({
      client_id: clientId, measurement_id: latest?.id ?? 0, date: new Date().toISOString(),
      name: `Plan ${new Date().toLocaleDateString("es-MX")}${suffix}`,
      total_kcal: planMacros.tdee, total_protein: planMacros.protein, total_carbs: planMacros.carbs,
      total_fat: planMacros.fat, total_fiber: planMacros.fiber, total_antioxidants: planMacros.antioxidants,
    }, []);
    setPlans(db.getMealPlans(clientId));

    if (useRest) return;

    // Also create rest day plan if toggle is active
    if (showRestDay) {
      handleCreatePlan(true);
    }
    navigate(`/plans/${plan.id}`);
  };

  const handleLoadTemplate = () => { setTemplates(db.getTemplates()); setShowTemplates(true); };

  const handleApplyTemplate = (t: DietTemplate) => {
    setShowTemplates(false);
    const itemFoods: { foodId: number; meal_time: string; quantity: number; serving_unit: string }[] = [];
    for (const item of t.items) {
      let food = db.getFoods().find((f) => f.name === item.food.name);
      if (!food) food = db.saveFood({ ...item.food, source: "manual" });
      itemFoods.push({ foodId: food.id, meal_time: item.meal_time, quantity: item.quantity, serving_unit: item.serving_unit });
    }
    const plan = db.saveMealPlan({
      client_id: clientId, measurement_id: latest?.id || 0, date: new Date().toISOString(),
      name: `${t.name} ${new Date().toLocaleDateString("es-MX")}`,
      total_kcal: t.total_kcal, total_protein: t.total_protein, total_carbs: t.total_carbs,
      total_fat: t.total_fat, total_fiber: t.total_fiber, total_antioxidants: 0,
    }, itemFoods.map((i) => ({
      meal_plan_id: 0, meal_time: i.meal_time as MealTime, food_id: i.foodId,
      quantity: i.quantity, serving_unit: i.serving_unit,
    })));
    setPlans(db.getMealPlans(clientId));
    navigate(`/plans/${plan.id}`);
  };

  const generatePrepPlan = (comp: Competition) => {
    if (!latest) return;
    const weeks = Math.max(2, Math.round((new Date(comp.date).getTime() - now) / 604800000));
    const endKcal = Math.round(latest.tdee * 0.6);
    const endCarbs = Math.round(latest.carbs * 0.3);
    const avgKcal = Math.round((latest.tdee + endKcal) / 2);
    const avgCarbs = Math.round((latest.carbs + endCarbs) / 2);
    const avgProtein = Math.round(latest.protein * 1.05);
    const avgFat = Math.round((avgKcal - avgProtein * 4 - avgCarbs * 4) / 9);

    db.saveMealPlan({
      client_id: clientId, measurement_id: latest.id,
      date: new Date().toISOString(),
      name: `Prep ${weeks}sem → ${comp.name}`,
      total_kcal: avgKcal, total_protein: avgProtein,
      total_carbs: avgCarbs, total_fat: Math.max(30, avgFat),
      total_fiber: latest.fiber, total_antioxidants: latest.antioxidants,
    }, []);
    setPlans(db.getMealPlans(clientId));
  };

  const handleDeletePlan = (planId: number) => {
    setDeleteConfirm({ planId });
  };

  const handleDeleteAllPlans = () => {
    setDeleteAllConfirm(true);
  };

  const confirmDeletePlan = () => {
    if (!deleteConfirm) return;
    db.deleteMealPlan(deleteConfirm.planId);
    setPlans(db.getMealPlans(clientId));
    setDeleteConfirm(null);
    toast("Plan eliminado");
  };

  const confirmDeleteAllPlans = () => {
    for (const p of plans) db.deleteMealPlan(p.id);
    setPlans(db.getMealPlans(clientId));
    setDeleteAllConfirm(false);
    toast("Todos los planes eliminados");
  };

  const handleDeleteCompetition = (id: number) => {
    if (!confirm("¿Eliminar esta competencia?")) return;
    db.deleteCompetition(id);
    setCompetitions(db.getCompetitions(clientId));
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
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 300); }
  };

  const handleProgressReport = () => {
    const reportMeas = measurements.filter((m) => m.protein > 0 || m.tdee > 0).slice(0, 1);
    openProgressReport({ client, measurements: reportMeas, checkins: checkins.slice(0, 1), competition: competitions[0], phase: selectedPhase });
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate("/clients")} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 dark:text-gray-100" />
        </button>
        <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2 flex-wrap">
          {client.name}
          {latest && (() => { const b = GOAL_BADGES[latest.goal]; return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${b.classes}`}>{b.label}</span>; })()}
          {selectedPhase && <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getPhaseColor(selectedPhase)}`}>{getPhaseLabel(selectedPhase)}</span>}
        </h2>
        <Link to={`/clients/${clientId}/edit`} className="ml-auto text-sm text-brand-600 hover:underline">Editar</Link>
      </div>

      {client.next_check_in_date && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm mb-4 ${new Date(client.next_check_in_date).getTime() < Date.now() ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800" : "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800"}`}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {new Date(client.next_check_in_date).getTime() < Date.now() ? (
            <><span className="font-semibold">Check-in vencido</span> — {client.next_check_in_date.slice(0, 10)}</>
          ) : (
            <><span className="font-semibold">Próximo check-in</span>: {client.next_check_in_date.slice(0, 10)}</>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <button onClick={() => { setEditingCheckin(undefined); setShowCheckin(true); }} className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-brand-300 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/40 hover:border-brand-400 dark:hover:border-brand-600 transition-all text-sm font-semibold text-brand-700 dark:text-brand-300 cursor-pointer">
          <Camera className="w-4 h-4" /> Check-in
        </button>
        <button onClick={handleProgressReport} className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:border-purple-400 dark:hover:border-purple-600 transition-all text-sm font-semibold text-purple-700 dark:text-purple-300 cursor-pointer">
          <BarChart3 className="w-4 h-4" /> Reporte Progreso
        </button>
        <button onClick={() => setShowPhases(!showPhases)} className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 hover:border-orange-400 dark:hover:border-orange-600 transition-all text-sm font-semibold text-orange-700 dark:text-orange-300 cursor-pointer">
          <Award className="w-4 h-4" /> {showPhases ? "Ocultar Fases" : "Fases"}
        </button>
        {(editResult || result || latest) && (
          <button onClick={() => handleCreatePlan()} className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all text-sm font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            Plan de Comidas
          </button>
        )}
        {(editResult || result || latest) && (
          <button onClick={() => setShowRestDay(!showRestDay)}
            className={`flex items-center gap-2 p-3 rounded-xl border-2 border-dashed transition-all text-sm font-semibold cursor-pointer ${showRestDay ? "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300" : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-600"}`}>
            <Moon className="w-4 h-4" />
            Rest Day
            {showRestDay && <span className="ml-1 text-[10px] opacity-70">activo</span>}
          </button>
        )}
      </div>

      {showPhases && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm dark:text-white flex items-center gap-2"><Award className="w-4 h-4 text-orange-600" /> Fase de Competencia</h3>
            <button onClick={() => setShowPhaseInfo(!showPhaseInfo)} className="text-xs text-gray-400 hover:text-brand-600 transition-colors flex items-center gap-1">
              {showPhaseInfo ? "▲ Ocultar" : "▼ Instrucciones"}
            </button>
          </div>
          {showPhaseInfo && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 animate-slide-down">
            Las fases ajustan automáticamente los macros según la etapa de preparación. Al seleccionar una fase, los valores de proteína/carbos/grasas se recalcularán al crear un plan o guardar una medición.
            <br/><br/>
            <strong>Offseason</strong> — Volumen: proteína 2.0g/kg, carbos altos (120%), grasas moderadas. Para construcción muscular fuera de competencia.
            <br/>
            <strong>Precontest</strong> — Definición: proteína 2.4g/kg, carbos reducidos (70%), grasas controladas. Para pérdida de grasa manteniendo músculo.
            <br/>
            <strong>Transición</strong> — Post-competencia: proteína 2.0g/kg, carbos normales (100%), grasas moderadas. Para reestabilización después del show.
            <br/><br/>
            La tabla "Macros ajustados por fase" muestra el delta vs tus macros actuales. Usa "Aplicar cambios" para actualizar los macros en el grid.
          </p>
          )}
          <div className="flex flex-wrap gap-2 mb-4">
            {(["offseason", "precontest", "transition"] as CompetitionPhase[]).map((p) => (
              <button key={p} onClick={() => {
                setSelectedPhase(selectedPhase === p ? undefined : p);
              }}
                className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                  selectedPhase === p ? `${getPhaseColor(p)} border-current` : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                }`}>
                {getPhaseLabel(p)}
              </button>
            ))}
          </div>
          {selectedPhase && (
            <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <p className="text-lg font-bold dark:text-white">{selectedPhase === "offseason" ? "2.0" : "2.4"}g</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">Proteína/kg</p>
              </div>
              <div className="text-center p-3 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <p className="text-lg font-bold dark:text-white">{(selectedPhase === "offseason" ? 1.2 : 0.7) * 100}%</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">Carbos base</p>
              </div>
            </div>
            {latest && (() => {
              const phaseMacros = calculatePhaseMacros({ tmb: latest.tmb, tdee: latest.tdee, protein: latest.protein, carbs: latest.carbs, fat: latest.fat, fiber: latest.fiber, antioxidants: latest.antioxidants }, latest.weight, selectedPhase);
              return (
              <div className="mt-4 text-xs animate-slide-up">
                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Macros ajustados por fase</p>
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-2 py-1">Macro</th>
                      <th className="text-right px-2 py-1">Original</th>
                      <th className="text-right px-2 py-1">Fase</th>
                      <th className="text-right px-2 py-1">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["protein","carbs","fat"] as const).map((k) => {
                      const orig = latest[k];
                      const adj = phaseMacros[k];
                      const diff = adj - orig;
                      const accent = k === "protein" ? "text-red-500" : k === "carbs" ? "text-amber-500" : "text-blue-500";
                      return (
                        <tr key={k}>
                          <td className={`px-2 py-1 font-medium ${accent}`}>{k === "protein" ? "Proteína" : k === "carbs" ? "Carbos" : "Grasas"}</td>
                          <td className="text-right px-2 py-1 text-gray-600 dark:text-gray-400">{orig}g</td>
                          <td className="text-right px-2 py-1 text-gray-600 dark:text-gray-400">{adj}g</td>
                          <td className={`text-right px-2 py-1 font-medium ${diff === 0 ? "text-gray-400" : diff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                            {diff > 0 ? "+" : ""}{diff}g
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-2 py-1 font-medium text-gray-800 dark:text-gray-200">Total kcal</td>
                      <td className="text-right px-2 py-1 font-semibold text-gray-800 dark:text-gray-200">{latest.tdee}</td>
                      <td className="text-right px-2 py-1 font-semibold text-gray-800 dark:text-gray-200">{phaseMacros.tdee}</td>
                      <td className="text-right px-2 py-1 font-medium text-emerald-600 dark:text-emerald-400">0</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              );
            })()}
            {latest && selectedPhase && (() => {
              const phaseMacros = calculatePhaseMacros({ tmb: latest.tmb, tdee: latest.tdee, protein: latest.protein, carbs: latest.carbs, fat: latest.fat, fiber: latest.fiber, antioxidants: latest.antioxidants }, latest.weight, selectedPhase);
              return (
                <button onClick={() => { setEditResult({ ...phaseMacros }); setChangedFields(new Set(["protein", "carbs", "fat", "fiber"])); }}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold bg-brand-600 text-white hover:bg-brand-700 active:scale-[0.98] transition-all shadow-sm">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7"/></svg>
                  Aplicar cambios
                </button>
              );
            })()}
            </>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            {selectedPhase !== "peak_week" && (
              <button onClick={() => { setEditingCompetition(undefined); setCompEditorData({ date: new Date().toISOString().slice(0, 10), name: `Competencia ${new Date().toLocaleDateString("es-MX")}`, category: "", weight: "", placement: "", config: [] }); setShowCompetitionForm(true); }} className="text-xs text-brand-600 hover:underline">+ Agregar competencia</button>
            )}
            {measurements.length > 0 && (
              <button onClick={() => {
                const csv = measurementsToCSV(client, measurements);
                downloadCSV(`${client.name.replace(/\s+/g, "_")}_mediciones.csv`, csv);
              }} className="text-xs text-gray-500 hover:underline flex items-center gap-1">
                <Download className="w-3 h-3" /> Exportar CSV
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm" key={`weight-${checkinVersion}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 dark:from-blue-500 dark:to-blue-700 flex items-center justify-center shadow-sm">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Peso</p>
              <div className="flex items-center gap-1.5 mt-0.5 transition-all duration-500 ease-out">
                {(() => {
                  const prev = checkins[1]?.weight;
                  const curr = checkins[0]?.weight;
                  if (!curr) return <span className="text-xl font-bold dark:text-white">{trend.currentWeight}<span className="text-sm font-medium text-gray-400 ml-0.5">kg</span></span>;
                  if (!prev || prev === curr) return <span className="text-xl font-bold dark:text-white">{curr}<span className="text-sm font-medium text-gray-400 ml-0.5">kg</span></span>;
                  return (
                    <>
                      <span className="text-sm text-gray-400 dark:text-gray-500">{prev}<span className="text-sm font-medium ml-0.5">kg</span></span>
                      <span className="text-gray-300 dark:text-gray-600 text-xs">→</span>
                      <span className="text-xl font-bold dark:text-white">{curr}<span className="text-sm font-medium text-gray-400 ml-0.5">kg</span></span>
                    </>
                  );
                })()}
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">Prom 7d: {trend.rollingAverage7 ?? "—"} kg · {getRateLabel(trend.weeklyChangePercent)}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm" key={`bf-${checkinVersion}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 dark:from-emerald-500 dark:to-emerald-700 flex items-center justify-center shadow-sm">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Composición</p>
              {(() => {
                const prev = checkins[1]?.body_fat;
                const curr = checkins[0]?.body_fat;
                if (!curr) return <p className="text-sm text-gray-400 mt-1">Sin datos</p>;
                if (!prev || prev === curr) return <span className="text-xl font-bold dark:text-white">{curr}<span className="text-sm font-medium text-gray-400 ml-0.5">% BF</span></span>;
                return (
                  <div className="flex items-center gap-1.5 transition-all duration-500 ease-out">
                    <span className="text-sm text-gray-400 dark:text-gray-500">{prev}<span className="text-sm font-medium ml-0.5">% BF</span></span>
                    <span className="text-gray-300 dark:text-gray-600 text-xs">→</span>
                    <span className="text-xl font-bold dark:text-white">{curr}<span className="text-sm font-medium text-gray-400 ml-0.5">% BF</span></span>
                  </div>
                );
              })()}
              {latest?.body_fat && (
                  <p className="text-[11px] text-gray-400 mt-0.5">FFMI: {calculateFFMI(latest.weight, latest.height, latest.body_fat)} · MML: {calculateLeanBodyMass(latest.weight, latest.body_fat)} kg</p>
                )}
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 dark:from-purple-500 dark:to-purple-700 flex items-center justify-center shadow-sm">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Planes</p>
              <p className="text-xl font-bold dark:text-white">{plans.length}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{checkins.length} check-ins · {competitions.length} competencias</p>
            </div>
          </div>
        </div>
      </div>

      {suggestion && (
        <div className={`mb-6 p-4 rounded-xl border text-sm ${
          suggestion.action === "mantener"
            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
            : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400"
        }`}>
          <p className="font-semibold mb-1">Ajuste sugerido — {selectedPhase ? getPhaseLabel(selectedPhase) : "Fase actual"}</p>
          <p>{suggestion.reason}</p>
          {(suggestion.carbChange !== 0 || suggestion.fatChange !== 0) && (
            <p className="text-xs mt-1">Ajuste: {suggestion.carbChange > 0 ? "+" : ""}{suggestion.carbChange}g carbos · {suggestion.fatChange > 0 ? "+" : ""}{suggestion.fatChange}g grasas</p>
          )}
        </div>
      )}

      {latest && (
        <div className="mb-4 animate-slide-down">
          {!editResult && (
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
              Últimos macros • {latest.date.slice(0, 10)}
            </p>
          )}
          <div className="grid grid-cols-5 gap-3">
            <div className="text-center p-3 rounded-xl border shadow-sm stagger-1" style={{ borderColor: "#0ea5e944", background: "linear-gradient(to bottom, #0ea5e930, #0ea5e915)" }}>
              <p className="text-[9px] font-semibold mb-1 uppercase tracking-wide" style={{ color: "#0ea5e9" }}>Calorías</p>
              {editResult ? (
                <input type="number" value={editResult.tdee}
                  onChange={(e) => { const raw = e.target.value; if (raw === "") return; handleEditMacro("tdee", Number(raw)); }}
                  className="w-20 mx-auto text-center text-lg font-bold bg-transparent border-b-2 border-gray-300 dark:border-gray-600 focus:outline-none dark:text-gray-100"
                  style={{ color: "#0ea5e9" }} />
              ) : (
                <p className="text-xl font-bold" style={{ color: "#0ea5e9" }}>{latest.tdee}</p>
              )}
              <p className="text-[10px] text-gray-400 dark:text-gray-500">kcal</p>
            </div>
            {(["protein","carbs","fat","fiber"] as const).map((k, i) => {
              const val = editResult ? editResult[k] : latest[k];
              const accent = k === "protein" ? "#f87171" : k === "carbs" ? "#fbbf24" : k === "fat" ? "#60a5fa" : "#a78bfa";
              const changed = changedFields.has(k);
              return (
                <div key={k} className={`text-center p-3 rounded-xl border shadow-sm transition-all duration-300 stagger-${Math.min(i + 2, 5)}`} style={{ borderColor: accent + "44", background: `linear-gradient(to bottom, ${accent}40, ${accent}18)` }}>
                  <p className="text-[9px] font-semibold mb-1 capitalize tracking-wide" style={{ color: accent }}>{k === "protein" ? "Proteína" : k === "carbs" ? "Carbos" : k === "fat" ? "Grasas" : "Fibra"}</p>
                  {editResult ? (
                    <input type="number" value={editResult[k]}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") return;
                        const v = Number(raw);
                        if (k === "fiber") {
                          setEditResult({ ...editResult, fiber: v });
                        } else {
                          handleEditMacro(k, v);
                        }
                      }}
                      className={`w-16 mx-auto text-center text-lg font-bold bg-transparent border-b-2 focus:outline-none dark:text-gray-100 transition-all duration-300 ${changed ? "ring-2 ring-offset-1" : ""}`}
                      style={{ borderColor: accent + "88", color: accent, ...(changed ? { ringColor: accent } : {}) }} />
                  ) : (
                    <p className="text-lg font-bold" style={{ color: accent }}>{val}</p>
                  )}
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">g</p>
                </div>
              );
            })}
          </div>
          {!editResult && (
            <button onClick={() => { setEditResult({ ...latest }); setChangedFields(new Set()); }}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-all shadow-sm animate-scale-in">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Editar macros
            </button>
          )}
          {editResult && (
            <div className="animate-scale-in">
              {changedFields.size > 0 && (
                <div className="mt-3 text-[11px] animate-slide-up">
                  <table className="w-full max-w-md mx-auto">
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
                        const orig = latest[k];
                        const adj = editResult[k];
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
                        <td className="text-right px-2 py-1 font-semibold text-gray-800 dark:text-gray-200">{latest.tdee}</td>
                        <td className="text-right px-2 py-1 font-semibold text-gray-800 dark:text-gray-200">{editResult.tdee}</td>
                        <td className={`text-right px-2 py-1 font-medium ${editResult.tdee === latest.tdee ? "text-gray-400" : editResult.tdee > latest.tdee ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                          {editResult.tdee > latest.tdee ? "+" : ""}{editResult.tdee - latest.tdee}
                        </td>
                      </tr>
                    {(() => {
                      const actual = editResult.protein * 4 + editResult.carbs * 4 + editResult.fat * 9;
                      const diff = actual - editResult.tdee;
                      if (Math.abs(diff) <= 5) return null;
                      return (
                        <tr className="border-t border-gray-200 dark:border-gray-700">
                          <td className={`px-2 py-1 font-medium text-${diff > 0 ? "amber" : "blue"}-600 dark:text-${diff > 0 ? "amber" : "blue"}-400`}>
                            {diff > 0 ? "Sobran" : "Faltan"}
                          </td>
                          <td className="text-right px-2 py-1 text-gray-600 dark:text-gray-400">—</td>
                          <td className={`text-right px-2 py-1 font-medium text-${diff > 0 ? "amber" : "blue"}-600 dark:text-${diff > 0 ? "amber" : "blue"}-400`}>
                            {actual} kcal
                          </td>
                          <td className={`text-right px-2 py-1 font-medium text-${diff > 0 ? "amber" : "blue"}-600 dark:text-${diff > 0 ? "amber" : "blue"}-400`}>
                            {diff > 0 ? "+" : ""}{diff} kcal
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                  </table>
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <button onClick={() => {
                  const m = editResult;
                  db.updateMeasurement(latest.id, {
                    tmb: m.tmb, tdee: m.tdee, protein: m.protein, carbs: m.carbs,
                    fat: m.fat, fiber: m.fiber, antioxidants: m.antioxidants,
                  });
                  setCheckinVersion((v) => v + 1);
                  setEditResult(null);
                  setChangedFields(new Set());
                }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold bg-brand-600 text-white hover:bg-brand-700 active:scale-[0.98] transition-all shadow-sm">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  Guardar macros
                </button>
                <button onClick={resetMacros}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm">
                  Restaurar
                </button>
                <button onClick={() => { setEditResult(null); setChangedFields(new Set()); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 mb-8 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2 dark:text-white">
            <TrendingUp className="w-4 h-4 text-brand-600" /> Calculadora de Macros
          </h3>
          <button onClick={() => setShowCalc(!showCalc)}
            className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors flex items-center gap-1">
            {showCalc ? "▲ Ocultar" : "▼ Nuevo cálculo"}
          </button>
        </div>

        {showCalc && (
          <div className="p-5 space-y-5">
            <p className="text-[10px] text-gray-400 dark:text-gray-500">Los campos con <span className="text-red-400">*</span> son obligatorios</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Peso <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input type="number" className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 dark:focus:border-brand-400 transition-all" value={calcForm.weight} onChange={(e) => setCalcForm({ ...calcForm, weight: e.target.value })} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-400 dark:text-gray-600 pointer-events-none">kg</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Altura <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input type="number" className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 dark:focus:border-brand-400 transition-all" value={calcForm.height} onChange={(e) => setCalcForm({ ...calcForm, height: e.target.value })} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-400 dark:text-gray-600 pointer-events-none">cm</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Edad <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input type="number" className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 dark:focus:border-brand-400 transition-all" value={calcForm.age} onChange={(e) => setCalcForm({ ...calcForm, age: e.target.value })} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-400 dark:text-gray-600 pointer-events-none">años</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Sexo</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setCalcForm({ ...calcForm, sex: "male" })}
                    className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-all ${calcForm.sex === "male" ? "bg-brand-600 text-white border-brand-600 shadow-sm" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"}`}>Hombre</button>
                  <button type="button" onClick={() => setCalcForm({ ...calcForm, sex: "female" })}
                    className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-all ${calcForm.sex === "female" ? "bg-brand-600 text-white border-brand-600 shadow-sm" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"}`}>Mujer</button>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Composición corporal</p>
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={() => setCalcForm({ ...calcForm, bfMethod: "direct" })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${calcForm.bfMethod === "direct" ? "bg-brand-600 text-white border-brand-600 shadow-sm" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400"}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" /> % Directo
                </button>
                <button type="button" onClick={() => setCalcForm({ ...calcForm, bfMethod: "isak1" })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${calcForm.bfMethod === "isak1" ? "bg-brand-600 text-white border-brand-600 shadow-sm" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400"}`}>
                  <Ruler className="w-3 h-3" /> ISAK 1
                </button>
              </div>
              {calcForm.bfMethod === "direct" ? (
                <div className="relative max-w-[200px]">
                  <input type="number" placeholder="Ej: 15" className="w-full px-3 py-2 pr-14 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all" value={calcForm.bodyFat} onChange={(e) => setCalcForm({ ...calcForm, bodyFat: e.target.value })} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-400 dark:text-gray-600 pointer-events-none">%</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Pectoral</label>
                      <div className="relative">
                        <input type="number" placeholder="mm" className="w-full px-2.5 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all" value={calcForm.chest} onChange={(e) => setCalcForm({ ...calcForm, chest: e.target.value })} />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-600 pointer-events-none">mm</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Subescapular</label>
                      <div className="relative">
                        <input type="number" placeholder="mm" className="w-full px-2.5 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all" value={calcForm.subscapular} onChange={(e) => setCalcForm({ ...calcForm, subscapular: e.target.value })} />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-600 pointer-events-none">mm</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Bíceps</label>
                      <div className="relative">
                        <input type="number" placeholder="mm" className="w-full px-2.5 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all" value={calcForm.biceps} onChange={(e) => setCalcForm({ ...calcForm, biceps: e.target.value })} />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-600 pointer-events-none">mm</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Tríceps</label>
                      <div className="relative">
                        <input type="number" placeholder="mm" className="w-full px-2.5 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all" value={calcForm.triceps} onChange={(e) => setCalcForm({ ...calcForm, triceps: e.target.value })} />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-600 pointer-events-none">mm</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Cresta ilíaca</label>
                      <div className="relative">
                        <input type="number" placeholder="mm" className="w-full px-2.5 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all" value={calcForm.suprailiac} onChange={(e) => setCalcForm({ ...calcForm, suprailiac: e.target.value })} />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-600 pointer-events-none">mm</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Supraspinal</label>
                      <div className="relative">
                        <input type="number" placeholder="mm" className="w-full px-2.5 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all" value={calcForm.supraspinale} onChange={(e) => setCalcForm({ ...calcForm, supraspinale: e.target.value })} />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-600 pointer-events-none">mm</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Abdominal</label>
                      <div className="relative">
                        <input type="number" placeholder="mm" className="w-full px-2.5 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all" value={calcForm.abdominal} onChange={(e) => setCalcForm({ ...calcForm, abdominal: e.target.value })} />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-600 pointer-events-none">mm</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Muslo anterior</label>
                      <div className="relative">
                        <input type="number" placeholder="mm" className="w-full px-2.5 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all" value={calcForm.thigh} onChange={(e) => setCalcForm({ ...calcForm, thigh: e.target.value })} />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-600 pointer-events-none">mm</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Pierna medial</label>
                      <div className="relative">
                        <input type="number" placeholder="mm" className="w-full px-2.5 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all" value={calcForm.medialCalf} onChange={(e) => setCalcForm({ ...calcForm, medialCalf: e.target.value })} />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-600 pointer-events-none">mm</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Perímetros (cm)</p>
                    <div className="grid grid-cols-5 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Brazo relajado</label>
                        <div className="relative">
                          <input type="number" placeholder="cm" className="w-full px-2.5 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all" value={calcForm.armRelaxed} onChange={(e) => setCalcForm({ ...calcForm, armRelaxed: e.target.value })} />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-600 pointer-events-none">cm</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Brazo flexionado</label>
                        <div className="relative">
                          <input type="number" placeholder="cm" className="w-full px-2.5 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all" value={calcForm.armFlexed} onChange={(e) => setCalcForm({ ...calcForm, armFlexed: e.target.value })} />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-600 pointer-events-none">cm</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Cintura</label>
                        <div className="relative">
                          <input type="number" placeholder="cm" className="w-full px-2.5 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all" value={calcForm.waist} onChange={(e) => setCalcForm({ ...calcForm, waist: e.target.value })} />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-600 pointer-events-none">cm</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Cadera</label>
                        <div className="relative">
                          <input type="number" placeholder="cm" className="w-full px-2.5 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all" value={calcForm.hip} onChange={(e) => setCalcForm({ ...calcForm, hip: e.target.value })} />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-600 pointer-events-none">cm</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Pantorrilla max</label>
                        <div className="relative">
                          <input type="number" placeholder="cm" className="w-full px-2.5 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all" value={calcForm.calfMax} onChange={(e) => setCalcForm({ ...calcForm, calfMax: e.target.value })} />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-600 pointer-events-none">cm</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Diámetros óseos (cm)</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Húmero (codo)</label>
                        <div className="relative">
                          <input type="number" placeholder="cm" className="w-full px-2.5 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all" value={calcForm.humerus} onChange={(e) => setCalcForm({ ...calcForm, humerus: e.target.value })} />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-600 pointer-events-none">cm</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Fémur (rodilla)</label>
                        <div className="relative">
                          <input type="number" placeholder="cm" className="w-full px-2.5 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all" value={calcForm.femur} onChange={(e) => setCalcForm({ ...calcForm, femur: e.target.value })} />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-600 pointer-events-none">cm</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">Talla sentado</label>
                        <div className="relative">
                          <input type="number" placeholder="cm" className="w-full px-2.5 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all" value={calcForm.sittingHeight} onChange={(e) => setCalcForm({ ...calcForm, sittingHeight: e.target.value })} />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-600 pointer-events-none">cm</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Actividad</label>
                <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all" value={calcForm.activityLevel} onChange={(e) => setCalcForm({ ...calcForm, activityLevel: e.target.value as ActivityLevel })}>
                  <option value="sedentary">Sedentario</option>
                  <option value="light">Ligero</option>
                  <option value="moderate">Moderado</option>
                  <option value="active">Activo</option>
                  <option value="very_active">Muy activo</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Objetivo</label>
                <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all" value={calcForm.goal} onChange={(e) => setCalcForm({ ...calcForm, goal: e.target.value as Goal })}>
                  <option value="lose_fat">Perder grasa — Déficit</option>
                  <option value="maintain">Mantener peso</option>
                  <option value="build_muscle">Ganar músculo — Volumen</option>
                  <option value="gain_weight">Subir de peso — Aumento</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              {selectedPhase && (
                <label className="flex items-center gap-2 text-[12px] text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                  <input type="checkbox" checked={calcForm.usePhase} onChange={(e) => setCalcForm({ ...calcForm, usePhase: e.target.checked })}
                    className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500/30" />
                  Ajuste de fase ({getPhaseLabel(selectedPhase)})
                </label>
              )}
              <label className="flex items-center gap-2 text-[12px] text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                <input type="checkbox" checked={calcForm.hasWorkout} onChange={(e) => setCalcForm({ ...calcForm, hasWorkout: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500/30" />
                Pre/intra/post entrenamiento
              </label>
            </div>

            {calcError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
                {calcError}
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-1">
              <button onClick={handleCalc}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 active:scale-[0.98] transition-all shadow-sm">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3h6v6H9zM15 15h6v6h-6zM3 15h6v6H3zM3 3h6v6H3z"/></svg>
                Calcular Macros
              </button>
              {result && (
                <button onClick={() => handleCreatePlan()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 active:scale-[0.98] transition-all shadow-sm animate-scale-in">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                  Crear Plan de Comidas
                </button>
              )}
              <button onClick={handleLoadTemplate}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-[0.98] transition-all">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Cargar Plantilla
              </button>
            </div>
          </div>
        )}

        {showCalc && editResult && (
          <div className="px-5 pb-5 pt-4 border-t border-gray-100 dark:border-gray-800 animate-slide-down">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Resultado</p>
            <div className="grid grid-cols-5 gap-3">
              <div className="text-center p-3 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm stagger-1">
                <p className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Calorías</p>
                <input type="number" value={editResult.tdee}
                  onChange={(e) => { const raw = e.target.value; if (raw === "") return; handleEditMacro("tdee", Number(raw)); }}
                  className="w-20 mx-auto text-center text-lg font-bold bg-transparent border-b-2 border-gray-300 dark:border-gray-600 focus:outline-none dark:text-gray-100" />
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">kcal</p>
              </div>
              {(["protein","carbs","fat","fiber"] as const).map((k, i) => {
                const accent = k === "protein" ? "#f87171" : k === "carbs" ? "#fbbf24" : k === "fat" ? "#60a5fa" : "#a78bfa";
                const changed = changedFields.has(k);
                return (
                <div key={k} className={`text-center p-3 rounded-xl border shadow-sm transition-all duration-300 stagger-${Math.min(i + 2, 5)}`} style={{ borderColor: accent + "44", background: `linear-gradient(to bottom, ${accent}40, ${accent}18)` }}>
                    <p className="text-[9px] font-semibold mb-1 capitalize tracking-wide" style={{ color: accent }}>{k === "protein" ? "Proteína" : k === "carbs" ? "Carbos" : k === "fat" ? "Grasas" : "Fibra"}</p>
                    <input type="number" value={editResult[k]}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") return;
                        const v = Number(raw);
                        if (k === "fiber") {
                          setEditResult({ ...editResult, fiber: v });
                        } else {
                          handleEditMacro(k, v);
                        }
                      }}
                      className={`w-16 mx-auto text-center text-lg font-bold bg-transparent border-b-2 focus:outline-none dark:text-gray-100 transition-all duration-300 ${changed ? "ring-2 ring-offset-1" : ""}`}
                      style={{ borderColor: accent + "88", color: accent, ...(changed ? { ringColor: accent } : {}) }} />
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">g</p>
                  </div>
                );
              })}
            </div>
            {changedFields.size > 0 && result && (
              <div className="mt-3 text-[11px] animate-slide-up">
                <table className="w-full max-w-md mx-auto">
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
                      const orig = result[k];
                      const adj = editResult[k];
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
                      <td className="text-right px-2 py-1 font-semibold text-gray-800 dark:text-gray-200">{result.tdee}</td>
                      <td className="text-right px-2 py-1 font-semibold text-gray-800 dark:text-gray-200">{editResult.tdee}</td>
                      <td className={`text-right px-2 py-1 font-medium ${editResult.tdee === result.tdee ? "text-gray-400" : editResult.tdee > result.tdee ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                        {editResult.tdee > result.tdee ? "+" : ""}{editResult.tdee - result.tdee}
                      </td>
                    </tr>
                    {(() => {
                      const actual = editResult.protein * 4 + editResult.carbs * 4 + editResult.fat * 9;
                      const diff = actual - editResult.tdee;
                      if (Math.abs(diff) <= 5) return null;
                      return (
                        <tr className="border-t border-gray-200 dark:border-gray-700">
                          <td className={`px-2 py-1 font-medium text-${diff > 0 ? "amber" : "blue"}-600 dark:text-${diff > 0 ? "amber" : "blue"}-400`}>
                            {diff > 0 ? "Sobran" : "Faltan"}
                          </td>
                          <td className="text-right px-2 py-1 text-gray-600 dark:text-gray-400">—</td>
                          <td className={`text-right px-2 py-1 font-medium text-${diff > 0 ? "amber" : "blue"}-600 dark:text-${diff > 0 ? "amber" : "blue"}-400`}>
                            {actual} kcal
                          </td>
                          <td className={`text-right px-2 py-1 font-medium text-${diff > 0 ? "amber" : "blue"}-600 dark:text-${diff > 0 ? "amber" : "blue"}-400`}>
                            {diff > 0 ? "+" : ""}{diff} kcal
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            )}
            {changedFields.size > 0 && result && (
              <button onClick={resetMacros}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-all shadow-sm animate-scale-in">
                Restaurar macros originales
              </button>
            )}
          </div>
        )}

      </div>

      {weightChart.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10 mt-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold dark:text-white text-sm">Historial de Peso</h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weightChart}>
                <CartesianGrid strokeDasharray="4 4" stroke="#d1d5db" /><XAxis dataKey="date" fontSize={12} tickLine={false} stroke="#9ca3af" /><YAxis fontSize={12} tickLine={false} stroke="#9ca3af" /><Tooltip />
                <Line type="monotone" dataKey="weight" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4 }} name="Peso (kg)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {weightChart.some((m) => m.bodyFat) && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="font-semibold dark:text-white text-sm">Historial de % Grasa</h3>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weightChart}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#d1d5db" /><XAxis dataKey="date" fontSize={12} tickLine={false} /><YAxis fontSize={12} tickLine={false} domain={["auto", "auto"]} /><Tooltip />
                  <Line type="monotone" dataKey="bodyFat" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="% Grasa" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <CheckInHistory key={checkinVersion} clientId={clientId} phase={selectedPhase} onEdit={(c) => { setEditingCheckin(c); setShowCheckin(true); }} onDelete={(id) => { db.deleteCheckIn(id); setCheckinVersion((v) => v + 1); }} />
        {selectedPhase === "peak_week" ? (
          <PeakWeekSimulator clientId={clientId} competition={competitions[0]} latestMacros={latest ? { tmb: latest.tmb, tdee: latest.tdee, protein: latest.protein, carbs: latest.carbs, fat: latest.fat, fiber: latest.fiber, antioxidants: latest.antioxidants } : undefined} />
        ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-4 dark:text-white"><Award className="w-4 h-4 text-orange-600" /> Competencias</h3>
          {competitions.length === 0 ? (
            <p className="text-sm text-gray-400">Sin competencias registradas</p>
          ) : competitions.map((c) => {
            const daysLeft = Math.round((new Date(c.date).getTime() - now) / 86400000);
            const weeksLeft = Math.max(0, Math.round(daysLeft / 7));
            const isPast = daysLeft < 0;
            return (
              <div key={c.id} className="p-4 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow mb-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold dark:text-white flex items-center gap-2">
                    <Award className="w-3.5 h-3.5 text-orange-500" />
                    {c.name}
                  </p>
                  {!isPast && <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full">{weeksLeft} semanas</span>}
                  {isPast && <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">Finalizada</span>}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  <span className="inline-flex items-center gap-1"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>                   {c.date.slice(0, 10)}</span>
                  {c.placement && <span className="ml-2 inline-flex items-center gap-1"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg> #{c.placement}</span>}
                  {c.weight && <span className="ml-2 inline-flex items-center gap-1"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18M3 12h18"/></svg> {c.weight} kg</span>}
                </p>
                {!isPast && weeksLeft > 0 && (
                  <div className="mt-3">
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all" style={{ width: `${Math.min(100, (1 - weeksLeft / 24) * 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Preparación ideal: 16-24 sem • {weeksLeft} semanas restantes</p>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  {!isPast && weeksLeft > 0 && (
                    <button onClick={() => generatePrepPlan(c)} className="text-[11px] font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                      + Generar plan de preparación
                    </button>
                  )}
                  <button onClick={() => {
                    setEditingCompetition(c);
                    const config = c.peak_week_config ? JSON.parse(c.peak_week_config) as PeakWeekDayConfig[] : [];
                    setCompEditorData({
                      name: c.name,
                      date: new Date(c.date).toISOString().slice(0, 10),
                      category: c.category || "",
                      weight: c.weight ? String(c.weight) : "",
                      placement: c.placement ? String(c.placement) : "",
                      config,
                    });
                    setShowCompetitionForm(true);
                  }} className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ml-auto">Editar</button>
                  <button onClick={() => handleDeleteCompetition(c.id)} className="text-[11px] text-red-300 dark:text-red-500/60 hover:text-red-500 dark:hover:text-red-400 transition-colors">Eliminar</button>
                </div>
              </div>
            );
          })}
          <button onClick={() => { setEditingCompetition(undefined); setCompEditorData({ date: new Date().toISOString().slice(0, 10), name: `Competencia ${new Date().toLocaleDateString("es-MX")}`, category: "", weight: "", placement: "", config: [] }); setShowCompetitionForm(true); }} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors mt-2">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            Agregar competencia
          </button>
        </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            </div>
            <h3 className="font-semibold text-sm dark:text-white">Planes Anteriores</h3>
          </div>
          {plans.length > 0 && <button onClick={handleDeleteAllPlans} className="text-[11px] text-red-400 hover:text-red-500 transition-colors">Eliminar todos</button>}
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {plans.map((p) => {
            const isRestDay = p.name.includes("Rest Day");
            return (
            <div key={p.id} className={`px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${isRestDay ? "bg-indigo-50/50 dark:bg-indigo-950/20" : ""}`}>
              <div>
                <p className="text-sm font-medium dark:text-white flex items-center gap-2">
                  {p.name}
                  {isRestDay && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400"><Moon className="w-2.5 h-2.5" /> Rest</span>}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  <span className="font-medium text-gray-600 dark:text-gray-400">{p.total_kcal} kcal</span>
                  <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
                  <span className="text-red-500">P:{p.total_protein}g</span>
                  <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
                  <span className="text-amber-500">C:{p.total_carbs}g</span>
                  <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
                  <span className="text-blue-500">G:{p.total_fat}g</span>
                </p>
              </div>
              <div className="flex gap-1 items-center">
                <button onClick={() => navigate(`/plans/${p.id}`)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors">Ver</button>
                <button onClick={() => handleExportPDF(p.id)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">PDF</button>
                <button onClick={() => handleDeletePlan(p.id)} className="p-1.5 rounded-lg text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
            );
          })}
          {plans.length === 0 && <p className="p-6 text-sm text-gray-400 text-center">Aún no hay planes. Calcula macros y crea el primer plan.</p>}
        </div>
      </div>

      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowTemplates(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4 dark:text-white">Cargar Plantilla</h3>
            {templates.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No hay plantillas guardadas. Crea una desde el plan de comidas.</p>}
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 mb-2">
                <div><p className="font-medium text-sm dark:text-white">{t.name}</p><p className="text-xs text-gray-500">{t.items.length} alimentos · {Math.round(t.total_kcal)} kcal</p></div>
                <button onClick={() => handleApplyTemplate(t)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors">Usar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCheckin && (
        <CheckInForm clientId={clientId} existing={editingCheckin} onSave={() => { setShowCheckin(false); setEditingCheckin(undefined); setCheckinVersion((v) => v + 1); }} onCancel={() => { setShowCheckin(false); setEditingCheckin(undefined); }} />
      )}

      {showCompetitionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowCompetitionForm(false); setEditingCompetition(undefined); setCompEditorData(null); }}>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4 dark:text-white">{compEditorData?.name || (editingCompetition ? "Editar Competencia" : "Nueva Competencia")}</h3>

            <CompetitionPeakWeekEditor
              key={editingCompetition?.id || "new"}
              competitionDate={compEditorData?.date || new Date().toISOString().slice(0, 10)}
              competitionName={compEditorData?.name}
              competitionCategory={compEditorData?.category}
              competitionWeight={compEditorData?.weight}
              competitionPlacement={compEditorData?.placement}
              initialConfig={compEditorData?.config}
              baseMacros={latest ? { protein: latest.protein, carbs: latest.carbs, fat: latest.fat, tdee: latest.tdee } : undefined}
              onChange={(data) => setCompEditorData(data)}
            />

            <div className="flex gap-3 mt-6">
              <button onClick={() => {
                if (!compEditorData || !compEditorData.name) return;
                if (editingCompetition) {
                  db.deleteCompetition(editingCompetition.id);
                }
                db.saveCompetition({
                  client_id: clientId, name: compEditorData.name, date: new Date(compEditorData.date).toISOString(),
                  category: compEditorData.category || undefined, weight: compEditorData.weight ? Number(compEditorData.weight) : undefined,
                  placement: compEditorData.placement ? Number(compEditorData.placement) : undefined,
                  peak_week_config: JSON.stringify(compEditorData.config),
                });
                setCompetitions(db.getCompetitions(clientId));
                setShowCompetitionForm(false);
                setEditingCompetition(undefined);
              }} className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors">Guardar</button>
              <button onClick={() => { setShowCompetitionForm(false); setEditingCompetition(undefined); setCompEditorData(null); }} className="px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!deleteConfirm}
        title="Eliminar plan"
        message="¿Eliminar este plan de dieta?"
        onConfirm={confirmDeletePlan}
        onCancel={() => setDeleteConfirm(null)}
      />
      <ConfirmDialog
        open={deleteAllConfirm}
        title="Eliminar todos los planes"
        message={`¿Eliminar TODOS los ${plans.length} planes de dieta?`}
        onConfirm={confirmDeleteAllPlans}
        onCancel={() => setDeleteAllConfirm(false)}
      />
    </div>
  );
}

