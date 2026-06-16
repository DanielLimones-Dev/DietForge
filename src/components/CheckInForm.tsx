import { useState, useEffect } from "react";
import { db } from "@/lib/db";
import { Camera, Save, X } from "lucide-react";
import { useToast } from "./Toast";
import type { CheckIn, PhotoAngle } from "@/types";

const PHOTO_ANGLES: PhotoAngle[] = [
  "front_relaxed", "back_relaxed",
  "front_double_biceps", "back_lat_spread",
  "side_chest", "side_triceps",
  "ab_thigh", "most_muscular",
];

const ANGLE_LABELS: Record<PhotoAngle, string> = {
  front_relaxed: "Front Relaxed",
  back_relaxed: "Back Relaxed",
  front_double_biceps: "Front Double Biceps",
  back_lat_spread: "Back Lat Spread",
  side_chest: "Side Chest",
  side_triceps: "Side Triceps",
  ab_thigh: "Ab & Thigh",
  most_muscular: "Most Muscular",
};

interface Props {
  clientId: number;
  existing?: CheckIn;
  onSave: (checkin: CheckIn) => void;
  onCancel: () => void;
}

export function CheckInForm({ clientId, existing, onSave, onCancel }: Props) {
  const { toast } = useToast();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [date, setDate] = useState(todayStr);
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<{ angle: PhotoAngle; data: string }[]>([]);
  const [capturing, setCapturing] = useState<PhotoAngle | null>(null);
  const [adherence, setAdherence] = useState({
    meals: "100", supplements: "100", training: "100", cardio: "100",
    energy: "3", sleep: "3", hunger: "3", libido: "3", digestion: "3",
  });
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!existing) return;
    setDate(new Date(existing.date).toISOString().slice(0, 10));
    setWeight(String(existing.weight));
    setBodyFat(existing.body_fat ? String(existing.body_fat) : "");
    setMeasurements(existing.measurements ? Object.fromEntries(Object.entries(existing.measurements).map(([k, v]) => [k, String(v)])) : {});
    setPhotos(db.getPhotosForCheckIn(existing.id).map((p) => ({ angle: p.angle, data: p.data })));
    setAdherence(existing.adherence ? {
      meals: String(existing.adherence.meals),
      supplements: String(existing.adherence.supplements),
      training: String(existing.adherence.training),
      cardio: String(existing.adherence.cardio),
      energy: String(existing.adherence.energy),
      sleep: String(existing.adherence.sleep),
      hunger: String(existing.adherence.hunger),
      libido: String(existing.adherence.libido),
      digestion: String(existing.adherence.digestion),
    } : { meals: "100", supplements: "100", training: "100", cardio: "100", energy: "3", sleep: "3", hunger: "3", libido: "3", digestion: "3" });
    setNotes(existing.notes || "");
  }, [existing]);

  const measureFields = [
    { key: "neck", label: "Cuello" },
    { key: "shoulders", label: "Hombros" },
    { key: "chest", label: "Pecho" },
    { key: "waist", label: "Cintura" },
    { key: "hips", label: "Cadera" },
    { key: "left_arm", label: "Brazo Izq" },
    { key: "right_arm", label: "Brazo Der" },
    { key: "left_thigh", label: "Muslo Izq" },
    { key: "right_thigh", label: "Muslo Der" },
    { key: "left_calf", label: "Pantorrilla Izq" },
    { key: "right_calf", label: "Pantorrilla Der" },
  ];

  const handleCapture = (angle: PhotoAngle) => {
    setCapturing(angle);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) { setCapturing(null); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          const max = 800;
          if (w > max || h > max) {
            const ratio = Math.min(max / w, max / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, w, h);
          setPhotos((prev) => [...prev, { angle, data: canvas.toDataURL("image/jpeg", 0.7) }]);
          setCapturing(null);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleSave = () => {
    const errs: Record<string, string> = {};
    const w = Number(weight);
    if (!weight.trim()) errs.weight = "El peso es obligatorio";
    else if (!w || w < 20 || w > 500) errs.weight = "Peso inválido";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const meas = measurements;

    const checkinData: Omit<CheckIn, "id"> = {
      client_id: clientId,
      date: new Date(date).toISOString(),
      weight: w,
      body_fat: bodyFat ? Number(bodyFat) : undefined,
      measurements: Object.keys(meas).length > 0
        ? Object.fromEntries(
            Object.entries(meas).map(([k, v]) => [k, Number(v)] as const).filter(([, v]) => v > 0),
          )
        : undefined,
      photos: [],
      adherence: {
        meals: Number(adherence.meals),
        supplements: Number(adherence.supplements),
        training: Number(adherence.training),
        cardio: Number(adherence.cardio),
        energy: Number(adherence.energy),
        sleep: Number(adherence.sleep),
        hunger: Number(adherence.hunger),
        libido: Number(adherence.libido),
        digestion: Number(adherence.digestion),
      },
      notes,
    };

    let saved: CheckIn | undefined;
    if (existing) {
      saved = db.updateCheckIn(existing.id, checkinData);
      db.deletePhotosForCheckIn(existing.id);
    } else {
      saved = db.saveCheckIn(checkinData);
    }
    if (!saved) return;

    for (const p of photos) {
      try {
        db.savePhoto({ checkin_id: saved.id, angle: p.angle, data: p.data, date: saved.date });
      } catch { console.warn("Error al guardar foto"); }
    }

    db.updateNextCheckIn(clientId);

    toast(existing ? "Check-in actualizado" : "Check-in guardado correctamente");
    onSave(saved);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-2xl mx-4 my-8 max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold dark:text-white">{existing ? "Editar Check-in" : "Nuevo Check-in"}</h3>
          <button onClick={onCancel} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {Object.keys(errors).length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">Corrige los errores antes de guardar:</p>
            <ul className="mt-1 text-[11px] text-red-500 dark:text-red-400 list-disc list-inside">
              {Object.values(errors).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Fecha</label>
            <input type="date" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Peso (kg) <span className="text-red-500">*</span></label>
            <input type="number" step="0.1"
              className={`w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100 transition-colors ${errors.weight ? "border-red-500 dark:border-red-400 ring-2 ring-red-500/20" : "border-gray-300 dark:border-gray-600"}`}
              value={weight} onChange={(e) => { setWeight(e.target.value); setErrors((p) => { const n = { ...p }; delete n.weight; return n; }); }} />
            {errors.weight && <p className="text-[11px] text-red-500 dark:text-red-400 mt-1">{errors.weight}</p>}
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">% Grasa corporal</label>
            <input type="number" step="0.1" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} />
          </div>
        </div>

        <h4 className="text-sm font-semibold dark:text-white mb-3">Mediciones Corporales</h4>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-6">
          {measureFields.map((f) => (
            <div key={f.key}>
              <label className="block text-[10px] text-gray-400 dark:text-gray-500">{f.label} (cm)</label>
              <input type="number" step="0.1" className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs dark:bg-gray-800 dark:text-gray-100"
                value={measurements[f.key] ?? ""} onChange={(e) => setMeasurements({ ...measurements, [f.key]: e.target.value })} />
            </div>
          ))}
        </div>

        <h4 className="text-sm font-semibold dark:text-white mb-3">Fotos</h4>
        <div className="grid grid-cols-4 gap-2 mb-6">
          {PHOTO_ANGLES.map((angle) => {
            const captured = photos.find((p) => p.angle === angle);
            return (
              <button
                key={angle}
                onClick={() => handleCapture(angle)}
                disabled={capturing !== null}
                className={`p-2 rounded-lg border text-[10px] font-medium transition-colors ${
                  captured
                    ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                }`}
              >
                <Camera className="w-4 h-4 mx-auto mb-1" />
                {captured ? "✓ " : ""}{ANGLE_LABELS[angle].split(" ").slice(0, 2).join(" ")}
              </button>
            );
          })}
        </div>

        <h4 className="text-sm font-semibold dark:text-white mb-3">Adherencia</h4>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { key: "meals", label: "Comidas" },
            { key: "supplements", label: "Suplementos" },
            { key: "training", label: "Entreno" },
            { key: "cardio", label: "Cardio" },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-[10px] text-gray-400 dark:text-gray-500">{f.label} (0-100%)</label>
              <input type="number" min="0" max="100" className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs dark:bg-gray-800 dark:text-gray-100"
                value={adherence[f.key as keyof typeof adherence]} onChange={(e) => setAdherence({ ...adherence, [f.key]: e.target.value })} />
            </div>
          ))}
          {[
            { key: "energy", label: "Energía" },
            { key: "sleep", label: "Sueño" },
            { key: "hunger", label: "Hambre" },
            { key: "libido", label: "Libido" },
            { key: "digestion", label: "Digestión" },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-[10px] text-gray-400 dark:text-gray-500">{f.label} (1-5)</label>
              <select className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs dark:bg-gray-800 dark:text-gray-100"
                value={adherence[f.key as keyof typeof adherence]} onChange={(e) => setAdherence({ ...adherence, [f.key]: e.target.value })}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Notas del cliente</label>
          <textarea rows={3} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100"
            value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex gap-3">
          <button onClick={handleSave} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors">
            <Save className="w-4 h-4" /> Guardar Check-in
          </button>
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
