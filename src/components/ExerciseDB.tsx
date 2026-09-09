"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Database, Dumbbell, Film, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import exerciseData from "@/data/training-exercises.json";
import { db } from "@/lib/db";
import { exerciseLibraryKey, mergedExerciseLibrary } from "@/lib/exercise-library";
import type { CustomExercise, ExerciseLibraryItem } from "@/types";
import { TrainingVideo, TrainingVideoEditor } from "./TrainingMedia";
import { ConfirmDialog } from "./ui";
import { useToast } from "./Toast";

const baseExercises = exerciseData as ExerciseLibraryItem[];
const muscleGroups = Array.from(new Set(baseExercises.map(item => item.muscle_group))).sort((a, b) => a.localeCompare(b, "es"));
const emptyForm = { name: "", muscle_group: muscleGroups[0] ?? "Otro", notes: "", video_url: "" };

export function ExerciseDB() {
  const { toast } = useToast();
  const [custom, setCustom] = useState<CustomExercise[]>(() => db.getExercises());
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("Todos");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [personalizingIncluded, setPersonalizingIncluded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const rows = useMemo(() => {
    const own: Array<ExerciseLibraryItem & { source: "mine"; custom: CustomExercise }> = custom.map(item => ({
      id: `coach-${item.id}`, name: item.name, muscle_group: item.muscle_group, video_url: item.video_url, source: "mine", custom: item,
    }));
    const personalized = new Set(own.map(exerciseLibraryKey));
    const included = baseExercises.filter(item => !personalized.has(exerciseLibraryKey(item))).map(item => ({ ...item, source: "included" as const }));
    const normalized = query.trim().toLocaleLowerCase("es");
    return [...own, ...included].filter(item =>
      (muscle === "Todos" || item.muscle_group === muscle) &&
      (!normalized || `${item.name} ${item.muscle_group}`.toLocaleLowerCase("es").includes(normalized)),
    );
  }, [custom, query, muscle]);

  const libraryTotal = useMemo(() => mergedExerciseLibrary(custom, baseExercises).length, [custom]);

  function closeForm() { setFormOpen(false); setEditingId(null); setPersonalizingIncluded(false); setForm(emptyForm); }
  function startNew() { setEditingId(null); setPersonalizingIncluded(false); setForm(emptyForm); setFormOpen(true); }
  function startEdit(item: CustomExercise) {
    setEditingId(item.id);
    setPersonalizingIncluded(false);
    setForm({ name: item.name, muscle_group: item.muscle_group, notes: item.notes ?? "", video_url: item.video_url ?? "" });
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function personalize(item: ExerciseLibraryItem) {
    setEditingId(null);
    setPersonalizingIncluded(true);
    setForm({ name: item.name, muscle_group: item.muscle_group, notes: item.notes ?? "", video_url: item.video_url ?? "" });
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function save(event: FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) { toast("Escribe el nombre del ejercicio.", "error"); return; }
    const data = { name, muscle_group: form.muscle_group, notes: form.notes.trim(), video_url: form.video_url || undefined };
    if (editingId === null) db.saveExercise(data);
    else db.updateExercise(editingId, data);
    setCustom(db.getExercises());
    toast(editingId !== null ? `${name} se actualizó.` : personalizingIncluded ? `${name} ahora tiene tu personalización.` : `${name} se agregó a tu base.`);
    closeForm();
  }
  function remove() {
    if (deleteId === null) return;
    db.deleteExercise(deleteId);
    setCustom(db.getExercises());
    setDeleteId(null);
    toast("Ejercicio eliminado de tu base.", "info");
  }

  return <div className="exercise-db-page">
    <header className="exercise-db-hero">
      <div><p className="df-eyebrow">BIBLIOTECA DE ENTRENAMIENTO</p><h1>Base de ejercicios</h1><p>Crea tus propios movimientos con indicaciones y video. Aparecerán automáticamente al agregar ejercicios en cualquier rutina.</p></div>
      <div className="exercise-db-actions"><span><Database size={15}/><b>{libraryTotal}</b> ejercicios en tu biblioteca</span><button className="df-button" type="button" onClick={formOpen ? closeForm : startNew}>{formOpen ? <X size={16}/> : <Plus size={16}/>}{formOpen ? "Cerrar" : "Nuevo ejercicio"}</button></div>
    </header>
    <div className="exercise-db-guide" aria-label="Cómo usar la base de ejercicios"><span><b>1</b>Crea el ejercicio una sola vez</span><span><b>2</b>Abre una rutina y pulsa “Agregar ejercicio”</span><span><b>3</b>Encuéntralo primero en la biblioteca</span></div>

    {formOpen && <form data-exercise-form className="exercise-form animate-slide-down" onSubmit={save}>
      <div className="exercise-form-heading"><span><Dumbbell size={19}/></span><div><h2>{editingId !== null ? "Editar ejercicio" : personalizingIncluded ? "Personalizar ejercicio" : "Nuevo ejercicio"}</h2><p>{personalizingIncluded ? "Agrega tus indicaciones o video. Tu versión tendrá prioridad en todas tus rutinas." : "Esta ficha queda guardada en tu cuenta y disponible para todas tus rutinas."}</p></div></div>
      <div className="exercise-form-grid">
        <label>Nombre *<input data-exercise-name className="df-input" required autoFocus value={form.name} onChange={event => setForm({...form, name:event.target.value})} placeholder="Ej. Remo unilateral en polea"/></label>
        <label>Grupo muscular principal<select className="df-input" value={form.muscle_group} onChange={event => setForm({...form, muscle_group:event.target.value})}>{muscleGroups.map(group => <option key={group}>{group}</option>)}</select></label>
        <label className="wide">Indicaciones base<textarea className="df-input" rows={3} value={form.notes} onChange={event => setForm({...form, notes:event.target.value})} placeholder="Técnica, ejecución, tempo o errores que debe evitar el cliente"/></label>
      </div>
      <TrainingVideoEditor label="Video técnico opcional" value={form.video_url} onChange={video_url => setForm(current => ({...current, video_url}))} initiallyOpen/>
      <footer><small>Puedes usar YouTube o subir MP4, WebM o MOV de hasta 50 MB.</small><button className="df-button" type="submit">{editingId === null ? <Plus size={15}/> : <Pencil size={15}/>} {editingId !== null ? "Guardar cambios" : personalizingIncluded ? "Guardar personalización" : "Guardar ejercicio"}</button></footer>
    </form>}

    <section className="exercise-library-card">
      <div className="exercise-library-top"><div><p className="df-eyebrow">CATÁLOGO</p><h2>Mis ejercicios</h2></div><span>{rows.length} resultados</span></div>
      <div className="exercise-db-toolbar">
        <label className="exercise-db-search"><Search size={17}/><input aria-label="Buscar ejercicios" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar ejercicio o músculo…"/>{query && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setQuery("")}><X size={14}/></button>}</label>
      </div>
      <div className="exercise-muscle-filters">{["Todos", ...muscleGroups].map(group => <button key={group} className={muscle === group ? "active" : ""} onClick={() => setMuscle(group)}>{group}</button>)}</div>
      <div className="exercise-db-list">
        {rows.slice(0, 140).map(item => <article key={`${item.source}-${item.id}`} className={item.source === "mine" ? "is-custom" : ""}>
          <div className="exercise-db-avatar"><Dumbbell size={18}/></div>
          <div className="exercise-db-main"><div><h3>{item.name}</h3>{item.source === "mine" && <span>PERSONALIZADO</span>}</div><p>{item.muscle_group}{item.video_url ? " · Video incluido" : ""}</p>{item.source === "mine" && item.custom.notes && <small>{item.custom.notes}</small>}</div>
          {item.video_url && <div className="exercise-db-video"><Film size={14}/><TrainingVideo value={item.video_url} label="Video del coach"/></div>}
          {item.source === "mine" && <div className="exercise-db-row-actions"><button aria-label={`Editar ${item.name}`} onClick={() => startEdit(item.custom)}><Pencil size={15}/></button><button className="danger" aria-label={`Eliminar ${item.name}`} onClick={() => setDeleteId(item.custom.id)}><Trash2 size={15}/></button></div>}
          {item.source === "included" && <div className="exercise-db-row-actions"><button className="exercise-personalize" aria-label={`Agregar video o personalizar ${item.name}`} title="Agregar video o personalizar" onClick={() => personalize(item)}><Film size={14}/><span>Video</span></button></div>}
        </article>)}
        {!rows.length && <div className="exercise-db-empty"><Dumbbell size={30}/><h3>No hay coincidencias</h3><p>Cambia los filtros o crea un ejercicio propio.</p><button className="df-button" onClick={startNew}><Plus size={15}/>Nuevo ejercicio</button></div>}
      </div>
      {rows.length > 140 && <p className="exercise-db-limit">Mostrando los primeros 140 resultados. Escribe en la búsqueda para encontrar uno específico.</p>}
    </section>
    <ConfirmDialog open={deleteId !== null} title="Eliminar ejercicio" message="Se quitará de tu base. Las rutinas donde ya lo usaste conservarán su copia." onCancel={() => setDeleteId(null)} onConfirm={remove}/>
  </div>;
}
