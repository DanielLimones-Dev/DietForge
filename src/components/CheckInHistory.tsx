import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/db";
import { calculateWeightTrend, getRateLabel } from "@/lib/trends";
import { checkWeightRate } from "@/lib/alerts";
import { TrendingUp, AlertTriangle, Info, Camera, X, ChevronUp, ChevronDown, Minus, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";

function fmtDate(d: string): string {
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}
import type { CheckIn, CompetitionPhase, BodyMeasurements, PhotoRef } from "@/types";

interface Props {
  clientId: number;
  phase?: CompetitionPhase;
  onEdit?: (checkin: CheckIn) => void;
  onDelete?: (id: number) => void;
}

function Delta({ val, suffix = "" }: { val: number | null | undefined; suffix?: string }) {
  if (val == null) return null;
  const Icon = val > 0 ? ChevronUp : val < 0 ? ChevronDown : Minus;
  const color = val !== 0 ? "text-gray-500 dark:text-gray-400" : "text-gray-400";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {Math.abs(val).toFixed(1)}{suffix}
    </span>
  );
}

export function CheckInHistory({ clientId, phase, onEdit, onDelete }: Props) {
  const [checkins, setCheckins] = useState<CheckIn[]>(() => db.getCheckIns(clientId));
  const [selected, setSelected] = useState<CheckIn | null>(null);
  const [feedback, setFeedback] = useState("");
  const [photoViewer, setPhotoViewer] = useState<{ photos: PhotoRef[]; index: number } | null>(null);

  const goPhoto = useCallback((dir: number) => {
    setPhotoViewer((prev) => {
      if (!prev) return null;
      const next = prev.index + dir;
      if (next < 0 || next >= prev.photos.length) return prev;
      return { ...prev, index: next };
    });
  }, []);

  useEffect(() => {
    if (!photoViewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPhotoViewer(null);
      if (e.key === "ArrowLeft") goPhoto(-1);
      if (e.key === "ArrowRight") goPhoto(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photoViewer, goPhoto]);
  const [detailView, setDetailView] = useState<CheckIn | null>(null);

  const trend = calculateWeightTrend(checkins);
  const alert = phase ? checkWeightRate(trend.weeklyChangePercent, phase) : null;

  const handleSaveFeedback = (id: number) => {
    db.updateCheckIn(id, { coach_feedback: feedback });
    setCheckins(db.getCheckIns(clientId));
    setFeedback("");
  };

  const prevCheckin = detailView ? checkins[checkins.indexOf(detailView) + 1] : null;

  const measureLabels: Record<string, string> = {
    neck: "Cuello", shoulders: "Hombros", chest: "Pecho", waist: "Cintura",
    hips: "Cadera", left_arm: "Brazo Izq", right_arm: "Brazo Der",
    left_thigh: "Muslo Izq", right_thigh: "Muslo Der",
    left_calf: "Pantorrilla Izq", right_calf: "Pantorrilla Der",
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="font-semibold flex items-center gap-2 mb-4 dark:text-white">
        <TrendingUp className="w-4 h-4 text-brand-600" />
        Check-ins
        <span className="text-xs text-gray-400 font-normal ml-auto">{checkins.length} registros</span>
      </h3>

      {trend.weeklyChange !== null && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-lg font-bold dark:text-white">{trend.rollingAverage7 ?? "—"}</p>
            <p className="text-[10px] text-gray-400">Prom 7d (kg)</p>
          </div>
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className={`text-lg font-bold ${(trend.weeklyChange ?? 0) < 0 ? "text-green-600" : (trend.weeklyChange ?? 0) > 0 ? "text-red-600" : ""}`}>
              {(trend.weeklyChange ?? 0) > 0 ? "+" : ""}{trend.weeklyChange?.toFixed(1)} kg
            </p>
            <p className="text-[10px] text-gray-400">Cambio semanal</p>
          </div>
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-lg font-bold dark:text-white">{getRateLabel(trend.weeklyChangePercent)}</p>
            <p className="text-[10px] text-gray-400">Ritmo</p>
          </div>
        </div>
      )}

      {alert && (
        <div className={`flex items-start gap-2 p-3 rounded-lg mb-4 text-sm ${
          alert.type === "danger" ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400" :
          alert.type === "warning" ? "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400" :
          "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
        }`}>
          {alert.type === "danger" ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> : <Info className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{alert.message}</span>
        </div>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {checkins.map((c) => {
          const photos = db.getPhotosForCheckIn(c.id);
          return (
            <div key={c.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors" onClick={() => setDetailView(c)}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium dark:text-white">{fmtDate(c.date)}</p>
                <span className="text-sm font-bold dark:text-white">{c.weight} kg</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                {c.body_fat && <span>BF: {c.body_fat}%</span>}
                {photos.length > 0 && <span className="flex items-center gap-1"><Camera className="w-3 h-3" />{photos.length}</span>}
                {c.adherence && <span>Adh: {Math.round((c.adherence.meals + c.adherence.supplements + c.adherence.training + c.adherence.cardio) / 4)}%</span>}
                {onEdit && (
                  <button onClick={(e) => { e.stopPropagation(); onEdit(c); }} className="text-gray-400 hover:text-brand-600 ml-1" title="Editar check-in">
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
                {onDelete && (
                  <button onClick={(e) => { e.stopPropagation(); if (confirm("¿Eliminar este check-in?")) onDelete(c.id); }} className="text-gray-400 hover:text-red-500 ml-1" title="Eliminar check-in">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); setSelected(c); setFeedback(c.coach_feedback ?? ""); }} className="text-brand-600 hover:underline ml-auto">
                    {c.coach_feedback ? "Editar feedback" : "Feedback"}
                  </button>
              </div>
              {c.coach_feedback && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">Coach: {c.coach_feedback}</p>
              )}
            </div>
          );
        })}
        {checkins.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">Aún no hay check-ins. Crea el primero.</p>
        )}
      </div>

      {detailView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto" onClick={() => setDetailView(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-lg mx-4 my-8 max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold dark:text-white">Check-in • {fmtDate(detailView.date)}</h4>
              <div className="flex items-center gap-1">
                {onEdit && (
                  <button onClick={() => { onEdit(detailView); setDetailView(null); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-brand-600" title="Editar check-in">
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                {onDelete && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { if (confirm("¿Eliminar este check-in?")) { onDelete(detailView.id); setDetailView(null); } }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-red-500" title="Eliminar check-in">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <button onClick={() => setDetailView(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><X className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                <p className="text-lg font-bold dark:text-white">{detailView.weight} kg</p>
                <p className="text-[10px] text-gray-400">Peso</p>
                {prevCheckin && <Delta val={detailView.weight - prevCheckin.weight} suffix=" kg" />}
              </div>
              {detailView.body_fat != null && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                  <p className="text-lg font-bold dark:text-white">{detailView.body_fat}%</p>
                  <p className="text-[10px] text-gray-400">Grasa corporal</p>
                  {prevCheckin?.body_fat != null && <Delta val={detailView.body_fat - prevCheckin.body_fat} suffix="%" />}
                </div>
              )}
            </div>

            {detailView.measurements && Object.keys(detailView.measurements as Record<string, unknown>).length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Mediciones</p>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(detailView.measurements as Record<string, number>) as [keyof BodyMeasurements, number][]).map(([k, v]) => {
                    const prevVal = prevCheckin?.measurements?.[k];
                    const label = measureLabels[k as string] || k;
                    return (
                      <div key={String(k)} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs">
                        <span className="text-gray-600 dark:text-gray-400">{label}</span>
                        <span className="dark:text-white font-medium">{v} cm</span>
                        {prevVal != null && <Delta val={(v as number) - prevVal} suffix=" cm" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(() => {
              const photos = db.getPhotosForCheckIn(detailView.id);
              if (photos.length === 0) return null;
              const angleLabels: Record<string, string> = {
                front_relaxed: "Front", back_relaxed: "Back",
                front_double_biceps: "Front DB", back_lat_spread: "Back Lat",
                side_chest: "Side Chest", side_triceps: "Side Tri",
                ab_thigh: "Ab & Thigh", most_muscular: "Most Muscular",
              };
              return (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Fotos ({photos.length})</p>
                  <div className="grid grid-cols-2 gap-2">
                    {photos.map((p, i) => (
                      <div key={p.id} className="relative cursor-pointer" onClick={() => setPhotoViewer({ photos, index: i })}>
                        <img src={p.data} alt={p.angle} className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity" />
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 text-[9px] text-white rounded">{angleLabels[p.angle] || p.angle}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {detailView.adherence && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Adherencia</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {[
                    { label: "Comidas", val: detailView.adherence.meals },
                    { label: "Suplementos", val: detailView.adherence.supplements },
                    { label: "Entreno", val: detailView.adherence.training },
                    { label: "Cardio", val: detailView.adherence.cardio },
                  ].map((f) => (
                    <span key={f.label} className="text-gray-600 dark:text-gray-400">{f.label}: <strong className="dark:text-white">{f.val}%</strong></span>
                  ))}
                  {[
                    { label: "Energía", val: detailView.adherence.energy },
                    { label: "Sueño", val: detailView.adherence.sleep },
                    { label: "Hambre", val: detailView.adherence.hunger },
                    { label: "Libido", val: detailView.adherence.libido },
                    { label: "Digestión", val: detailView.adherence.digestion },
                  ].map((f) => (
                    <span key={f.label} className="text-gray-600 dark:text-gray-400">{f.label}: <strong className="dark:text-white">{f.val}/5</strong></span>
                  ))}
                </div>
              </div>
            )}

            {detailView.notes && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Notas</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">{detailView.notes}</p>
              </div>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Feedback del Coach</p>
              <textarea rows={3} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 mb-3"
                value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Escribe tu feedback..." />
              <div className="flex gap-2">
                <button onClick={() => { handleSaveFeedback(detailView.id); }} className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors">
                  Guardar feedback
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selected && !detailView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelected(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-md mx-4 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold mb-4 dark:text-white">Feedback del Coach</h4>
            <p className="text-xs text-gray-400 mb-2">Check-in del {fmtDate(selected.date)} — {selected.weight} kg</p>
            <textarea rows={4} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 mb-4"
              value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Escribe tu feedback para el cliente..." />
            <div className="flex gap-3">
              <button onClick={() => { handleSaveFeedback(selected.id); setSelected(null); }} className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors">
                Guardar
              </button>
              <button onClick={() => setSelected(null)} className="px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {photoViewer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85" onClick={() => setPhotoViewer(null)}>
          <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPhotoViewer(null)} className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors z-10">
              <X className="w-5 h-5" />
            </button>

            <p className="absolute top-4 left-4 px-3 py-1.5 bg-black/40 rounded-lg text-xs text-white/80 z-10">
              {photoViewer.index + 1} / {photoViewer.photos.length}
            </p>

            {photoViewer.index > 0 && (
              <button onClick={() => goPhoto(-1)} className="absolute left-4 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors z-10">
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <img
              src={photoViewer.photos[photoViewer.index].data}
              alt={photoViewer.photos[photoViewer.index].angle}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg animate-scale-in"
            />

            {photoViewer.index < photoViewer.photos.length - 1 && (
              <button onClick={() => goPhoto(1)} className="absolute right-4 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors z-10">
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/40 rounded-lg text-xs text-white/80">
              {photoViewer.photos[photoViewer.index].angle.replace(/_/g, " ")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
