import type { ClientGroup } from "@/types";

const STORAGE_KEY = "dietforge_client_groups_v1";

export const GROUP_COLORS = [
  { id: "emerald", label: "Verde", hex: "#059669", bg: "bg-emerald-50 dark:bg-emerald-950/50", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
  { id: "blue", label: "Azul", hex: "#2563eb", bg: "bg-blue-50 dark:bg-blue-950/50", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  { id: "violet", label: "Morado", hex: "#7c3aed", bg: "bg-violet-50 dark:bg-violet-950/50", text: "text-violet-700 dark:text-violet-300", border: "border-violet-200 dark:border-violet-800" },
  { id: "amber", label: "Ámbar", hex: "#d97706", bg: "bg-amber-50 dark:bg-amber-950/50", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
  { id: "rose", label: "Rosa", hex: "#e11d48", bg: "bg-rose-50 dark:bg-rose-950/50", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-800" },
  { id: "cyan", label: "Cian", hex: "#0891b2", bg: "bg-cyan-50 dark:bg-cyan-950/50", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800" },
  { id: "orange", label: "Naranja", hex: "#ea580c", bg: "bg-orange-50 dark:bg-orange-950/50", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
  { id: "slate", label: "Gris", hex: "#475569", bg: "bg-slate-100 dark:bg-slate-800/70", text: "text-slate-700 dark:text-slate-300", border: "border-slate-300 dark:border-slate-700" },
] as const;

export const GROUP_ICONS = [
  "users",
  "stethoscope",
  "heart",
  "dumbbell",
  "laptop",
  "flame",
  "trophy",
  "apple",
  "activity",
  "star",
  "shield",
  "sparkles",
] as const;

export function getGroupColor(colorId?: string) {
  return GROUP_COLORS.find((c) => c.id === colorId) ?? GROUP_COLORS[0];
}

export function loadClientGroups(): ClientGroup[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ClientGroup[]) : [];
  } catch {
    return [];
  }
}

function persistClientGroups(groups: ClientGroup[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch {
    // Ignore storage quota errors.
  }
}

export function saveClientGroup(input: Omit<ClientGroup, "id">): ClientGroup[] {
  const next: ClientGroup[] = [
    ...loadClientGroups(),
    {
      id:
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: input.name.trim(),
      icon: input.icon || "users",
      color: input.color || "emerald",
    },
  ];
  persistClientGroups(next);
  return next;
}

export function updateClientGroup(id: string, patch: Partial<Omit<ClientGroup, "id">>): ClientGroup[] {
  const next = loadClientGroups().map((g) =>
    g.id === id ? { ...g, ...patch, name: patch.name !== undefined ? patch.name.trim() : g.name } : g
  );
  persistClientGroups(next);
  return next;
}

export function deleteClientGroup(id: string): ClientGroup[] {
  const next = loadClientGroups().filter((g) => g.id !== id);
  persistClientGroups(next);
  return next;
}
