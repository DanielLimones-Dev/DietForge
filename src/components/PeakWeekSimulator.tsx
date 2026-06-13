import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import { db } from "@/lib/db";
import { Timer, Trash2, Eye, Info } from "lucide-react";
import type { Competition, MacroResult, PeakWeekDayConfig, PeakWeekMarker } from "@/types";

interface Props {
  clientId: number;
  competition?: Competition;
  latestMacros?: MacroResult;
}

const MARKERS: { id: PeakWeekMarker; label: string; color: string; desc: string }[] = [
  { id: "macro_adjust", label: "Ajuste macros", color: "#f97316", desc: "Reajuste de proteína/grasas según fase" },
  { id: "water_manip", label: "Agua", color: "#3b82f6", desc: "↑ Fase 1 / ↓ progresivo Fase 2 (nunca restricción total)" },
  { id: "sodium_manip", label: "Sodio", color: "#6b7280", desc: "↑ Fase 1 (↓ aldosterona) / ↓ progresivo Fase 2" },
  { id: "carb_load", label: "Carga carbos", color: "#d97706", desc: "Patata, boniato, arroz — fácil digestión" },
  { id: "puesta_punto", label: "Puesta a punto", color: "#a855f7", desc: "Probar estrategia pre-show con antelación" },
];

const PHASE_PROTOCOL: Record<string, { aldosterone: string; protein: string; training: string }> = {
  Descarga: {
    aldosterone: "↑ Sodio + agua para ↓ aldosterona. Entre más subas ahora, más podrás soltar en Fase 2.",
    protein: "↑ Proteínas para prevenir catabolismo muscular durante el déficit de carbos.",
    training: "Alto volumen, descansos cortos, SIN fallo muscular.",
  },
  Carga: {
    aldosterone: "↓ Sodio + agua PROGRESIVAMENTE (nunca restricción total). Aldosterona ya está baja.",
    protein: "↓ Proteínas para optimizar carga de glucógeno. Priorizar carbos fáciles.",
    training: "NO entrenar. Solo practicar poses.",
  },
  Show: {
    aldosterone: "Mantener hidratación ligera. Sin cambios bruscos.",
    protein: "Grasas/azúcares simples si responde bien. Probar con antelación.",
    training: "Solo practicar poses. Confiar en el trabajo hecho.",
  },
};

function phaseColor(phase: string): string {
  if (phase === "Descarga") return "#fecaca";
  if (phase === "Carga") return "#fed7aa";
  if (phase === "Peak") return "#e9d5ff";
  return "#bbf7d0";
}

function phaseTextColor(phase: string): string {
  if (phase === "Descarga") return "#991b1b";
  if (phase === "Carga") return "#9a3412";
  if (phase === "Peak") return "#581c87";
  return "#166534";
}

function defaultMacros(): MacroResult {
  return { tmb: 1800, tdee: 2200, protein: 150, carbs: 250, fat: 60, fiber: 25, antioxidants: 0 };
}

function getAutoPhase(dayOffset: number): { phase: string; markers: PeakWeekMarker[] } {
  if (dayOffset >= 4) return { phase: "Descarga", markers: ["water_manip", "sodium_manip"] };
  if (dayOffset >= 1) return { phase: "Carga", markers: ["carb_load", "water_manip", "sodium_manip"] };
  return { phase: "Show", markers: ["puesta_punto", "macro_adjust"] };
}

function generateDefaultDays(showDate: Date): PeakWeekDayConfig[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(showDate.getTime() - (6 - i) * 86400000);
    const offset = 6 - i;
    const auto = getAutoPhase(offset);
    return { date: d.toISOString().slice(0, 10), phase: auto.phase, markers: [...auto.markers], notes: "" };
  });
}

