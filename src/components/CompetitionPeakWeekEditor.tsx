import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { PeakWeekDayConfig, PeakWeekMarker } from "@/types";

interface Props {
  competitionDate?: string;
  competitionName?: string;
  competitionCategory?: string;
  competitionWeight?: string;
  competitionPlacement?: string;
  initialConfig?: PeakWeekDayConfig[];
  baseMacros?: { protein: number; carbs: number; fat: number; tdee: number };
  onChange: (data: {
    name: string;
    date: string;
    category: string;
    weight: string;
    placement: string;
    config: PeakWeekDayConfig[];
  }) => void;
}

type MarkerDef = { id: PeakWeekMarker; label: string; color: string; desc: string };

const MARKERS: MarkerDef[] = [
  { id: "inicio_competencia", label: "Inicio prep", color: "#059669", desc: "Inicio de la preparación. Marca el día 1 del plan. Al activarlo se cargan los macros base del cliente como punto de partida." },
  { id: "macro_adjust", label: "Ajuste macros", color: "#f97316", desc: "Día de reajuste de proteína/grasas. Útil cuando cambias de fase y necesitas modificar la distribución de macros para adaptarte al nuevo objetivo." },
  { id: "water_manip", label: "Agua", color: "#3b82f6", desc: "Manipulación de agua. ↑ Fase 1 (carga de agua para bajar aldosterona) / ↓ progresivo Fase 2 (nunca restricción total). Ayuda a eliminar agua subcutánea para mejorar definición muscular." },
  { id: "sodium_manip", label: "Sodio", color: "#6b7280", desc: "Manipulación de sodio. ↑ Fase 1 para ↓ aldosterona (hormona que retiene líquidos) / ↓ progresivo Fase 2 para evitar retención. Clave para lograr una piel más pegada al músculo." },
  { id: "carb_load", label: "Carga carbos", color: "#eab308", desc: "Carga de carbohidratos. Patata, boniato, arroz — fáciles de digerir. Llena los depósitos de glucógeno para que los músculos se vean más llenos y redondos en el escenario." },
  { id: "puesta_punto", label: "Puesta a punto", color: "#a855f7", desc: "Prueba de estrategia pre-show. Ensaya la carga de carbos, la hidratación y los alimentos que consumirás el día del show para evitar sorpresas. Cada organismo responde distinto." },
  { id: "show_day", label: "Show day", color: "#22c55e", desc: "Día de la competencia. Sigue el plan de comidas y hidratación ensayado en la puesta a punto. Confía en el trabajo hecho, no hagas cambios de último minuto." },
];

const PHASES = [
  { id: "Show", color: "#22c55e", darkColor: "#4ade80", desc: "Competencia. Grasas/azúcares si el organismo responde bien." },
  { id: "Descarga", color: "#ef4444", darkColor: "#fca5a5", desc: "4 días. ↓ carbos, ↑ Na+agua, ↑ proteínas, entrenar volumen sin fallo." },
  { id: "Carga", color: "#f97316", darkColor: "#fdba74", desc: "2-3 días. ↑ carbos, ↓ Na+agua progresivo, ↓ proteínas, descansar." },
  { id: "Peak", color: "#a855f7", darkColor: "#d8b4fe", desc: "Transición. Ajuste fino antes del show." },
] as const;

function phaseOf(index: number, total: number): string {
  if (index === total - 1) return "Show";
  if (total <= 3) return "Peak";
  const descargaEnd = Math.round(total * 0.57);
  if (index < descargaEnd) return "Descarga";
  return "Carga";
}

const PHASE_DEFAULT_MARKERS: Record<string, PeakWeekMarker[]> = {
  Descarga: ["water_manip", "sodium_manip"],
  Carga: ["carb_load", "water_manip", "sodium_manip"],
  Show: ["puesta_punto", "macro_adjust"],
};

