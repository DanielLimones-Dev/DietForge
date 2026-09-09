"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Apple, ChevronDown, Database, Globe2, Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { db } from "@/lib/db";
import { classifyCarbs, searchFatSecret, searchOpenFoodFacts, searchUSDA } from "@/lib/nutrition";
import type { Food, FoodCategory } from "@/types";
import { NutritionWheel, dominantMacro, type MacroKey } from "./NutritionWheel";
import { ConfirmDialog } from "./ui";
import { useToast } from "./Toast";

const CATEGORIES: { value: FoodCategory; label: string }[] = [
  { value: "protein", label: "Proteínas" }, { value: "carbs", label: "Carbohidratos" },
  { value: "vegetables", label: "Verduras" }, { value: "fruits", label: "Frutas" },
  { value: "fats", label: "Grasas" }, { value: "dairy", label: "Lácteos" },
  { value: "grains", label: "Cereales" }, { value: "legumes", label: "Legumbres" },
  { value: "nuts", label: "Nueces/Semillas" }, { value: "beverages", label: "Bebidas" },
  { value: "supplements", label: "Suplementos" }, { value: "other", label: "Otros" },
];

const categoryStyles: Record<string, string> = {
  protein: "food-chip-protein", carbs: "food-chip-carbs", fats: "food-chip-fat",
  vegetables: "food-chip-green", fruits: "food-chip-amber", dairy: "food-chip-blue",
  grains: "food-chip-neutral", legumes: "food-chip-green", nuts: "food-chip-green",
  beverages: "food-chip-blue", supplements: "food-chip-violet", other: "food-chip-neutral",
};

const emptyForm = {
  name: "", category: "other" as FoodCategory, protein: "", carbs: "", fat: "",
  fiber: "", antioxidants: "", kcal: "", serving_size: "100", serving_unit: "g",
};

