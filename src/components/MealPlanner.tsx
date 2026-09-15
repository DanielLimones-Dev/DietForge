"use client";
import {subscribeStorage} from "@/lib/db";

import { getPreference, setPreference } from "@/lib/db";
import { useEffect, useState, useMemo, useRef, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Plus, Scale, X, Target, Globe, Moon, PieChart, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { itemsForDay, mealTotals, convertQuantity, restReduction, restTargets, foodRatio as getRatio } from "@/lib/meal-day";
import { generateDietPDF } from "@/lib/pdf";
import { searchFatSecret, classifyCarbs } from "@/lib/nutrition";
import type { Food, MealPlan, MealPlanItem, MealTime } from "@/types";
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

const CARB_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  fast: { label: "Rápido", color: "text-orange-600 bg-orange-100" },
  slow: { label: "Lento", color: "text-green-600 bg-green-100" },
  mixed: { label: "Mixto", color: "text-yellow-600 bg-yellow-100" },
};

// Keep the exiting Rest Day column mounted until the visual merge finishes.
// This duration must match the layout transition in src/index.css.
const REST_DAY_LAYOUT_MS = 1050;

export function MealPlanner(){const {id}=useParams<{id?:string}>();return <MealPlannerFields key={id}/>;}

function MealPlannerFields() {
  const { id } = useParams<{ id?: string }>();
  const router = useRouter();
  const planId = Number(id);

  const [plan, setPlan] = useState(() => db.getMealPlan(planId));
  const [client] = useState(() => db.getClient(plan?.plan.client_id || 0));
  const [foods, setFoods] = useState<Food[]>(() => db.getFoods());
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editItemQty, setEditItemQty] = useState(0);
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);
  const [targetColumn, setTargetColumn] = useState<"left" | "right">("left");
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [foodQuantity, setFoodQuantity] = useState(100);
  const [foodUnit, setFoodUnit] = useState("g");
  const [apiResults, setApiResults] = useState<Food[]>([]);
  const [removeItemId, setRemoveItemId] = useState<number | null>(null);
  const [showTemplatePrompt, setShowTemplatePrompt] = useState(false);
  const [sections, setSections] = useState<{normal:string[];rest:string[]}>(() => readSections(planId));
  const [newSection, setNewSection] = useState<{day:"normal"|"rest";key:string}|null>(null);
  const [addSectionMotion, setAddSectionMotion] = useState<"normal"|"rest"|null>(null);
  const [removingSection, setRemovingSection] = useState<{day:"normal"|"rest";key:string}|null>(null);
  const [removeSection, setRemoveSection] = useState<{key:string;rest:boolean}|null>(null);
  const [reduction,setReduction] = useState(()=>restReduction(getPreference(`rd_percent_${planId}`)));
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [restDay, setRestDay] = useState(() => getPreference(`rd_${planId}`) === "true");
  const [restDayLayout, setRestDayLayout] = useState(restDay);
  const [restDayMotion, setRestDayMotion] = useState<"on"|"off"|null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const restDayLayoutTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [, setTick] = useState(0);

  useEffect(() => subscribeStorage(()=>setPlan(db.getMealPlan(planId))),[planId]);

  useEffect(() => {
    const p = db.getMealPlan(planId);
    if (!p) { router.push("/clients"); return; }
    if (!p.plan.competition_id && !p.plan.total_kcal && !p.plan.total_protein) {
      const m = db.getLatestMeasurement(p.plan.client_id);
      if (m && (m.tdee > 0 || m.protein > 0)) {
        db.updateMealPlan(planId, {
          total_kcal: m.tdee, total_protein: m.protein, total_carbs: m.carbs,
          total_fat: m.fat, total_fiber: m.fiber,
        });

      }
    }
  }, [planId, router]);

  useEffect(() => {
    const onFocus = () => setTick((t) => t + 1);
    window.addEventListener("focus", onFocus);
    return () => {window.removeEventListener("focus", onFocus);if(restDayLayoutTimer.current)clearTimeout(restDayLayoutTimer.current);};
  }, []);

  useEffect(() => {
    let live = true;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      if (!search.trim()) { setApiResults([]); return; }
      const results = await searchFatSecret(search);
      if (!live) return;
      setApiResults(results.map(r => ({ ...r, carb_type: classifyCarbs(r) })));
    }, 400);
    return () => { live = false; if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const normalItems = useMemo(() => itemsForDay(plan?.items ?? [], false), [plan]);
  const restItems = useMemo(() => itemsForDay(plan?.items ?? [], true), [plan]);
  const allItemsTotals = useMemo(() => mealTotals(normalItems, db.getFood), [normalItems]);
  const restItemsTotals = useMemo(() => mealTotals(restItems, db.getFood), [restItems]);

  if (!plan || !client) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-bold dark:text-white">Plan no encontrado</h2>
        <p className="text-gray-400 mt-2">El plan de comidas no existe o fue eliminado.</p>
        <button onClick={() => router.back()} className="inline-block mt-4 px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-medium">Volver</button>
      </div>
    </div>
  );

  const meas = db.getLatestMeasurement(plan.plan.client_id);
  const hasMeas = meas && meas.tdee > 0;
  const target = !plan.plan.competition_id && !(plan.plan.total_kcal > 0) && hasMeas
    ? { total_kcal: meas!.tdee, total_protein: meas!.protein, total_carbs: meas!.carbs, total_fat: meas!.fat, total_fiber: meas!.fiber }
    : plan.plan;
  const isLive = false;
  const noTargets = !plan.plan.competition_id && !hasMeas && !(plan.plan.total_kcal > 0);
  const filled = allItemsTotals;
  const filledRight = restItemsTotals;
  const normalTarget = target;
  const restDayTarget = restTargets(target,reduction);

  const currentPlanName = plan.plan.name.trim();
  const visiblePlanName = currentPlanName || "Plan sin título";
  const commitPlanName = () => {
    // A blank heading has no reliable click target, so never persist one.
    const nextName = editName.trim() || currentPlanName || "Plan sin título";
    if (nextName !== plan.plan.name) db.updateMealPlan(planId, { name: nextName });
    setPlan(db.getMealPlan(planId));
    setEditName(nextName);
    setEditingName(false);
  };

  const saveSections = (next:typeof sections) => {setSections(next);setPreference(`meal_sections_${planId}`,JSON.stringify(next));};
  const addSection = (day:"normal"|"rest") => {
    if(removingSection)return;
    const key=Object.keys(MEAL_LABELS).find(k=>!sections[day].includes(k)&&(day==="rest"?!k.endsWith("_workout"):true));
    if(!key)return;
    saveSections({...sections,[day]:[...sections[day],key]});
    setTargetColumn(day==="rest"?"right":"left");
    setSelectedMeal(key);
    setSelectedFood(null);
    setNewSection({day,key});
    window.setTimeout(()=>document.querySelector<HTMLElement>(`[data-meal-column="${day==="rest"?"right":"left"}"][data-meal-key="${key}"]`)?.scrollIntoView?.({behavior:"smooth",block:"center"}),0);
  };
  const deleteSection = () => {
    if(!removeSection)return;
    const section={day:(removeSection.rest?"rest":"normal") as "normal"|"rest",key:removeSection.key};
    setRemoveSection(null);setNewSection(null);setRemovingSection(section);
    setSelectedMeal(null);setSelectedFood(null);setEditingItemId(null);
    window.setTimeout(()=>{
      const current=db.getMealPlan(planId);
      if(current)for(const item of itemsForDay(current.items,section.day==="rest").filter(i=>i.meal_time===section.key))db.deleteMealPlanItem(item.id);
      const next={...sections,[section.day]:sections[section.day].filter(k=>k!==section.key)};
      setSections(next);
      setPreference(`meal_sections_${planId}`,JSON.stringify(next));
      setPlan(db.getMealPlan(planId));setRemovingSection(null);
    },620);
  };
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
      setFoodQuantity(["pz","pieza"].includes(saved.serving_unit)?1:saved.serving_size);
      setFoodUnit(saved.serving_unit);
      setApiResults([]);
      setSearch("");
      return;
    }
    setSelectedFood(food);
    setFoodQuantity(["pz","pieza"].includes(food.serving_unit)?1:food.serving_size);
    setFoodUnit(food.serving_unit);
  };

  const renderMealColumn = (
    planData: { plan: MealPlan; items: MealPlanItem[] } | null,
    mult: number,
    showWorkout: boolean,
    readOnly: boolean,
    column: "left" | "right",
    selMeal: string | null,
    setSelMeal: (v: string | null) => void,
    count: number,
    onlyKey?: string,
  ) => {
    if (!planData) return null;
    const columnGrouped: Record<string, MealPlanItem[]> = {};
    for (const item of planData.items) {
      if (!columnGrouped[item.meal_time]) columnGrouped[item.meal_time] = [];
      columnGrouped[item.meal_time].push(item);
    }
    const entries = Object.entries(MEAL_LABELS).filter(([key]) => {
      if (onlyKey && key !== onlyKey) return false;
      if (key === "pre_workout" || key === "intra_workout" || key === "post_workout") return showWorkout;
      if (key.startsWith("meal") && Number(key.slice(4)) <= count) return true;
      return (columnGrouped[key] || []).length > 0;
    });
    return entries.map(([key, label]) => {
      const items = columnGrouped[key] || [];
      const total = items.reduce(
        (acc, i) => {
          const f = db.getFood(i.food_id);
          if (!f) return acc;
          const ratio = getRatio(i.quantity, i.serving_unit, f.serving_size);
          return {
            kcal: acc.kcal + f.kcal * ratio,
            protein: acc.protein + f.protein * ratio,
            carbs: acc.carbs + f.carbs * ratio,
            fat: acc.fat + f.fat * ratio,
          };
        },
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      );
      const sel = selMeal === key && targetColumn === column;
      const sectionDay=column==="right"?"rest":"normal";
      const isNew=newSection?.key===key&&newSection.day===sectionDay;
      const isRemoving=removingSection?.key===key&&removingSection.day===sectionDay;
      return (
        <div key={key} data-meal-column={column} data-meal-key={key} data-new-meal={isNew?"true":undefined} data-removing-meal={isRemoving?"true":undefined} onAnimationEnd={()=>{if(isNew)setNewSection(null);}} className={`overflow-hidden transition-all duration-200 ${isNew?"animate-meal-added ":""}${isRemoving?"animate-meal-removed pointer-events-none ":""}${sel ? "ring-2 ring-brand-500 border-brand-500 bg-brand-50 dark:bg-brand-900/15 shadow-md" : readOnly ? "border-indigo-200 dark:border-indigo-800" : "border-gray-200 dark:border-gray-700 shadow-sm"} bg-white dark:bg-gray-900 rounded-xl border`}>
          <div role="button" aria-disabled={readOnly} tabIndex={readOnly ? -1 : 0} onKeyDown={e=>{if(!readOnly&&(e.key==="Enter"||e.key===" ")){e.preventDefault();setTargetColumn(column);setSelMeal(key);}}} className={`flex flex-wrap items-start justify-between gap-2 min-h-20 px-4 py-3 bg-gradient-to-r ${readOnly ? "from-indigo-50 to-white dark:from-indigo-950/20 dark:to-gray-900" : "from-brand-50 to-white dark:from-brand-900/20 dark:to-gray-900"} border-b border-gray-100 dark:border-gray-800 cursor-pointer`}
            onClick={() => { if (readOnly) return; setSelectedFood(null);setTargetColumn(column); setSelMeal(selMeal === key && targetColumn === column ? null : key); }}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${items.length > 0 ? "bg-green-400" : "bg-gray-300"}`} />
              <h4 className="font-semibold text-sm dark:text-white">{label}{restDay && <span className="ml-2 text-xs font-normal text-gray-400">{column==="right"?"Rest Day":"Normal"}</span>}</h4>
            </div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {Math.round(total.kcal * mult)} kcal · P:{Math.round(total.protein * mult)}g · C:{Math.round(total.carbs * mult)}g · G:{Math.round(total.fat * mult)}g
            </span>
          </div>
          {items.length > 0 ? (
            <div className="space-y-1.5 px-4 py-3">
              {items.map((item) => {
                const f = db.getFood(item.food_id);
                if (!f) return null;
                const ratio = getRatio(item.quantity, item.serving_unit, f.serving_size);
                return (
                  <div key={item.id} className={`meal-food-row text-sm rounded-lg px-3 py-2 group ${readOnly ? "bg-indigo-50/50 dark:bg-indigo-950/10" : "bg-gray-50 dark:bg-gray-800"}`}>
                    <span className="font-medium dark:text-white min-w-0 break-words">{f.name}</span>
                    <span className="text-gray-400 dark:text-gray-500 text-xs tabular-nums text-right whitespace-nowrap">
                      ({(f.protein * ratio * mult).toFixed(1)}p / {(f.carbs * ratio * mult).toFixed(1)}c / {(f.fat * ratio * mult).toFixed(1)}g)
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {!readOnly && editingItemId === item.id ? (
                        <div className="flex items-center gap-1">
                          <input type="number" min={0.001} step="any" value={editItemQty}
                            onChange={(e) => setEditItemQty(Number(e.target.value))}
                            onBlur={() => handleUpdateItemQty(item.id)}
                            onKeyDown={(e) => e.key === "Enter" && handleUpdateItemQty(item.id)}
                            className="w-16 text-xs text-right px-1 py-0.5 border border-brand-500 rounded outline-none focus:ring-1 focus:ring-brand-500" autoFocus />
                          <span className="text-xs text-gray-400 dark:text-gray-500">{item.serving_unit}</span>
                        </div>
                      ) : (
                        <button type="button" disabled={readOnly} aria-label={`Editar cantidad de ${f.name}`} onClick={() => { setEditingItemId(item.id); setEditItemQty(item.quantity); }}
                          className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-brand-600 hover:underline">
                          {item.quantity}{item.serving_unit}
                        </button>
                      )}
                      <button disabled={readOnly} aria-label={`Quitar ${f.name}`} onClick={(e) => { e.stopPropagation(); setRemoveItemId(item.id); }}
                        className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 px-4 py-3">
              Vacío. {selectedMeal === key && targetColumn === column ? "Elige un alimento de la lista →" : "Selecciona esta comida."}
            </p>
          )}
          <div className="min-h-9">{!readOnly && <button type="button" className="ml-2 mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500" aria-label={`Eliminar ${label} · ${column==="right"?"Rest Day":"Normal"}`} title={`Eliminar ${label} · ${column==="right"?"Rest Day":"Normal"}`} onClick={()=>setRemoveSection({key,rest:column==="right"})}><Trash2 size={16} aria-hidden="true" /></button>}</div>
        </div>
      );
    });
  };

  const handleAddFood = () => {
    if (!selectedFood || !selectedMeal || !Number.isFinite(foodQuantity) || foodQuantity <= 0) return;
    db.addMealPlanItem({
      meal_plan_id: planId,
      day_type: targetColumn === "right" ? "rest" : "normal",
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


  const handleUpdateItemQty = (itemId: number) => {
    if (Number.isFinite(editItemQty) && editItemQty > 0) {
      db.updateMealPlanItem(itemId, { quantity: editItemQty });
      setPlan(db.getMealPlan(planId));
    }
    setEditingItemId(null);
  };

  const handleExportPDF = () => {
    const meas = db.getLatestMeasurement(plan.plan.client_id);
    if (!meas) return;
    const items = itemsForDay(plan.items, restDay).map((i) => {
      const food = db.getFood(i.food_id);
      return { ...i, food: food || emptyFood };
    });
    const html = generateDietPDF({ client, measurement: meas, plan: restDay ? {...plan.plan, ...restDayTarget, name: plan.plan.name + " — Rest Day"} : plan.plan, items });
    const win = window.open("", "_blank");
    if (win) { win.opener = null; win.document.write(html); win.document.close(); setTimeout(() => win.print(), 300); }
  };

  const handleSaveTemplate = (name: string) => {
    if (!name) return;
    const items = itemsForDay(plan.items, restDay).map((i) => {
      const food = db.getFood(i.food_id);
      return {
        meal_time: i.meal_time,
        food: { name: food?.name || "", category: food?.category || "other", protein: food?.protein || 0, carbs: food?.carbs || 0, fat: food?.fat || 0, fiber: food?.fiber || 0, antioxidants: food?.antioxidants || 0, kcal: food?.kcal || 0, serving_size: food?.serving_size || 100, serving_unit: food?.serving_unit || "g" },
        quantity: i.quantity,
        serving_unit: i.serving_unit,
      };
    });
    const templateTarget = restDay ? restDayTarget : normalTarget;
    db.saveTemplate({ name, total_kcal: templateTarget.total_kcal, total_protein: templateTarget.total_protein, total_carbs: templateTarget.total_carbs, total_fat: templateTarget.total_fat, total_fiber: templateTarget.total_fiber, items });
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


  return (
    <div className="meal-planner-page animate-plan-page-enter">
      <section className="meal-plan-header relative isolate overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-gradient-to-br from-white via-slate-50 to-sky-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40 p-4 sm:p-5 mb-6 shadow-[0_12px_35px_-24px_rgba(15,23,42,.55)]">
        <div aria-hidden="true" className="absolute -right-12 -top-16 -z-10 h-44 w-44 rounded-full bg-indigo-400/10 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-20 left-1/3 -z-10 h-36 w-36 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="flex flex-col xl:flex-row xl:items-center gap-5">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <button aria-label="Volver al cliente" onClick={() => router.push(`/clients/${client.id}`)} className="mt-0.5 shrink-0 grid place-items-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-200 shadow-sm hover:-translate-x-0.5 hover:border-brand-300 hover:text-brand-600 transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[.18em] text-brand-600 dark:text-brand-400">Plan nutricional</p>
              {editingName ? (
                <input
                  autoFocus
                  aria-label="Nombre del plan"
                  value={editName}
                  maxLength={120}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={commitPlanName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") { setEditName(plan.plan.name); setEditingName(false); }
                  }}
                  className="mt-1 w-full max-w-md text-xl sm:text-2xl font-bold bg-white/70 dark:bg-slate-800/70 border border-brand-300 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-brand-500/30 dark:text-white"
                />
              ) : (
                <h2 role="button" tabIndex={0} aria-label={`Editar título: ${visiblePlanName}`} title="Haz clic para renombrar" className="mt-1 min-h-8 text-xl sm:text-2xl font-bold text-slate-950 dark:text-white truncate cursor-pointer hover:text-brand-600 transition-colors" onClick={() => { setEditName(plan.plan.name); setEditingName(true); }} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setEditName(plan.plan.name);setEditingName(true);}}}>
                  {visiblePlanName}
                </h2>
              )}
              <div className="mt-2 inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white/65 dark:bg-slate-800/65 px-3 py-1 text-xs text-slate-600 dark:text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="shrink-0">Cliente:</span><strong className="min-w-0 truncate font-semibold">{client.name}</strong>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 xl:justify-end">
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/50 p-1.5">
              <button onClick={handleExportPDF} className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:-translate-y-0.5 transition-all">
                <Printer className="w-4 h-4" /> PDF
              </button>
              <button onClick={() => setShowTemplatePrompt(true)} className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-all">
                <Plus className="w-4 h-4" /> Plantilla
              </button>
            </div>
            <button aria-label={restDay?"Rest Day ON":"Rest Day"} aria-pressed={restDay} data-rest-day-state={restDay?"on":"off"} onAnimationEnd={event=>{if(event.target===event.currentTarget)setRestDayMotion(null);}} onClick={() => {
              const nextRestDay=!restDay;
              if(restDayLayoutTimer.current)clearTimeout(restDayLayoutTimer.current);
              if(nextRestDay)setRestDayLayout(true);
              else restDayLayoutTimer.current=setTimeout(()=>setRestDayLayout(false),REST_DAY_LAYOUT_MS);
              setPreference(`rd_${planId}`, String(nextRestDay));
              setRestDay(nextRestDay);
              setRestDayMotion(nextRestDay?"on":"off");
              setTargetColumn(nextRestDay ? "right" : "left");
              setSelectedMeal(null);setSelectedFood(null);setEditingItemId(null);
            }} className={`rest-day-toggle group min-w-[190px] inline-flex items-center justify-between gap-4 rounded-xl border p-2.5 pl-3 transition-all duration-300 ${restDayMotion?`animate-rest-day-${restDayMotion} `:""}${restDay ? "border-indigo-500 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20" : "border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 hover:border-indigo-300"}`}>
              <span className="inline-flex items-center gap-2.5">
                <span className={`rest-day-icon grid place-items-center w-8 h-8 rounded-lg transition-all duration-300 ${restDay?"bg-white/15":"bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300"}`}><Moon className={`w-4 h-4 transition-transform duration-300 ${restDay?"fill-white":""}`} /></span>
                <span className="text-left"><span className="block text-[10px] uppercase tracking-wider opacity-70">Modo de dieta</span><strong className="block text-sm">Rest Day</strong></span>
              </span>
              <span className={`rest-day-status rounded-lg px-2.5 py-1.5 text-xs font-bold tabular-nums transition-all duration-300 ${restDay?"bg-white/15":"bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300"}`}>{restDay?`−${reduction}%`:"OFF"}</span>
            </button>
          </div>
        </div>
      </section>

      {restDay && <section className="rest-reduction-control" aria-labelledby="rest-reduction-title">
        <span className="rest-reduction-icon"><PieChart size={17}/></span>
        <div className="rest-reduction-copy"><div><h3 id="rest-reduction-title">Reducción Rest Day</h3><span>Automático</span></div><p>Ajusta solo las metas; las porciones conservan su valor real.</p></div>
        <label className="rest-reduction-range" style={{"--rest-value":reduction} as CSSProperties}><span className="sr-only">Reducción Rest Day (%)</span><input aria-label="Reducción Rest Day (%)" type="range" min="0" max="100" step="1" value={reduction} onChange={e=>{const n=Number(e.target.value);setReduction(n);setPreference(`rd_percent_${planId}`,String(n));}}/><output>{reduction}%</output></label>
      </section>}
      {/* Progress bars */}
      <div className="meal-day-layout mb-6" data-macro-layout data-split={restDay?"true":"false"}>
        <div role="region" data-macro-card aria-label={restDayLayout?"Macros — Plan Normal":"Macros"} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          {noTargets&&!restDayLayout?<div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700 text-center">
            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">No hay macros configurados</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Ve a la calculadora para establecer las metas.</p>
          </div>:<>
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-brand-600" />
              <h3 className="font-semibold text-sm dark:text-white">{restDayLayout?"Macros — Plan Normal":"Macros"}</h3>
              {isLive && <span className="text-[10px] text-emerald-500 font-medium">Tiempo real</span>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MacroBar label="Calorías" current={Math.round(filled.kcal)} total={normalTarget.total_kcal} unit="kcal" color="bg-blue-500" />
              <MacroBar label="Proteína" current={Math.round(filled.protein)} total={normalTarget.total_protein} unit="g" color="bg-macro-protein" />
              <MacroBar label="Carbos" current={Math.round(filled.carbs)} total={normalTarget.total_carbs} unit="g" color="bg-macro-carbs" />
              <MacroBar label="Grasas" current={Math.round(filled.fat)} total={normalTarget.total_fat} unit="g" color="bg-macro-fat" />
            </div>
          </>}
        </div>
        {restDayLayout&&<div className="rest-day-pane">
          <div role="region" data-macro-card aria-label="Macros — Rest Day" className="h-full bg-white dark:bg-gray-900 rounded-xl border border-indigo-200 dark:border-indigo-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Moon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-semibold text-sm dark:text-white">Macros — Rest Day</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MacroBar label="Calorías" current={Math.round(filledRight.kcal)} total={restDayTarget.total_kcal} unit="kcal" color="bg-blue-500" />
              <MacroBar label="Proteína" current={Math.round(filledRight.protein)} total={restDayTarget.total_protein} unit="g" color="bg-macro-protein" />
              <MacroBar label="Carbos" current={Math.round(filledRight.carbs)} total={restDayTarget.total_carbs} unit="g" color="bg-macro-carbs" />
              <MacroBar label="Grasas" current={Math.round(filledRight.fat)} total={restDayTarget.total_fat} unit="g" color="bg-macro-fat" />
            </div>
          </div>
        </div>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="min-w-0">
          <div className="meal-day-layout items-start mb-4" data-add-meal-controls data-split={restDay?"true":"false"}>
            <button data-meal-add="normal" onAnimationEnd={event=>{if(event.animationName==="add-meal-ripple")setAddSectionMotion(null);}} onClick={()=>{setAddSectionMotion("normal");addSection("normal");}} disabled={!!removingSection||!Object.keys(MEAL_LABELS).some(k=>!sections.normal.includes(k))} className={`add-meal-button w-full h-12 self-start mt-4 px-3 rounded-xl border-2 border-dashed text-sm whitespace-nowrap overflow-hidden disabled:opacity-40 ${addSectionMotion==="normal"?"animate-add-meal-ripple":""}`}>+ Agregar comida · Plan Normal</button>
            {restDayLayout&&<button data-meal-add="rest" onAnimationEnd={event=>{if(event.animationName==="add-meal-ripple")setAddSectionMotion(null);}} onClick={()=>{setAddSectionMotion("rest");addSection("rest");}} disabled={!restDay||!!removingSection||!Object.keys(MEAL_LABELS).some(k=>!sections.rest.includes(k)&&!k.endsWith("_workout"))} className={`rest-day-pane add-meal-button w-full h-12 self-start mt-4 px-3 rounded-xl border-2 border-dashed text-sm whitespace-nowrap disabled:opacity-40 ${addSectionMotion==="rest"?"animate-add-meal-ripple":""}`}>+ Agregar comida · Rest Day</button>}
          </div>
          <p className="sr-only" aria-live="polite">{newSection?`${MEAL_LABELS[newSection.key]} agregada a ${newSection.day==="rest"?"Rest Day":"Plan Normal"}`:removingSection?`${MEAL_LABELS[removingSection.key]} eliminándose de ${removingSection.day==="rest"?"Rest Day":"Plan Normal"}`:""}</p>
          <div className="meal-day-layout items-start" data-split={restDay?"true":"false"}>
            <div className="space-y-4 min-w-0">{Object.keys(MEAL_LABELS).filter(key=>sections.normal.includes(key)).map(key=>renderMealColumn({plan:plan.plan,items:normalItems},1,true,false,"left",selectedMeal,setSelectedMeal,6,key))}</div>
            {restDayLayout&&<div className="rest-day-pane space-y-4 min-w-0">{Object.keys(MEAL_LABELS).filter(key=>sections.rest.includes(key)).map(key=>renderMealColumn({plan:plan.plan,items:restItems},1,false,false,"right",selectedMeal,setSelectedMeal,6,key))}</div>}
          </div>

        </div>

        <div>
          <div className="meal-food-library bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="font-semibold text-sm mb-3 dark:text-white flex items-center gap-2">
              {selectedMeal ? (
                <><span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" /> Agregar a &quot;{MEAL_LABELS[selectedMeal]}&quot; · {targetColumn === "right" ? "Rest Day" : "Plan Normal"}</>
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
            <div className="meal-food-results space-y-1 max-h-96 overflow-y-auto">
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
              <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-3">Valores por 100{selectedFood.serving_unit === "ml" ? "ml" : "g"}</p>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <Scale className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="range"
                min={foodUnit==="g"||foodUnit==="ml"?1:0.01}
                max={foodUnit==="g"||foodUnit==="ml"?500:5}
                step={foodUnit==="g"||foodUnit==="ml"?1:0.01}
                value={Number(foodQuantity.toFixed(6))}
                onChange={(e) => setFoodQuantity(Number(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                min={0.001}
                step="any"
                value={Number(foodQuantity.toFixed(6))}
                onChange={(e) => setFoodQuantity(Number(e.target.value))}
                className="w-20 text-sm font-medium text-right px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-gray-100"
              />
              <div className="flex gap-0.5 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                {(selectedFood.serving_unit==="ml"?["ml"]:["g","lb",...(selectedFood.serving_size>0?["pieza"]:[])]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => {setFoodQuantity(convertQuantity(foodQuantity,foodUnit,u,selectedFood.serving_size));setFoodUnit(u);}}
                    className={`px-2 py-1 text-[11px] font-medium transition-colors ${foodUnit === u ? "bg-brand-600 text-white" : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                  >
                    {u==="pieza"?"pz":u}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-3">1 lb = 453.59237 g. {selectedFood.serving_unit!=="ml" && `1 pz usa la porción registrada: ${selectedFood.serving_size} g; comprueba ese peso en el alimento.`}</p>
            <div className="grid grid-cols-3 gap-2 text-xs text-center mb-4 p-3 bg-brand-50 dark:bg-brand-900/20 rounded-xl">
              <div>
                <p className="font-bold text-macro-protein">{(selectedFood.protein * getRatio(foodQuantity, foodUnit, selectedFood.serving_size)).toFixed(1)}g</p>
                <p className="text-gray-500 dark:text-gray-400">Proteína</p>
              </div>
              <div>
                <p className="font-bold text-macro-carbs">{(selectedFood.carbs * getRatio(foodQuantity, foodUnit, selectedFood.serving_size)).toFixed(1)}g</p>
                <p className="text-gray-500 dark:text-gray-400">Carbh.</p>
              </div>
              <div>
                <p className="font-bold text-macro-fat">{(selectedFood.fat * getRatio(foodQuantity, foodUnit, selectedFood.serving_size)).toFixed(1)}g</p>
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

      <ConfirmDialog open={removeSection!==null} title="Eliminar comida" message={`¿Eliminar ${removeSection?MEAL_LABELS[removeSection.key]:""} y sus alimentos únicamente de ${removeSection?.rest?"Rest Day":"Plan Normal"}?`} onConfirm={deleteSection} onCancel={()=>setRemoveSection(null)}/>
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
      <div className="flex flex-wrap gap-x-2 gap-y-1 justify-between text-xs mb-1">
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

function readSections(planId:number):{normal:string[];rest:string[]}{
 const defaults={normal:Object.keys(MEAL_LABELS).filter(k=>!k.startsWith("meal")||Number(k.slice(4))<=3),rest:["meal1","meal2","meal3"]};
 let result=defaults;
 try{const parsed=JSON.parse(getPreference(`meal_sections_${planId}`)||"null");if(parsed&&Array.isArray(parsed.normal)&&Array.isArray(parsed.rest))result={normal:parsed.normal.filter((k:string)=>k in MEAL_LABELS),rest:parsed.rest.filter((k:string)=>k in MEAL_LABELS)};}catch{}
 const items=db.getMealPlan(planId)?.items??[];
 for(const day of ["normal","rest"] as const) result[day]=Array.from(new Set([...result[day],...itemsForDay(items,day==="rest").map(i=>i.meal_time)]));
 return result;
}
