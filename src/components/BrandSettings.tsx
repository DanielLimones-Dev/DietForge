"use client";

import { useState, type ChangeEvent } from "react";
import { Leaf, Palette, RotateCcw, Upload, Check } from "lucide-react";
import {
  BRAND_COLOR_PRESETS,
  DEFAULT_BRAND,
  useWhiteLabel,
  type BrandConfig,
} from "@/lib/white-label";

export function BrandSettings() {
  const { brand, saveBrand, resetBrand } = useWhiteLabel();
  const [draft, setDraft] = useState<BrandConfig>(brand);
  const [syncedBrand, setSyncedBrand] = useState<BrandConfig>(brand);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  if (brand !== syncedBrand) {
    setSyncedBrand(brand);
    setDraft(brand);
  }

  const handleLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    setError("");
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecciona una imagen PNG, JPG, WebP o SVG.");
      return;
    }
    if (file.size > 250_000) {
      setError("El logo debe pesar menos de 250 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setDraft((prev) => ({ ...prev, logoDataUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    setError("");
    saveBrand(draft);
    setStatus("Marca blanca aplicada en el panel y portal.");
  };

  const handleReset = () => {
    setError("");
    resetBrand();
    setDraft(DEFAULT_BRAND);
    setStatus("Se restauró la marca original de DietForge.");
  };

  return (
    <section className="care-card" aria-labelledby="brand-settings-title">
      <div className="care-heading">
        <div>
          <p className="df-eyebrow">MARCA BLANCA</p>
          <h2 id="brand-settings-title">Identidad de tu coaching</h2>
          <p>Personaliza el nombre, logo y color principal que ven tus clientes en el panel y en su portal.</p>
        </div>
        <button type="button" onClick={handleReset} className="df-button-secondary">
          <RotateCcw size={14} aria-hidden="true" />
          Restaurar DietForge
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <label htmlFor="brand-name-input">
          Nombre de tu marca
          <input
            id="brand-name-input"
            type="text"
            maxLength={40}
            value={draft.brandName}
            onChange={(e) => setDraft((prev) => ({ ...prev, brandName: e.target.value }))}
            placeholder="Ej. Limones Coaching"
          />
        </label>

        <label htmlFor="brand-tagline-input">
          Etiqueta o subtítulo
          <input
            id="brand-tagline-input"
            type="text"
            maxLength={28}
            value={draft.tagline}
            onChange={(e) => setDraft((prev) => ({ ...prev, tagline: e.target.value }))}
            placeholder="Ej. PRO o Nutrición Clínica"
          />
        </label>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5 mb-2">
          <Palette size={14} aria-hidden="true" />
          Color principal
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {BRAND_COLOR_PRESETS.map((preset) => {
            const active = draft.accentColor.toLowerCase() === preset.hex;
            return (
              <button
                key={preset.hex}
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, accentColor: preset.hex }))}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  active
                    ? "border-gray-900 dark:border-white font-semibold"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border border-black/10"
                  style={{ backgroundColor: preset.hex }}
                  aria-hidden="true"
                />
                {preset.name}
              </button>
            );
          })}
          <label htmlFor="brand-color-picker" className="inline-flex items-center gap-2 text-xs ml-1">
            Personalizado
            <input
              id="brand-color-picker"
              type="color"
              value={draft.accentColor}
              onChange={(e) => setDraft((prev) => ({ ...prev, accentColor: e.target.value }))}
              className="w-9 h-8 p-0.5 rounded border border-gray-300 cursor-pointer"
            />
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div
          className="inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
          aria-label="Vista previa de marca"
        >
          <span
            className="w-9 h-9 rounded-lg grid place-content-center text-white overflow-hidden shrink-0"
            style={{ backgroundColor: draft.accentColor }}
          >
            {draft.logoDataUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={draft.logoDataUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Leaf size={19} aria-hidden="true" />
            )}
          </span>
          <span className="font-semibold text-sm dark:text-white">
            {draft.brandName.trim() || DEFAULT_BRAND.brandName}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-500">
            {draft.tagline.trim() || DEFAULT_BRAND.tagline}
          </span>
        </div>

        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
          <Upload size={14} aria-hidden="true" />
          Subir logo (PNG/JPG/SVG)
          <input type="file" accept="image/*" onChange={handleLogoUpload} className="sr-only" />
        </label>

        {draft.logoDataUrl && (
          <button
            type="button"
            onClick={() => setDraft((prev) => ({ ...prev, logoDataUrl: "" }))}
            className="text-xs text-red-600 hover:underline"
          >
            Quitar logo
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-600 mt-3">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="text-xs text-emerald-700 dark:text-emerald-400 mt-3 flex items-center gap-1.5">
          <Check size={14} aria-hidden="true" />
          {status}
        </p>
      )}

      <div className="mt-5">
        <button type="button" onClick={handleSave} className="df-button">
          Guardar marca blanca
        </button>
      </div>
    </section>
  );
}