const PHASE_PROTOCOL: Record<string, { aldosterone: string; protein: string; training: string }> = {
  Descarga: {
    aldosterone: "↑ Sodio + agua para ↓ aldosterona (hormona que retiene líquidos). Entre más subas ahora, más podrás soltar en Fase 2.",
    protein: "↑ Proteínas para prevenir catabolismo muscular durante el déficit de carbos.",
    training: "Alto volumen, descansos cortos, SIN fallo muscular. Objetivo: agotar glucógeno sin dañar fibras.",
  },
  Carga: {
    aldosterone: "↓ Sodio + agua PROGRESIVAMENTE (nunca restricción total). La aldosterona ya está baja, no hay retención.",
    protein: "↓ Proteínas para optimizar la carga de glucógeno. Priorizar carbos de fácil digestión.",
    training: "NO entrenar. Solo practicar poses. La carga de carbos no debe consumirse.",
  },
  Show: {
    aldosterone: "Mantener hidratación ligera. Sin cambios bruscos.",
    protein: "Grasas y azúcares simples si el organismo responde bien. Probar con antelación.",
    training: "Solo practicar poses. Confiar en el trabajo hecho.",
  },
};

export function CompetitionPeakWeekEditor({
  competitionDate, competitionName = "", competitionCategory = "",
  competitionWeight = "", competitionPlacement = "", initialConfig, baseMacros, onChange,
}: Props) {
  const [name, setName] = useState(competitionName);
  const [date, setDate] = useState(competitionDate || "");
  const [category, setCategory] = useState(competitionCategory);
  const [weight, setWeight] = useState(competitionWeight);
  const [placement] = useState(competitionPlacement);

  const [days, setDays] = useState<PeakWeekDayConfig[]>(() => initialConfig?.length ? initialConfig : []);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const emit = (d: PeakWeekDayConfig[], overrides?: Partial<{ name: string; date: string }>) => {
    onChange({
      name: overrides?.name ?? name,
      date: overrides?.date ?? date,
      category, weight, placement, config: d,
    });
  };

  const toggleDay = (dateStr: string) => {
    const exists = days.find((d) => d.date === dateStr);
    setSelectedDate(dateStr);
    setShowModal(true);
    if (!exists) return; // Don't add day until a marker is set
  };

  const toggleMarkerOnDay = (marker: PeakWeekMarker) => {
    if (!selectedDate) return;
    setDays((prev) => {
      const exists = prev.find((d) => d.date === selectedDate);
      // If day doesn't exist, create it with the marker
      if (!exists) {
        const newDay: PeakWeekDayConfig = {
          date: selectedDate, phase: "", markers: [marker], notes: "",
          ...(marker === "inicio_competencia" && baseMacros ? { protein: baseMacros.protein, carbs: baseMacros.carbs, fat: baseMacros.fat } : {}),
        };
        const newDays = [...prev, newDay].sort((a, b) => a.date.localeCompare(b.date));
        const rephased = newDays.map((d, i, arr) => ({ ...d, phase: d.markers.includes("inicio_competencia") ? "" : phaseOf(i, arr.length) }));
        const lastDay = rephased[rephased.length - 1];
        setDate(lastDay.date);
        emit(rephased, { date: lastDay.date });
        return rephased;
      }
      // Toggle marker on existing day
      const has = exists.markers.includes(marker);
      // If removing the last marker, remove the day entirely
      if (has && exists.markers.length <= 1) {
        const next = prev.filter((d) => d.date !== selectedDate);
        const rephased = next.length > 0 ? next.map((d, i, arr) => ({ ...d, phase: phaseOf(i, arr.length) })) : [];
        if (rephased.length > 0) setDate(rephased[rephased.length - 1].date);
        setShowModal(false);
        emit(rephased);
        return rephased;
      }
      const next = prev.map((d) => {
        if (d.date !== selectedDate) return d;
        return has
          ? { ...d, markers: d.markers.filter((m) => m !== marker) }
          : { ...d, markers: [...d.markers, marker] };
      });
      emit(next);
      return next;
    });
  };

  const generatePeakWeek = () => {
    setDays((prev) => {
      const show = prev.find((d) => d.markers.includes("show_day"));
      if (!show) return prev;
      const showDate = new Date(show.date + "T12:00:00");
      const startDate = new Date(showDate.getTime() - 6 * 86400000);
      const existing = new Set(prev.map((d) => d.date));
      const generated: PeakWeekDayConfig[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate.getTime() + i * 86400000);
        const dateStr = date.toISOString().slice(0, 10);
        if (!existing.has(dateStr)) {
          generated.push({
            date: dateStr, phase: "",
            markers: i === 6 ? ["show_day"] : [],
            notes: "", protein: baseMacros?.protein, carbs: baseMacros?.carbs, fat: baseMacros?.fat,
          });
        }
      }
      if (generated.length === 0) return prev;
      const merged = [...prev, ...generated].sort((a, b) => a.date.localeCompare(b.date));
      const rephased = merged.map((d, i, arr) => {
        const phase = d.markers.includes("inicio_competencia") ? "" : phaseOf(i, arr.length);
        const defaultMarkers = PHASE_DEFAULT_MARKERS[phase] || [];
        const combined = [...new Set([...d.markers, ...defaultMarkers])];
        // Adjust macros per phase
        let p = d.protein ?? baseMacros?.protein;
        let c = d.carbs ?? baseMacros?.carbs;
        let f = d.fat ?? baseMacros?.fat;
        if (phase === "Descarga") {
          p = Math.round((p || 0) * 1.1);
          c = Math.round((c || 0) * 0.7);
          f = Math.round((f || 0) * 0.8);
        } else if (phase === "Carga") {
          p = Math.round((p || 0) * 0.9);
          c = Math.round((c || 0) * 1.4);
          f = Math.round((f || 0) * 0.9);
        } else if (phase === "Show") {
          c = Math.round((c || 0) * 1.2);
        }
        return { ...d, phase, markers: combined, protein: p, carbs: c, fat: f };
      });
      const lastDay = rephased[rephased.length - 1];
      setDate(lastDay.date);
      emit(rephased, { date: lastDay.date });
      return rephased;
    });
  };

  const removeDay = (dateStr: string) => {
    const next = days.filter((d) => d.date !== dateStr);
    const rephased = next.map((d, i) => ({ ...d, phase: d.markers.includes("inicio_competencia") ? "" : phaseOf(i, next.length) }));
    setDays(rephased);
    setShowModal(false);
    setSelectedDate(null);
    if (rephased.length > 0) {
      setDate(rephased[rephased.length - 1].date);
      emit(rephased, { date: rephased[rephased.length - 1].date });
    } else {
      setDate("");
      emit([], { date: "" });
    }
  };

  const selDay = days.find((d) => d.date === selectedDate);
  const isShow = selDay && days.indexOf(selDay) === days.length - 1;
  const protocol = selDay ? PHASE_PROTOCOL[selDay.phase] : null;

  const setMacros = (field: "protein" | "carbs" | "fat", value: number) => {
    if (!selectedDate) return;
    setDays((prev) => {
      const next = prev.map((d) => d.date === selectedDate ? { ...d, [field]: value } : d);
      emit(next);
      return next;
    });
  };

  return (
    <div>
      <style>{`
        .dark .fc-theme-standard td, .dark .fc-theme-standard th { border-color: #2a2a2a; }
        .dark .fc .fc-daygrid-day-frame { background: #18181b; transition: background 0.15s; }
        .dark .fc .fc-day-other .fc-daygrid-day-frame { background: #141416; }
        .dark .fc .fc-daygrid-day-number { color: #d4d4d8; font-size: 12px; padding: 2px 4px !important; }
        .dark .fc .fc-day-other .fc-daygrid-day-number { color: #52525b; }
        .dark .fc .fc-col-header-cell-cushion { color: #a1a1aa; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
        .dark .fc .fc-toolbar-title { color: #e4e4e7; font-size: 14px !important; font-weight: 600; }
        .dark .fc .fc-button { background: #27272a; border-color: #3f3f46; color: #d4d4d8; font-size: 12px; padding: 3px 10px; box-shadow: none; }
        .dark .fc .fc-button:hover { background: #3f3f46; border-color: #52525b; }
        .dark .fc .fc-button:focus { box-shadow: none !important; }
        .dark .fc .fc-button-primary:not(:disabled).fc-button-active,
        .dark .fc .fc-button-primary:not(:disabled):active { background: #52525b !important; border-color: #71717a !important; }
        .dark .fc .fc-day-today .fc-daygrid-day-frame { background: #1c1917 !important; }
        .dark .fc .fc-day-today .fc-daygrid-day-number { color: #fbbf24 !important; font-weight: 600; }
        .fc-daygrid-day-events { min-height: 14px !important; }

        .fc-day-pw { position: relative; }
        .fc-day-pw::after {
          content: "";
          position: absolute;
          bottom: 3px; left: 3px; right: 3px;
          height: 3px; border-radius: 2px;
          transition: opacity 0.15s;
        }
        .fc-day-pw:hover::after { opacity: 0.8; }
        .fc-day-show::after { background: #22c55e; }
        .fc-day-descarga::after { background: #ef4444; }
        .fc-day-carga::after { background: #f97316; }
        .fc-day-peak::after { background: #a855f7; }
        .dark .fc-day-show::after { background: #4ade80; }
        .dark .fc-day-descarga::after { background: #f87171; }
        .dark .fc-day-carga::after { background: #fb923c; }
        .dark .fc-day-peak::after { background: #c084fc; }

        .fc-day-selected .fc-daygrid-day-frame {
          outline: 2px solid #6366f1;
          outline-offset: -2px;
          border-radius: 6px;
        }
        .dark .fc-day-selected .fc-daygrid-day-frame { background: rgba(99,102,241,0.06) !important; }
        .fc-day-selected .fc-daygrid-day-number { color: #6366f1 !important; font-weight: 600; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 300px; } }

        .fc-animate-fade { animation: fadeIn 0.2s ease-out; }
        .fc-animate-in { animation: fadeIn 0.25s ease-out; }
        .fc-animate-up { animation: fadeInUp 0.25s ease-out; }
        .fc-animate-scale { animation: scaleIn 0.2s ease-out; }
        .fc-animate-slide { animation: slideDown 0.3s ease-out; overflow: hidden; }

        .fc .fc-daygrid-day-frame {
          transition: background 0.2s, outline 0.15s, border-radius 0.15s !important;
        }
        .fc-day-pw { position: relative; }
        .fc-day-pw::after {
          content: "";
          position: absolute;
          bottom: 3px; left: 3px; right: 3px;
          height: 3px; border-radius: 2px;
          transition: opacity 0.2s, height 0.2s;
        }
        .fc-day-pw:hover::after { opacity: 0.8; height: 4px; }
        .fc-day-pw .fc-pw-marker-event {
          animation: fadeIn 0.3s ease-out;
        }
        .fc-pw-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          display: inline-block;
          margin: 0 0.5px;
          transition: transform 0.2s;
        }
        .fc-day-pw:hover .fc-pw-dot { transform: scale(1.4); }
      `}</style>

      <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-3">
        <div className="flex items-center justify-between mb-1 relative">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {MARKERS.map((m) => (
              <button key={m.id}
                onClick={() => { if (selectedDate) toggleMarkerOnDay(m.id); }}
                style={{
                  backgroundColor: selectedDate ? m.color + "0d" : "transparent",
                  color: selectedDate ? m.color : m.color + "66",
                  borderColor: selectedDate ? m.color + "44" : m.color + "22",
                  opacity: selectedDate ? 0.85 : 0.35,
                  cursor: selectedDate ? "pointer" : "default",
                }}
                title={m.desc + (selectedDate ? " (click para toggle)" : " (selecciona un día primero)")}
                className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all duration-150 hover:opacity-100">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {date && (
              <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 tabular-nums whitespace-nowrap bg-gray-100 dark:bg-gray-700/50 px-2 py-0.5 rounded-full">
                {days.length} días
              </span>
            )}
            <button onClick={() => setShowInfo(!showInfo)}
              className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 text-white hover:from-indigo-500 hover:to-indigo-700 flex items-center justify-center transition-all flex-shrink-0 shadow-sm"
              title="¿Cómo funciona?">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </button>
            <button onClick={generatePeakWeek}
              className="text-[10px] font-medium text-brand-600 bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/40 px-2.5 py-1 rounded-lg border border-brand-200 dark:border-brand-800 transition-all whitespace-nowrap"
              title="Genera 7 días antes del Show day">
              Generar Peak Week
            </button>
          </div>
        </div>
      </div>

      {showInfo && (
        <div className="fc-animate-up mb-3 p-4 rounded-xl bg-gradient-to-b from-indigo-50 to-white dark:from-indigo-900/15 dark:to-gray-900/50 border border-indigo-200 dark:border-indigo-800/50 text-[10px] space-y-2 shadow-sm">
          <p className="font-semibold text-indigo-600 dark:text-indigo-400">¿Cómo usar el Peak Week Editor?</p>
          <ul className="text-gray-600 dark:text-gray-400 space-y-1 list-disc pl-4">
            <li><strong>Click en día futuro</strong> → lo agrega a la semana de competencia con fase asignada automáticamente</li>
            <li><strong>Click en día existente</strong> → abre modal para editar marcadores, notas y datos de la competencia</li>
            <li>La <strong>barra de color</strong> al pie del día indica su fase (verde=Show, rojo=Descarga, naranja=Carga, morado=Peak)</li>
            <li>Los <strong>puntos de colores</strong> sobre el día son los marcadores activos</li>
            <li>Los marcadores de arriba se activan/desactivan SOLO si hay un día seleccionado</li>
          </ul>
          <p className="font-semibold text-indigo-600 dark:text-indigo-400 pt-1.5 border-t border-indigo-200 dark:border-indigo-800/50">Recomendaciones</p>
          <ul className="text-gray-600 dark:text-gray-400 space-y-1 list-disc pl-4">
            <li>Usa los días <strong>Descarga</strong> para bajar carbos, subir sodio+agua (programados por defecto)</li>
            <li>Los días <strong>Carga</strong> aumentan carbos y reducen sodio+agua progresivamente</li>
            <li>La <strong>puesta a punto</strong> debe probarse antes del show real</li>
            <li><strong>Nunca</strong> hacer restricción total de agua — solo reducción progresiva</li>
          </ul>
        </div>
      )}

      <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm mb-3">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: "title", center: "", right: "prev,next" }}
        events={days.map((d) => {
          const isLast = days.indexOf(d) === days.length - 1;
          return {
            id: d.date,
            title: "",
            start: d.date,
            allDay: true,
            classNames: ["fc-pw-marker-event"],
            display: "list-item",
            extendedProps: { isLast, notes: d.notes, showName: isLast ? name : "" },
          };
        })}
        eventContent={(arg) => {
          const { isLast, notes, showName } = arg.event.extendedProps as { isLast: boolean; notes: string; showName: string };
          const day = days.find((d) => d.date === arg.event.startStr);
          const hasMarkers = day?.markers.length;
          const isInicio = day?.markers.includes("inicio_competencia");
          const hasShowMarker = day?.markers.includes("show_day");
          const showLabel = isInicio ? "INICIO PREP" : (hasShowMarker && isLast) ? (showName || "SHOW") : "";
          const note = notes?.trim() ? notes.trim().slice(0, 20) + (notes.length > 20 ? "…" : "") : "";
          const parts: string[] = [];
          if (hasMarkers) {
            const dots = day!.markers.map((id) => {
              const m = MARKERS.find((x) => x.id === id);
              return m ? `<span class="fc-pw-dot" style="background:${m.color}" title="${m.desc}"></span>` : "";
            }).join("");
            parts.push(`<div style="display:flex;gap:1px;flex-wrap:wrap;padding:0 2px">${dots}</div>`);
          }
          if (showLabel) {
            parts.push(`<div style="font-size:6px;font-weight:700;color:#22c55e;text-align:center;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 1px">${showLabel}</div>`);
          }
          if (note) {
            parts.push(`<div style="font-size:5.5px;color:#9ca3af;text-align:center;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 1px">${note}</div>`);
          }
          return { html: parts.join("") };
        }}
        dayCellContent={(arg) => {
          const day = days.find((d) => d.date === arg.dateStr);
          const sel = arg.dateStr === selectedDate;
          const style = sel ? ' style="color:#6366f1;font-weight:600"' : "";
          return { html: `<span class="fc-daygrid-day-number"${style}>${arg.dayNumberText}</span>` };
        }}
        dateClick={(info: DateClickArg) => toggleDay(info.dateStr)}
        height="auto"
        locale="es"
        firstDay={1}
        dayCellClassNames={(arg) => {
          const day = days.find((d) => d.date === arg.dateStr);
          if (!day) return [];
          const sel = arg.dateStr === selectedDate ? "fc-day-selected" : "";
          return [`fc-day-pw fc-day-${day.phase.toLowerCase()}`, sel].filter(Boolean);
        }}
      />
      </div>

      {days.length > 0 && (
        <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm mb-3 overflow-x-auto">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-1.5 pr-2 font-medium uppercase tracking-wider">Día</th>
                <th className="text-left py-1.5 pr-2 font-medium uppercase tracking-wider">Fase</th>
                <th className="text-right py-1.5 pr-2 font-medium uppercase tracking-wider w-16" style={{ color: "#f87171" }}>Prot</th>
                <th className="text-right py-1.5 pr-2 font-medium uppercase tracking-wider w-16" style={{ color: "#fbbf24" }}>Carbs</th>
                <th className="text-right py-1.5 pr-2 font-medium uppercase tracking-wider w-16" style={{ color: "#60a5fa" }}>Fat</th>
                <th className="text-right py-1.5 font-medium uppercase tracking-wider w-16 text-gray-400 dark:text-gray-500">Kcal</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => (
                <tr key={d.date} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                  <td className="py-1.5 pr-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {new Date(d.date + "T12:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric" })}
                  </td>
                  <td className="py-1.5 pr-2">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm inline-block min-w-[60px] text-center"
                      style={{
                        background: d.phase === "Descarga" ? "linear-gradient(135deg, #fef2f2, #fee2e2)" : d.phase === "Carga" ? "linear-gradient(135deg, #fff7ed, #ffedd5)" : d.phase === "Show" ? "linear-gradient(135deg, #f0fdf4, #dcfce7)" : "linear-gradient(135deg, #faf5ff, #f3e8ff)",
                        color: d.phase === "Descarga" ? "#dc2626" : d.phase === "Carga" ? "#ea580c" : d.phase === "Show" ? "#16a34a" : "#9333ea",
                        border: d.phase === "Descarga" ? "1px solid #fecaca" : d.phase === "Carga" ? "1px solid #fed7aa" : d.phase === "Show" ? "1px solid #bbf7d0" : "1px solid #e9d5ff",
                      }}>
                      {d.phase}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2">
                    <input type="number" step="1" value={d.protein ?? ""} placeholder="—"
                      onChange={(e) => {
                        const val = e.target.value === "" ? undefined : Number(e.target.value);
                        setDays((prev) => {
                          const next = prev.map((day) => day.date === d.date ? { ...day, protein: val as any } : day);
                          emit(next);
                          return next;
                        });
                      }}
                      className="w-14 text-right text-[10px] px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800/30 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-red-300/40 transition-all" />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input type="number" step="1" value={d.carbs ?? ""} placeholder="—"
                      onChange={(e) => {
                        const val = e.target.value === "" ? undefined : Number(e.target.value);
                        setDays((prev) => {
                          const next = prev.map((day) => day.date === d.date ? { ...day, carbs: val as any } : day);
                          emit(next);
                          return next;
                        });
                      }}
                      className="w-14 text-right text-[10px] px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/30 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-300/40 transition-all" />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input type="number" step="1" value={d.fat ?? ""} placeholder="—"
                      onChange={(e) => {
                        const val = e.target.value === "" ? undefined : Number(e.target.value);
                        setDays((prev) => {
                          const next = prev.map((day) => day.date === d.date ? { ...day, fat: val as any } : day);
                          emit(next);
                          return next;
                        });
                      }}
                      className="w-14 text-right text-[10px] px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800/30 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-300/40 transition-all" />
                  </td>
                  <td className="py-1.5 text-right">
                    <span className="inline-block text-[9px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 min-w-[50px] text-right">
                      {(d.protein || 0) * 4 + (d.carbs || 0) * 4 + (d.fat || 0) * 9 || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-2.5 mb-1 flex items-center gap-2">
        <button onClick={() => setShowGuide(!showGuide)}
          className="text-[9px] font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-all flex items-center gap-1.5 bg-gray-100/50 dark:bg-gray-800/30 px-2.5 py-1 rounded-lg hover:bg-gray-200/50 dark:hover:bg-gray-700/50">
          <span className="text-[10px]">{showGuide ? "▼" : "▶"}</span>
          Protocolo peak week
        </button>
      </div>

      {showGuide && (
        <div className="fc-animate-up mb-3 p-4 rounded-xl bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 border border-gray-200 dark:border-gray-700 text-[10px] space-y-2.5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <p className="font-semibold text-gray-600 dark:text-gray-300">Mecanismo clave: Aldosterona</p>
          </div>
          <p className="text-gray-500 dark:text-gray-400 pl-4">↑ sodio + agua en Fase 1 → el cuerpo ↓ la aldosterona (hormona que retiene líquidos).<br />
          Como la aldosterona ya está baja en Fase 2, al ↓ sodio+agua progresivamente no hay retención y el agua subcutánea se elimina sin daño.</p>
          <div className="flex items-center gap-2 pt-1 border-t border-gray-200 dark:border-gray-700">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <p className="font-semibold text-gray-600 dark:text-gray-300">Reglas clave</p>
          </div>
          <ul className="text-gray-500 dark:text-gray-400 space-y-1 list-disc pl-4">
            <li><strong>Nunca</strong> restricción total de agua — solo reducción progresiva</li>
            <li>↑ proteínas en Descarga (anti-catabolismo) / ↓ proteínas en Carga (optimizar carga glucógeno)</li>
            <li>Entrenar volumen sin fallo en Descarga / NO entrenar en Carga (solo poses)</li>
            <li>Probar estrategia de carga en <strong>puesta a punto</strong> con antelación (cada organismo responde distinto)</li>
          </ul>
        </div>
      )}

      {showModal && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm fc-animate-fade" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-5 w-full max-w-sm mx-4 fc-animate-scale" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
              </h4>
              {selDay ? selDay.markers.includes("inicio_competencia") ?
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-100 to-emerald-200 dark:from-emerald-900/50 dark:to-emerald-800/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 shadow-sm">
                  INICIO PREP
                </span>
              : selDay.markers.includes("show_day") ?
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-green-100 to-green-200 dark:from-green-900/50 dark:to-green-800/50 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 shadow-sm">
                  SHOW
                </span>
              :
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border shadow-sm"
                  style={{
                    background: selDay.phase === "Descarga" ? "linear-gradient(135deg, #fef2f2, #fee2e2)" : selDay.phase === "Carga" ? "linear-gradient(135deg, #fff7ed, #ffedd5)" : "linear-gradient(135deg, #faf5ff, #f3e8ff)",
                    color: selDay.phase === "Descarga" ? "#dc2626" : selDay.phase === "Carga" ? "#ea580c" : "#9333ea",
                    borderColor: selDay.phase === "Descarga" ? "#fecaca" : selDay.phase === "Carga" ? "#fed7aa" : "#e9d5ff",
                  }}>
                  {selDay.phase}
                </span>
              : null}
            </div>

            {selDay && selDay.markers.includes("inicio_competencia") ? (
              <div className="mb-4 p-3 rounded-xl bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-900/15 dark:to-gray-900/50 border border-emerald-200 dark:border-emerald-800/50 text-[9px] text-gray-500 dark:text-gray-400 shadow-sm">
                <p><strong className="text-emerald-600 dark:text-emerald-400">Inicio de preparación</strong> — Marcador de referencia. Este día se cargan los macros base del cliente como punto de partida.</p>
              </div>
            ) : protocol && (
              <div className="mb-4 space-y-1.5 p-3 rounded-xl bg-gradient-to-b from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-800/30 border border-gray-200 dark:border-gray-700 text-[9px] text-gray-500 dark:text-gray-400 shadow-sm">
                <p><strong className="text-gray-600 dark:text-gray-300">Aldosterona:</strong> {protocol.aldosterone}</p>
                <p><strong className="text-gray-600 dark:text-gray-300">Proteínas:</strong> {protocol.protein}</p>
                <p><strong className="text-gray-600 dark:text-gray-300">Entrenamiento:</strong> {protocol.training}</p>
              </div>
            )}

            {isShow && (
              <div className="mb-4 p-3.5 rounded-xl bg-gradient-to-b from-green-50 to-white dark:from-green-900/15 dark:to-gray-900/50 border border-green-200 dark:border-green-800/50 text-center shadow-sm">
                <span className="text-sm font-bold text-green-700 dark:text-green-300">{name || "SHOW"}</span>
                <p className="text-[10px] text-gray-400 mt-0.5">Día del show</p>
              </div>
            )}

            {selDay && selDay.markers.includes("show_day") && (
              <div className="mb-4 p-3 rounded-xl bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-900/15 dark:to-gray-900/50 border border-emerald-200 dark:border-emerald-800/50 shadow-sm">
                <input type="text" placeholder="Nombre de la competencia" value={name}
                  onChange={(e) => { setName(e.target.value); emit(days, { name: e.target.value }); }}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all" />
              </div>
            )}

            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5">Marcadores</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {MARKERS.map((m) => {
                const active = selDay?.markers.includes(m.id) ?? false;
                return (
                  <button key={m.id} onClick={() => toggleMarkerOnDay(m.id)}
                    title={m.desc}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all duration-150 active:scale-[0.97]"
                    style={{
                      background: active ? `linear-gradient(135deg, ${m.color}, ${m.color}dd)` : "transparent",
                      color: active ? "#fff" : m.color,
                      borderColor: active ? m.color : m.color + "44",
                      boxShadow: active ? `0 1px 3px ${m.color}44` : "none",
                    }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.color }} />
                    {m.label}
                  </button>
                );
              })}
            </div>
            {selDay && (<><div className="mb-4 p-3.5 rounded-xl bg-gradient-to-b from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-800/30 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Macros del día</p>
                <span className="text-[9px] font-medium tabular-nums px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
                  {selDay.protein && selDay.carbs && selDay.fat
                    ? `${selDay.protein * 4 + selDay.carbs * 4 + selDay.fat * 9} kcal`
                    : (selDay.protein || 0) * 4 + (selDay.carbs || 0) * 4 + (selDay.fat || 0) * 9 > 0
                      ? `${(selDay.protein || 0) * 4 + (selDay.carbs || 0) * 4 + (selDay.fat || 0) * 9} kcal` : ""}
                </span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <p className="text-[9px] font-medium text-gray-500 dark:text-gray-400">Proteína</p>
                  </div>
                  <div className="relative">
                    <input type="number" step="1" placeholder="—" value={selDay.protein ?? ""}
                      onChange={(e) => setMacros("protein", e.target.value === "" ? undefined! : Number(e.target.value))}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-red-300/40 focus:border-red-300 dark:focus:border-red-700 transition-all" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-600 pointer-events-none">g</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <p className="text-[9px] font-medium text-gray-500 dark:text-gray-400">Carbos</p>
                  </div>
                  <div className="relative">
                    <input type="number" step="1" placeholder="—" value={selDay.carbs ?? ""}
                      onChange={(e) => setMacros("carbs", e.target.value === "" ? undefined! : Number(e.target.value))}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-300/40 focus:border-amber-300 dark:focus:border-amber-700 transition-all" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-600 pointer-events-none">g</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <p className="text-[9px] font-medium text-gray-500 dark:text-gray-400">Grasa</p>
                  </div>
                  <div className="relative">
                    <input type="number" step="1" placeholder="—" value={selDay.fat ?? ""}
                      onChange={(e) => setMacros("fat", e.target.value === "" ? undefined! : Number(e.target.value))}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300/40 focus:border-blue-300 dark:focus:border-blue-700 transition-all" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-600 pointer-events-none">g</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative mb-4">
              <input type="text" placeholder="Notas del día" value={selDay.notes}
                onChange={(e) => {
                  setDays((prev) => {
                    const next = prev.map((d) => d.date === selectedDate ? { ...d, notes: e.target.value } : d);
                    emit(next);
                    return next;
                  });
                }}
                className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400/30 transition-all" />
            </div>
            </>)}
            {selDay && (
            <div className="flex items-center gap-2 mt-2">
              {!isShow && (
                <button onClick={() => removeDay(selDay.date)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-[0.97]">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  Eliminar día
                </button>
              )}
              {isShow && days.length > 1 && (
                <button onClick={() => { setDays([]); setDate(""); setShowModal(false); emit([]); }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-[0.97]">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  Eliminar todo
                </button>
              )}
              <button onClick={() => setShowModal(false)}
                className="ml-auto inline-flex items-center gap-1 px-4 py-1.5 rounded-lg text-[10px] font-medium bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-700/50 text-gray-500 dark:text-gray-400 hover:from-gray-200 hover:to-gray-300 dark:hover:from-gray-600 dark:hover:to-gray-600/50 transition-all active:scale-[0.97] shadow-sm">
                Cerrar
              </button>
            </div>
            )}
            {!selDay && (
            <div className="flex items-center gap-2 mt-4">
              <button onClick={() => setShowModal(false)}
                className="ml-auto inline-flex items-center gap-1 px-4 py-1.5 rounded-lg text-[10px] font-medium bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-700/50 text-gray-500 dark:text-gray-400 hover:from-gray-200 hover:to-gray-300 dark:hover:from-gray-600 dark:hover:to-gray-600/50 transition-all active:scale-[0.97] shadow-sm">
                Cerrar
              </button>
            </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mr-1">Fases</span>
        {PHASES.map((p) => (
          <span key={p.id} className="flex-shrink-0 flex items-center gap-1.5 text-[9px] font-medium text-gray-500 dark:text-gray-400" title={p.desc}>
            <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: p.color }} />
            {p.id}
          </span>
        ))}
        <span className="w-px h-3 bg-gray-200 dark:bg-gray-700 mx-1" />
        <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mr-1">Marcadores</span>
        {MARKERS.map((m) => (
          <span key={m.id} className="flex-shrink-0 flex items-center gap-1.5 text-[9px] font-medium text-gray-500 dark:text-gray-400" title={m.desc}>
            <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: m.color }} />
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}
