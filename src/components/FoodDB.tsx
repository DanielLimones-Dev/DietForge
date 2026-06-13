import { useState } from "react";
import { Plus, Search, Trash2, Globe, Apple, ChevronDown, ChevronUp, X } from "lucide-react";
import { db } from "@/lib/db";
import { searchUSDA, searchOpenFoodFacts, searchFatSecret, classifyCarbs } from "@/lib/nutrition";
import type { Food, FoodCategory } from "@/types";
import { ConfirmDialog } from "./ui";

const CATEGORIES: { value: FoodCategory; label: string }[] = [
  { value: "protein", label: "Proteínas" },
  { value: "carbs", label: "Carbohidratos" },
  { value: "vegetables", label: "Verduras" },
  { value: "fruits", label: "Frutas" },
  { value: "fats", label: "Grasas" },
  { value: "dairy", label: "Lácteos" },
  { value: "grains", label: "Cereales" },
  { value: "legumes", label: "Legumbres" },
  { value: "nuts", label: "Nueces/Semillas" },
  { value: "beverages", label: "Bebidas" },
  { value: "supplements", label: "Suplementos" },
  { value: "other", label: "Otros" },
];

const catColors: Record<string, string> = {
  protein: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  carbs: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  vegetables: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  fruits: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  fats: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  dairy: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  grains: "bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-300",
  legumes: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300",
  nuts: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  beverages: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  supplements: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

export function FoodDB() {
  const [foods, setFoods] = useState<Food[]>(() => db.getFoods());
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [apiResults, setApiResults] = useState<Food[]>([]);
  const [apiQuery, setApiQuery] = useState("");
  const [showApi, setShowApi] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "other" as FoodCategory,
    protein: "",
    carbs: "",
    fat: "",
    fiber: "",
    antioxidants: "",
    kcal: "",
    serving_size: "100",
    serving_unit: "g",
  });

  const filtered = foods.filter(
    (f) => !search || f.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const base = {
      name: form.name,
      category: form.category,
      protein: Number(form.protein) || 0,
      carbs: Number(form.carbs) || 0,
      fat: Number(form.fat) || 0,
      fiber: Number(form.fiber) || 0,
      antioxidants: Number(form.antioxidants) || 0,
      kcal: Number(form.kcal) || 0,
      serving_size: Number(form.serving_size) || 100,
      serving_unit: form.serving_unit,
      source: "manual" as const,
    };
    db.saveFood({ ...base, carb_type: classifyCarbs(base) });
    setFoods(db.getFoods());
    setForm({ name: "", category: "other", protein: "", carbs: "", fat: "", fiber: "", antioxidants: "", kcal: "", serving_size: "100", serving_unit: "g" });
    setShowForm(false);
  };

  const handleDelete = (id: number) => {
    db.deleteFood(id);
    setFoods(db.getFoods());
    setDeleteId(null);
  };

  const handleAPISearch = async () => {
    if (!apiQuery.trim()) return;
    const [usda, off, fs] = await Promise.all([
      searchUSDA(apiQuery),
      searchOpenFoodFacts(apiQuery),
      searchFatSecret(apiQuery),
    ]);
    setApiResults([...usda, ...off, ...fs]);
  };

  const handleImport = (food: Food) => {
    const base = {
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
      source: "api" as const,
    };
    db.saveFood({ ...base, carb_type: food.carb_type || classifyCarbs(base) });
    setFoods(db.getFoods());
    setApiResults([]);
    setApiQuery("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            Base de Alimentos
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {foods.length} alimento{foods.length !== 1 ? "s" : ""} registrado{foods.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700 shadow-sm hover:shadow-md transition-all active:scale-[0.97]"
        >
          <Plus className="w-4 h-4" />
          {showForm ? "Cerrar" : "Agregar Manual"}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
        <input
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all duration-200 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          placeholder="Buscar en tu base de datos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 text-white shadow-sm">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Nuevo Alimento</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Ingresa los valores nutricionales</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Nombre *</label>
              <input className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all duration-200 dark:text-gray-100" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Categoría</label>
              <select className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all duration-200 dark:text-gray-100" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as FoodCategory })}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">kcal</label>
              <input type="number" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all duration-200 dark:text-gray-100" value={form.kcal} onChange={(e) => setForm({ ...form, kcal: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Proteína (g)</label>
              <input type="number" step="0.1" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all duration-200 dark:text-gray-100" value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Carbohidratos (g)</label>
              <input type="number" step="0.1" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all duration-200 dark:text-gray-100" value={form.carbs} onChange={(e) => setForm({ ...form, carbs: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Grasas (g)</label>
              <input type="number" step="0.1" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all duration-200 dark:text-gray-100" value={form.fat} onChange={(e) => setForm({ ...form, fat: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Fibra (g)</label>
              <input type="number" step="0.1" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all duration-200 dark:text-gray-100" value={form.fiber} onChange={(e) => setForm({ ...form, fiber: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium">Porción (g)</label>
              <input type="number" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all duration-200 dark:text-gray-100" value={form.serving_size} onChange={(e) => setForm({ ...form, serving_size: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-sm hover:shadow-md transition-all active:scale-[0.97]">
            Guardar Alimento
          </button>
        </form>
      )}

      <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <button
          onClick={() => setShowApi(!showApi)}
          className="w-full px-6 py-4 flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-sm">
              <Globe className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Importar de API</h3>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">USDA · OpenFoodFacts · FatSecret</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {apiResults.length > 0 && (
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{apiResults.length} resultados</span>
            )}
            {showApi ? (
              <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-brand-500 transition-colors" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-brand-500 transition-colors" />
            )}
          </div>
        </button>
        {showApi && (
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2">
              <input
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all duration-200 dark:text-gray-100 placeholder:text-gray-400"
                placeholder="Ej: chicken breast, arroz..."
                value={apiQuery}
                onChange={(e) => setApiQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAPISearch()}
              />
              <button
                onClick={handleAPISearch}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 shadow-sm hover:shadow-md transition-all active:scale-[0.97]"
              >
                Buscar
              </button>
            </div>
            {apiResults.length > 0 && (
              <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-60 overflow-y-auto mt-3 rounded-xl border border-gray-100 dark:border-gray-800">
                {apiResults.map((f, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                        {f.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{f.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{f.protein}p · {f.carbs}c · {f.fat}g · {f.kcal}kcal</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleImport(f)}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-brand-50 text-brand-600 hover:bg-brand-500 hover:text-white dark:bg-brand-900/20 dark:text-brand-400 dark:hover:bg-brand-500 dark:hover:text-white transition-all active:scale-[0.97]"
                    >
                      Importar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {filtered.map((f) => (
          <div key={f.id} className="group bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer" onClick={() => setSelectedFood(f)}>
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
                  {f.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${catColors[f.category] || "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
                      {CATEGORIES.find((c) => c.value === f.category)?.label || f.category}
                    </span>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{f.name}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <span className="text-blue-500 dark:text-blue-400">{f.protein}g prot</span>
                    <span className="text-orange-500 dark:text-orange-400">{f.carbs}g carb</span>
                    <span className="text-purple-500 dark:text-purple-400">{f.fat}g gras</span>
                    <span>{f.kcal} kcal</span>
                    <span className="text-[10px] text-gray-300 dark:text-gray-600">·</span>
                    <span className="text-gray-300 dark:text-gray-600">{f.source === "api" ? "API" : "Manual"}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteId(f.id); }}
                className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 opacity-0 group-hover:opacity-100 shrink-0 ml-2"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-600">
            <Apple className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">
              {foods.length === 0 ? "No hay alimentos registrados" : "Sin resultados"}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {foods.length === 0 ? "Agrega alimentos manualmente o importa desde una API" : "Intenta con otro término de búsqueda"}
            </p>
            {foods.length === 0 && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowForm(true)}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-brand-500 text-white hover:bg-brand-600 transition-all active:scale-[0.97]"
                >
                  Agregar manual
                </button>
                <button
                  onClick={() => setShowApi(true)}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-all active:scale-[0.97]"
                >
                  Importar de API
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        title="Eliminar alimento"
        message="¿Eliminar este alimento? Esta acción no se puede deshacer."
        onConfirm={() => deleteId !== null && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

      {selectedFood && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setSelectedFood(null)}>
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate pr-2">{selectedFood.name}</h3>
              <button onClick={() => setSelectedFood(null)} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 pb-2 flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${catColors[selectedFood.category] || "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
                {CATEGORIES.find((c) => c.value === selectedFood.category)?.label || selectedFood.category}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">{selectedFood.serving_size}{selectedFood.serving_unit} porción</span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">· {selectedFood.source === "api" ? "API" : "Manual"}</span>
            </div>
            <div className="px-5 pb-5">
              <div className="border-2 border-gray-900 dark:border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-900 dark:bg-gray-200 px-4 py-2.5">
                  <p className="text-xs font-black tracking-widest text-white dark:text-gray-900 uppercase">Información Nutricional</p>
                </div>
                <div className="px-4 py-2 border-b-2 border-gray-900 dark:border-gray-200">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">Calorías</span>
                    <span className="text-lg font-black text-gray-900 dark:text-white">{selectedFood.kcal}</span>
                  </div>
                  <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">Valores por {selectedFood.serving_size}{selectedFood.serving_unit}</p>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">Macronutrientes</span>
                    <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">por porción</span>
                  </div>
                  <MacroRow label="Proteína" value={selectedFood.protein} unit="g" color="text-blue-600 dark:text-blue-400" />
                  <MacroRow label="Carbohidratos" value={selectedFood.carbs} unit="g" color="text-orange-600 dark:text-orange-400" />
                  <MacroRow label="Grasas" value={selectedFood.fat} unit="g" color="text-purple-600 dark:text-purple-400" />
                  <MacroRow label="Fibra" value={selectedFood.fiber} unit="g" color="text-emerald-600 dark:text-emerald-400" />
                  {selectedFood.antioxidants > 0 && (
                    <MacroRow label="Antioxidantes" value={selectedFood.antioxidants} unit="mg" color="text-rose-600 dark:text-rose-400" />
                  )}
                </div>
                {selectedFood.carb_type && (
                  <div className="px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Tipo de carbohidratos</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        selectedFood.carb_type === "slow" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                        selectedFood.carb_type === "fast" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      }`}>
                        {selectedFood.carb_type === "slow" ? "Lenta" : selectedFood.carb_type === "fast" ? "Rápida" : "Mixta"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MacroRow({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs text-gray-600 dark:text-gray-300">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}{unit}</span>
    </div>
  );
}