export function FoodDB() {
  const { toast } = useToast();
  const [foods, setFoods] = useState<Food[]>(() => db.getFoods());
  const [search, setSearch] = useState("");
  const [macroFilter, setMacroFilter] = useState<MacroKey | null>(null);
  const [wheelMacro, setWheelMacro] = useState<MacroKey>("protein");
  const [category, setCategory] = useState<FoodCategory | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [showApi, setShowApi] = useState(false);
  const [apiQuery, setApiQuery] = useState("");
  const [apiResults, setApiResults] = useState<Food[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => foods.filter((food) => {
    const matchesSearch = !search || food.name.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"));
    const matchesCategory = category === "all" || food.category === category;
    const matchesMacro = !macroFilter || (dominantMacro(food) === macroFilter && Number(food[macroFilter]) > 0);
    return matchesSearch && matchesCategory && matchesMacro;
  }), [foods, search, category, macroFilter]);

  const selectMacro = (macro: MacroKey) => { setWheelMacro(macro); setMacroFilter(macro); };

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    const numeric = [form.protein, form.carbs, form.fat, form.fiber, form.kcal];
    if (!numeric.every((value) => Number.isFinite(Number(value)) && Number(value) >= 0) || Number(form.serving_size) <= 0) {
      toast("Usa nutrientes iguales o mayores que cero y una porción mayor que cero.", "error"); return;
    }
    const base = {
      name: form.name.trim(), category: form.category, protein: Number(form.protein) || 0,
      carbs: Number(form.carbs) || 0, fat: Number(form.fat) || 0, fiber: Number(form.fiber) || 0,
      antioxidants: Number(form.antioxidants) || 0, kcal: Number(form.kcal) || 0,
      serving_size: Number(form.serving_size), serving_unit: form.serving_unit, source: "manual" as const,
    };
    db.saveFood({ ...base, carb_type: classifyCarbs(base) });
    setFoods(db.getFoods()); setForm(emptyForm); setShowForm(false); toast(`${base.name} se agregó a la base.`);
  };

  const handleDelete = (id: number) => {
    try {
      db.deleteFood(id); setFoods(db.getFoods());
      if (selectedFood?.id === id) setSelectedFood(null);
      toast("Alimento eliminado.", "info");
    } catch (error) { toast(error instanceof Error ? error.message : "No se pudo eliminar el alimento.", "error"); }
    setDeleteId(null);
  };

  const handleAPISearch = async () => {
    if (!apiQuery.trim() || apiLoading) return;
    setApiLoading(true);
    try {
      const [usda, openFoodFacts, fatSecret] = await Promise.all([searchUSDA(apiQuery), searchOpenFoodFacts(apiQuery), searchFatSecret(apiQuery)]);
      const results = [...usda, ...openFoodFacts, ...fatSecret]; setApiResults(results);
      if (!results.length) toast("No encontramos resultados en los proveedores.", "info");
    } finally { setApiLoading(false); }
  };

  const handleImport = (food: Food) => {
    const base = {
      name: food.name, category: food.category, protein: food.protein, carbs: food.carbs,
      fat: food.fat, fiber: food.fiber, antioxidants: food.antioxidants, kcal: food.kcal,
      serving_size: food.serving_size, serving_unit: food.serving_unit, source: "api" as const,
    };
    db.saveFood({ ...base, carb_type: food.carb_type || classifyCarbs(base) });
    setFoods(db.getFoods()); setApiResults([]); setApiQuery(""); toast(`${food.name} se importó correctamente.`);
  };

  return (
    <div className="food-explorer-page">
      <header className="food-explorer-header">
        <div><p className="df-eyebrow">BIBLIOTECA NUTRICIONAL</p><h1>Explorador de alimentos</h1><p>Analiza la composición de tu catálogo y encuentra mejores opciones para cada plan.</p></div>
        <div className="food-header-actions">
          <span className="food-count"><Database size={14} /> {foods.length} registrados</span>
          <button type="button" className="df-button-secondary" onClick={() => setShowApi((value) => !value)}><Globe2 size={16} /> Importar</button>
          <button type="button" className="df-button" onClick={() => setShowForm((value) => !value)}>{showForm ? <X size={16} /> : <Plus size={16} />}{showForm ? "Cerrar" : "Nuevo alimento"}</button>
        </div>
      </header>

      {showForm && <ManualFoodForm form={form} setForm={setForm} onSubmit={handleSave} />}
      {showApi && <section className="food-import-panel animate-slide-down">
        <div className="food-panel-title"><span><Globe2 size={17} /></span><div><h3>Importar desde fuentes externas</h3><p>USDA · OpenFoodFacts · FatSecret</p></div></div>
        <div className="food-api-search"><input className="df-input" placeholder="Ej. pechuga de pollo, arroz..." value={apiQuery} onChange={(event) => setApiQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleAPISearch()} /><button type="button" className="df-button" disabled={apiLoading} onClick={handleAPISearch}>{apiLoading ? "Buscando…" : "Buscar"}</button></div>
        {!!apiResults.length && <div className="food-api-results">{apiResults.map((food, index) => <FoodResult key={`${food.name}-${index}`} food={food} onImport={() => handleImport(food)} />)}</div>}
      </section>}

      <div className="food-explorer-grid">
        <NutritionWheel foods={foods} active={wheelMacro} onChange={selectMacro} onClear={() => setMacroFilter(null)} />
        <section className="food-library-card" aria-labelledby="food-library-title">
          <div className="food-library-heading"><div><p className="df-eyebrow">CATÁLOGO</p><h2 id="food-library-title">Alimentos disponibles</h2></div><span>{filtered.length} de {foods.length}</span></div>
          <div className="food-filter-row">
            <label className="food-search"><Search size={16} /><input aria-label="Buscar alimentos" placeholder="Buscar alimento..." value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda"><X size={14} /></button>}</label>
            <label className="food-category-filter"><SlidersHorizontal size={15} /><select aria-label="Filtrar por categoría" value={category} onChange={(event) => setCategory(event.target.value as FoodCategory | "all")}><option value="all">Todas</option>{CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown size={14} /></label>
          </div>
          {macroFilter && <div className="food-active-filter">Mostrando alimentos dominantes en <strong>{macroFilter === "protein" ? "proteína" : macroFilter === "carbs" ? "carbohidratos" : "grasas"}</strong><button type="button" onClick={() => setMacroFilter(null)}>Quitar filtro <X size={12} /></button></div>}
          <div className="food-list">
            {filtered.map((food) => <FoodListItem key={food.id} food={food} onOpen={() => setSelectedFood(food)} onDelete={() => setDeleteId(food.id)} />)}
            {!filtered.length && <div className="food-empty"><span><Apple size={28} /></span><h3>{foods.length ? "No hay coincidencias" : "Tu base está lista para crecer"}</h3><p>{foods.length ? "Prueba con otra búsqueda o elimina algún filtro." : "Agrega un alimento manualmente o impórtalo desde una fuente externa."}</p></div>}
          </div>
        </section>
      </div>

      <ConfirmDialog open={deleteId !== null} title="Eliminar alimento" message="¿Eliminar este alimento? Esta acción no se puede deshacer." onConfirm={() => deleteId !== null && handleDelete(deleteId)} onCancel={() => setDeleteId(null)} />
      {selectedFood && <FoodDetails food={selectedFood} onClose={() => setSelectedFood(null)} />}
    </div>
  );
}

