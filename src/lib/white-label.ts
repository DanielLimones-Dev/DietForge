"use client";

import { useEffect, useState } from "react";

export interface BrandConfig {
  brandName: string;
  tagline: string;
  accentColor: string;
  logoDataUrl: string;
}

export const DEFAULT_BRAND: BrandConfig = {
  brandName: "DietForge",
  tagline: "PRO",
  accentColor: "#007a54",
  logoDataUrl: "",
};

export const BRAND_COLOR_PRESETS = [
  { name: "Verde clínico", hex: "#007a54" },
  { name: "Azul océano", hex: "#0284c7" },
  { name: "Índigo", hex: "#4f46e5" },
  { name: "Terracota", hex: "#c2410c" },
  { name: "Borgoña", hex: "#be123c" },
  { name: "Grafito", hex: "#334155" },
] as const;

const STORAGE_KEY = "dietforge_whitelabel_v1";
const BRAND_EVENT = "dietforge-brand-change";

function darkenHex(hex: string, ratio = 0.2): string {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hex;
  const r = Math.max(0, Math.round(parseInt(clean.slice(0, 2), 16) * (1 - ratio)));
  const g = Math.max(0, Math.round(parseInt(clean.slice(2, 4), 16) * (1 - ratio)));
  const b = Math.max(0, Math.round(parseInt(clean.slice(4, 6), 16) * (1 - ratio)));
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

export function loadBrandConfig(): BrandConfig {
  if (typeof window === "undefined") return DEFAULT_BRAND;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BRAND;
    const parsed = JSON.parse(raw) as Partial<BrandConfig>;
    return {
      brandName: parsed.brandName?.trim() || DEFAULT_BRAND.brandName,
      tagline: parsed.tagline?.trim() || DEFAULT_BRAND.tagline,
      accentColor: /^#[0-9a-fA-F]{6}$/.test(parsed.accentColor ?? "")
        ? (parsed.accentColor as string)
        : DEFAULT_BRAND.accentColor,
      logoDataUrl: typeof parsed.logoDataUrl === "string" ? parsed.logoDataUrl : "",
    };
  } catch {
    return DEFAULT_BRAND;
  }
}

export function applyBrandTheme(config: BrandConfig): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isCustomColor = config.accentColor.toLowerCase() !== DEFAULT_BRAND.accentColor;
  const props = [
    "--clinical-primary",
    "--clinical-primary-strong",
    "--color-brand-600",
    "--color-brand-700",
    "--p-brand",
    "--p-brand-strong",
    "--p-fill",
    "--p-fill-strong",
  ];
  if (!isCustomColor) {
    props.forEach((p) => root.style.removeProperty(p));
    return;
  }
  const strong = darkenHex(config.accentColor, 0.2);
  root.style.setProperty("--clinical-primary", config.accentColor);
  root.style.setProperty("--clinical-primary-strong", strong);
  root.style.setProperty("--color-brand-600", config.accentColor);
  root.style.setProperty("--color-brand-700", strong);
  root.style.setProperty("--p-brand", config.accentColor);
  root.style.setProperty("--p-brand-strong", strong);
  root.style.setProperty("--p-fill", config.accentColor);
  root.style.setProperty("--p-fill-strong", strong);
}

export function saveBrandConfig(next: BrandConfig): void {
  const normalized: BrandConfig = {
    brandName: next.brandName.trim() || DEFAULT_BRAND.brandName,
    tagline: next.tagline.trim() || DEFAULT_BRAND.tagline,
    accentColor: /^#[0-9a-fA-F]{6}$/.test(next.accentColor)
      ? next.accentColor
      : DEFAULT_BRAND.accentColor,
    logoDataUrl: next.logoDataUrl,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage quota errors in restricted contexts.
  }
  applyBrandTheme(normalized);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(BRAND_EVENT));
  }
}

export function resetBrandConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
  applyBrandTheme(DEFAULT_BRAND);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(BRAND_EVENT));
  }
}

export function useWhiteLabel() {
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);

  useEffect(() => {
    const sync = () => {
      const current = loadBrandConfig();
      setBrand(current);
      applyBrandTheme(current);
    };
    sync();
    window.addEventListener(BRAND_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(BRAND_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return {
    brand,
    saveBrand: saveBrandConfig,
    resetBrand: resetBrandConfig,
  };
}