export function PeakWeekSimulator({ clientId, competition, latestMacros }: Props) {
  const [now] = useState(() => Date.now());
  const [simulating, setSimulating] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const showDate = competition ? new Date(competition.date) : new Date(now + 7 * 86400000);
  const daysUntil = Math.round((showDate.getTime() - now) / 86400000);
  const macros = latestMacros || defaultMacros();
  const startDate = new Date(showDate.getTime() - 6 * 86400000);

  const [days, setDays] = useState<PeakWeekDayConfig[]>(() => {
    if (competition?.peak_week_config) {
      try { return JSON.parse(competition.peak_week_config) as PeakWeekDayConfig[]; }
      catch { return generateDefaultDays(showDate); }
    }
    return generateDefaultDays(showDate);
  });

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [generated, setGenerated] = useState(() => db.getMealPlans(clientId).some((p) => p.name.includes("Peak Week")));
  const [showNotes, setShowNotes] = useState("");

  const setMacros = (field: "protein" | "carbs" | "fat", value: number) => {
    if (selectedDay === null) return;
    setDays((prev) => prev.map((d, i) => i === selectedDay ? { ...d, [field]: value } : d));
  };

  const toggleMarker = (marker: PeakWeekMarker) => {
    if (selectedDay === null) return;
    setDays((prev) => prev.map((d, i) => {
      if (i !== selectedDay) return d;
      const has = d.markers.includes(marker);
      return { ...d, markers: has ? d.markers.filter((m) => m !== marker) : [...d.markers, marker] };
    }));
  };

  const events = days.map((d, i) => {
    const markerLabels = d.markers.map((m) => MARKERS.find((x) => x.id === m)!.label).join(", ");
    return {
      id: String(i),
      title: d.phase,
      start: d.date,
      allDay: true,
      backgroundColor: phaseColor(d.phase),
      textColor: phaseTextColor(d.phase),
      borderColor: phaseColor(d.phase),
      extendedProps: { markers: markerLabels || "Sin marcas", notes: d.notes, index: i },
    };
  });

  const handleEventClick = (info: EventClickArg) => {
    const idx = info.event.extendedProps["index"] as number;
    setSelectedDay(idx);
    setShowNotes(days[idx]?.notes || "");
  };

  const handleGenerateWeek = () => {
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      const carbMod = d.markers.includes("carb_load") ? 1.8 : d.markers.includes("macro_adjust") ? 1.0 : 0.5;
      const protein = d.protein ?? Math.round(macros.protein * (d.phase === "Descarga" ? 1.2 : d.phase === "Carga" ? 0.8 : 1.0));
      const carbs = d.carbs ?? Math.round(macros.carbs * carbMod);
      const fat = d.fat ?? Math.round(macros.fat * (d.phase === "Carga" ? 0.6 : 0.4));
      const kcal = protein * 4 + carbs * 4 + fat * 9;
      db.saveMealPlan({
        client_id: clientId, measurement_id: 0,
        date: d.date,
        name: `${new Date(d.date + "T12:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric" })} — Peak Week [${d.phase}]`,
        total_kcal: kcal, total_protein: protein,
        total_carbs: carbs, total_fat: fat,
        total_fiber: 0, total_antioxidants: 0,
      }, []);
    }
    setGenerated(true);
  };

  const handleDeleteWeek = () => {
    if (!confirm("¿Eliminar todos los planes de Peak Week?")) return;
    const plans = db.getMealPlans(clientId).filter((p) => p.name.includes("Peak Week"));
    for (const p of plans) db.deleteMealPlan(p.id);
    setGenerated(false);
  };

  if (daysUntil > 21 && competition) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800 p-4 text-sm text-yellow-700 dark:text-yellow-300">
        <p className="font-semibold flex items-center gap-2"><Timer className="w-4 h-4" /> Peak Week</p>
        <p className="mt-1">La competencia es en {daysUntil} días. El calendario estará disponible cuando falten ≤21 días.</p>
      </div>
    );
  }

  const sel = selectedDay !== null ? days[selectedDay] : null;
  const protocol = sel ? PHASE_PROTOCOL[sel.phase] : null;

  const previewRows = days.map((d) => {
    const carbMod = d.markers.includes("carb_load") ? 1.8 : d.markers.includes("macro_adjust") ? 1.0 : 0.5;
    const p = d.protein ?? Math.round(macros.protein * (d.phase === "Descarga" ? 1.2 : d.phase === "Carga" ? 0.8 : 1.0));
    const c = d.carbs ?? Math.round(macros.carbs * carbMod);
    const f = d.fat ?? Math.round(macros.fat * (d.phase === "Carga" ? 0.6 : 0.4));
    return { label: new Date(d.date + "T12:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric" }), phase: d.phase, protein: p, carbs: c, fat: f, kcal: p * 4 + c * 4 + f * 9 };
  });

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold flex items-center gap-2 dark:text-white">
          <Timer className="w-4 h-4 text-blue-600" /> Peak Week{competition ? ` — ${competition.name}` : ""}
        </h3>
        <div className="relative">
          <button onClick={() => setShowInfo(!showInfo)}
            className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center transition-colors"
            title="¿Cómo funciona?">
            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          </button>
          {showInfo && (
            <div className="absolute right-0 top-5 z-40 w-72 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800/50 text-[10px] space-y-2 shadow-lg">
              <p className="font-semibold text-indigo-600 dark:text-indigo-400">¿Cómo usar el simulador?</p>
              <ul className="text-gray-600 dark:text-gray-400 space-y-1 list-disc pl-4">
                <li><strong>Click en un día</strong> del calendario para ver/editar marcadores, macros y notas</li>
                <li>Los macros se pueden <strong>editar manualmente</strong> en el panel de cada día</li>
                <li>Si no se asignan macros manuales, se calculan automáticamente al generar</li>
                <li>El botón <strong>"Generar plan"</strong> crea los meal plans con los valores manuales o calculados</li>
              </ul>
              <p className="font-semibold text-indigo-600 dark:text-indigo-400 pt-1 border-t border-indigo-200 dark:border-indigo-800/50">Recomendaciones</p>
              <ul className="text-gray-600 dark:text-gray-400 space-y-1 list-disc pl-4">
                <li>Fase Descarga: ↑ proteínas ×1.2, carbos al 50%, grasas al 40%</li>
                <li>Fase Carga: ↓ proteínas ×0.8, carbos ×1.8 si hay carga, grasas al 60%</li>
                <li>Ver el protocolo para más detalles sobre aldosterona y entrenamiento</li>
              </ul>
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        {startDate.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
        {" → "}
        {showDate.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
      </p>

      <div className="mb-4">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridSeven"
          views={{
            dayGridSeven: { type: "dayGrid", duration: { days: 7 }, buttonText: "7 días" },
          }}
          events={events}
          eventClick={handleEventClick}
          dateClick={(info: DateClickArg) => {
            const idx = days.findIndex((d) => d.date === info.dateStr);
            if (idx >= 0) { setSelectedDay(idx); setShowNotes(days[idx].notes); }
          }}
          height="auto"
          headerToolbar={false}
          initialDate={startDate.toISOString().slice(0, 10)}
          locale="es"
          firstDay={startDate.getDay()}
          validRange={{
            start: startDate.toISOString().slice(0, 10),
            end: showDate.toISOString().slice(0, 10),
          }}
        />
      </div>

      {days.length > 0 && (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-1 pr-2 font-medium">Día</th>
                <th className="text-left py-1 pr-2 font-medium">Fase</th>
                <th className="text-right py-1 pr-2 font-medium" style={{ color: "#f87171" }}>Prot</th>
                <th className="text-right py-1 pr-2 font-medium" style={{ color: "#fbbf24" }}>Carbs</th>
                <th className="text-right py-1 pr-2 font-medium" style={{ color: "#60a5fa" }}>Fat</th>
                <th className="text-right py-1 font-medium text-gray-400 dark:text-gray-500">Kcal</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => {
                const carbMod = d.markers.includes("carb_load") ? 1.8 : d.markers.includes("macro_adjust") ? 1.0 : 0.5;
                const autoP = Math.round(macros.protein * (d.phase === "Descarga" ? 1.2 : d.phase === "Carga" ? 0.8 : 1.0));
                const autoC = Math.round(macros.carbs * carbMod);
                const autoF = Math.round(macros.fat * (d.phase === "Carga" ? 0.6 : 0.4));
                return (
                  <tr key={d.date} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                    <td className="py-1.5 pr-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {new Date(d.date + "T12:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric" })}
                    </td>
                    <td className="py-1.5 pr-2">
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: phaseColor(d.phase),
                          color: phaseTextColor(d.phase),
                        }}>
                        {d.phase}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2">
                      <input type="number" step="1" value={d.protein ?? ""} placeholder={String(autoP)}
                        onChange={(e) => {
                          const val = e.target.value === "" ? undefined : Number(e.target.value);
                          setDays((prev) => prev.map((day) => day.date === d.date ? { ...day, protein: val as any } : day));
                        }}
                        className="w-14 text-right text-[10px] px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800/30 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-red-300/40 transition-all" />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input type="number" step="1" value={d.carbs ?? ""} placeholder={String(autoC)}
                        onChange={(e) => {
                          const val = e.target.value === "" ? undefined : Number(e.target.value);
                          setDays((prev) => prev.map((day) => day.date === d.date ? { ...day, carbs: val as any } : day));
                        }}
                        className="w-14 text-right text-[10px] px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/30 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-300/40 transition-all" />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input type="number" step="1" value={d.fat ?? ""} placeholder={String(autoF)}
                        onChange={(e) => {
                          const val = e.target.value === "" ? undefined : Number(e.target.value);
                          setDays((prev) => prev.map((day) => day.date === d.date ? { ...day, fat: val as any } : day));
                        }}
                        className="w-14 text-right text-[10px] px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800/30 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-300/40 transition-all" />
                    </td>
                    <td className="py-1.5 text-right text-gray-500 dark:text-gray-400 font-medium tabular-nums">
                      {(d.protein || autoP) * 4 + (d.carbs || autoC) * 4 + (d.fat || autoF) * 9}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sel && (
        <div className="p-3 rounded-lg border bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-4">
          <p className="text-xs font-bold mb-2 dark:text-white">
            {new Date(sel.date + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
            {" — "}
            <span style={{ color: phaseTextColor(sel.phase) }}>{sel.phase}</span>
          </p>

          {protocol && (
            <div className="mb-2 p-2 rounded bg-gray-100 dark:bg-gray-700/30 text-[9px] text-gray-500 dark:text-gray-400 space-y-1">
              <p><strong>Aldosterona:</strong> {protocol.aldosterone}</p>
              <p><strong>Proteínas:</strong> {protocol.protein}</p>
              <p><strong>Entrenamiento:</strong> {protocol.training}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-1 mb-2">
            {MARKERS.map((m) => {
              const active = sel.markers.includes(m.id);
              return (
                <button key={m.id} onClick={() => toggleMarker(m.id)}
                  title={m.desc}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors"
                  style={{
                    backgroundColor: active ? m.color : undefined,
                    color: active ? "#fff" : undefined,
                    borderColor: active ? "transparent" : undefined,
                  }}>
                  {m.label}
                </button>
              );
            })}
          </div>

          <div className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700/20 border border-gray-200 dark:border-gray-700 mb-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Macros</p>
              <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">
                {(sel.protein || 0) * 4 + (sel.carbs || 0) * 4 + (sel.fat || 0) * 4 + (sel.fat || 0) * 5 > 0
                  ? `${(sel.protein || 0) * 4 + (sel.carbs || 0) * 4 + (sel.fat || 0) * 9} kcal` : ""}
              </span>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input type="number" step="1" placeholder="Prot" value={sel.protein ?? ""}
                  onChange={(e) => setMacros("protein", e.target.value === "" ? undefined! : Number(e.target.value))}
                  className="w-full text-[10px] px-2 py-1.5 rounded-md border border-red-200 dark:border-red-800/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-red-300/40 transition-all pr-6" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-gray-400 dark:text-gray-600 pointer-events-none">g</span>
              </div>
              <div className="flex-1 relative">
                <input type="number" step="1" placeholder="Carbs" value={sel.carbs ?? ""}
                  onChange={(e) => setMacros("carbs", e.target.value === "" ? undefined! : Number(e.target.value))}
                  className="w-full text-[10px] px-2 py-1.5 rounded-md border border-amber-200 dark:border-amber-800/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-300/40 transition-all pr-6" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-gray-400 dark:text-gray-600 pointer-events-none">g</span>
              </div>
              <div className="flex-1 relative">
                <input type="number" step="1" placeholder="Fat" value={sel.fat ?? ""}
                  onChange={(e) => setMacros("fat", e.target.value === "" ? undefined! : Number(e.target.value))}
                  className="w-full text-[10px] px-2 py-1.5 rounded-md border border-blue-200 dark:border-blue-800/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300/40 transition-all pr-6" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-gray-400 dark:text-gray-600 pointer-events-none">g</span>
              </div>
            </div>
          </div>

          <input type="text" placeholder="Notas del día"
            value={showNotes}
            onChange={(e) => {
              setShowNotes(e.target.value);
              setDays((prev) => prev.map((d, i) => i === selectedDay ? { ...d, notes: e.target.value } : d));
            }}
            className="w-full text-[10px] px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100" />
        </div>
      )}

      <div className="grid grid-cols-5 gap-1 mb-3">
        {MARKERS.map((m) => (
          <span key={m.id} className="text-[9px] text-center text-gray-400 truncate" title={m.desc} style={{ borderTop: `2px solid ${m.color}`, paddingTop: 2 }}>
            {m.label}
          </span>
        ))}
      </div>

      <div className="flex gap-2 mb-3">
        <button onClick={() => setShowGuide(!showGuide)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          <Info className="w-3 h-3" /> Protocolo
        </button>
        <button onClick={() => setSimulating(!simulating)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          <Eye className="w-3 h-3" /> {simulating ? "Ocultar simulación" : "Simular macros"}
        </button>
      </div>

      {showGuide && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 text-[10px] space-y-2">
          <p className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1"><Info className="w-3 h-3" /> Protocolo Peak Week</p>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Aldosterona:</strong> ↑ sodio + agua en Fase 1 → cuerpo ↓ aldosterona → en Fase 2 al ↓ sodio+agua progresivamente no hay retención.
          </p>
          <ul className="text-gray-600 dark:text-gray-400 space-y-0.5 list-disc pl-4">
            <li><strong>Nunca</strong> restricción total de agua</li>
            <li>↑ proteínas Descarga / ↓ proteínas Carga</li>
            <li>Entrenar volumen sin fallo Descarga / NO entrenar en Carga</li>
            <li>Probar estrategia de carga con antelación (puesta a punto)</li>
          </ul>
        </div>
      )}

      {simulating && (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-1 pr-2">Día</th>
                <th className="text-left py-1 pr-2">Fase</th>
                <th className="text-right py-1 pr-2">Prot</th>
                <th className="text-right py-1 pr-2">Carbs</th>
                <th className="text-right py-1 pr-2">Fat</th>
                <th className="text-right py-1">Kcal</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((r, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-1 pr-2 dark:text-gray-300">{r.label}</td>
                  <td className="py-1 pr-2" style={{ color: phaseTextColor(r.phase) }}>{r.phase}</td>
                  <td className="text-right py-1 pr-2 dark:text-gray-300">{r.protein}g</td>
                  <td className="text-right py-1 pr-2 dark:text-gray-300">{r.carbs}g</td>
                  <td className="text-right py-1 pr-2 dark:text-gray-300">{r.fat}g</td>
                  <td className="text-right py-1 dark:text-gray-300">{r.kcal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={generated ? () => { handleDeleteWeek(); handleGenerateWeek(); } : handleGenerateWeek}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors">
          {generated ? "Regenerar" : "Generar plan de Peak Week"}
        </button>
        {generated && (
          <button onClick={handleDeleteWeek}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