function ManualFoodForm({ form, setForm, onSubmit }: {
  form: typeof emptyForm;
  setForm: (value: typeof emptyForm) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const fields = [
    ["kcal", "Calorías", "1"], ["protein", "Proteína (g)", "0.1"], ["carbs", "Carbohidratos (g)", "0.1"],
    ["fat", "Grasas (g)", "0.1"], ["fiber", "Fibra (g)", "0.1"], ["antioxidants", "Antioxidantes (mg)", "0.1"],
  ] as const;
  return (
    <form onSubmit={onSubmit} className="food-form-panel animate-slide-down">
      <div className="food-panel-title"><span><Plus size={17} /></span><div><h3>Nuevo alimento</h3><p>Valores nutricionales de la porción registrada</p></div></div>
      <div className="food-form-grid">
        <label className="food-field food-field-wide"><span>Nombre *</span><input className="df-input" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label className="food-field"><span>Categoría</span><select className="df-input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as FoodCategory })}>{CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="food-field"><span>Porción</span><div className="food-serving"><input type="number" min="0.01" step="0.01" className="df-input" value={form.serving_size} onChange={(event) => setForm({ ...form, serving_size: event.target.value })} /><select aria-label="Unidad de porción" className="df-input" value={form.serving_unit} onChange={(event) => setForm({ ...form, serving_unit: event.target.value })}><option value="g">g</option><option value="ml">ml</option><option value="pz">pz</option><option value="lb">lb</option></select></div></label>
        {fields.map(([key, label, step]) => <label className="food-field" key={key}><span>{label}</span><input type="number" min="0" step={step} className="df-input" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>)}
      </div>
      <div className="food-form-footer"><small>La clasificación de carbohidratos se calcula automáticamente.</small><button className="df-button" type="submit"><Plus size={15} /> Guardar alimento</button></div>
    </form>
  );
}

function FoodResult({ food, onImport }: { food: Food; onImport: () => void }) {
  return <div><div><strong>{food.name}</strong><small>{food.kcal} kcal · P {food.protein} g · C {food.carbs} g · G {food.fat} g</small></div><button type="button" onClick={onImport}>Importar</button></div>;
}

function FoodListItem({ food, onOpen, onDelete }: { food: Food; onOpen: () => void; onDelete: () => void }) {
  const categoryLabel = CATEGORIES.find((item) => item.value === food.category)?.label || food.category;
  return (
    <article className="food-list-item" tabIndex={0} role="button" onClick={onOpen} onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); }
    }}>
      <div className="food-avatar">{food.name.charAt(0).toLocaleUpperCase("es")}</div>
      <div className="food-main"><div><h3>{food.name}</h3><span className={`food-chip ${categoryStyles[food.category] || "food-chip-neutral"}`}>{categoryLabel}</span></div><p>{food.serving_size} {food.serving_unit} · {food.source === "api" ? "Fuente externa" : "Registro manual"}</p></div>
      <div className="food-macros"><span className="macro-protein"><small>PROTEÍNA</small>{food.protein}g</span><span className="macro-carbs"><small>CARBOS</small>{food.carbs}g</span><span className="macro-fat"><small>GRASAS</small>{food.fat}g</span><strong><small>ENERGÍA</small>{food.kcal}<em> kcal</em></strong></div>
      <button type="button" className="food-delete" aria-label={`Eliminar ${food.name}`} onClick={(event) => { event.stopPropagation(); onDelete(); }}><Trash2 size={16} /></button>
    </article>
  );
}

function FoodDetails({ food, onClose }: { food: Food; onClose: () => void }) {
  return (
    <div className="food-modal-backdrop animate-fade-in" onClick={onClose}>
      <article className="food-details-modal animate-scale-in" onClick={(event) => event.stopPropagation()}>
        <header><div><p className="df-eyebrow">FICHA NUTRICIONAL</p><h2>{food.name}</h2><span>{food.serving_size} {food.serving_unit} · {food.source === "api" ? "Fuente externa" : "Registro manual"}</span></div><button type="button" aria-label="Cerrar" onClick={onClose}><X size={18} /></button></header>
        <div className="food-calories"><span>Energía por porción</span><strong>{food.kcal}<small> kcal</small></strong></div>
        <div className="food-details-macros"><MacroMetric label="Proteína" value={food.protein} className="macro-protein" /><MacroMetric label="Carbohidratos" value={food.carbs} className="macro-carbs" /><MacroMetric label="Grasas" value={food.fat} className="macro-fat" /><MacroMetric label="Fibra" value={food.fiber} className="macro-fiber" /></div>
        {food.carb_type && <footer><span>Tipo de carbohidrato</span><strong>{food.carb_type === "slow" ? "Absorción lenta" : food.carb_type === "fast" ? "Absorción rápida" : "Mixto"}</strong></footer>}
      </article>
    </div>
  );
}

function MacroMetric({ label, value, className }: { label: string; value: number; className: string }) {
  return <div className={className}><span>{label}</span><strong>{value}<small> g</small></strong></div>;
}
