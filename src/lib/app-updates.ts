export interface SystemUpdate {
  version: string;
  date: string;
  dateEn: string;
  title: string;
  titleEn: string;
  summary: string;
  summaryEn: string;
  changes: string[];
  changesEn: string[];
}

/**
 * Historial de actualizaciones y parches visibles para el coach.
 * Al publicar una nueva versión o parche, agrega una entrada al inicio
 * con un nuevo `version` para notificar automáticamente al coach.
 */
export const SYSTEM_UPDATES: SystemUpdate[] = [
  {
    version: '2026.11.18',
    date: '18 nov 2026',
    dateEn: 'Nov 18, 2026',
    title: 'Actualización de experiencia clínica y menús',
    titleEn: 'Clinical experience and menus update',
    summary: 'Mejoras visuales, guardado automático en menús y animaciones más fluidas en todo el panel.',
    summaryEn: 'Visual improvements, auto-save in menus, and smoother animations across the dashboard.',
    changes: [
      'Menús y recetas con guardado automático en vivo, cinta compacta de macros y asignación directa al portal.',
      'Confirmaciones integradas y animaciones suaves al crear o eliminar menús, comidas y recetas.',
      'Iluminación y respuesta visual al pasar el cursor sobre botones y pestañas.',
      'Rediseño de Rutinas (secciones plegables), Calidad y Respaldo (descarga única en JSON) y Consola de Administración.',
      'Gráficos biométricos y reportes con línea base, promedio móvil y paleta clínica unificada.',
    ],
    changesEn: [
      'Menus and recipes with live auto-save, compact macro ribbon, and direct portal assignment.',
      'Built-in confirmation dialogs and smooth animations when creating or deleting menus, meals, and recipes.',
      'Clear hover illumination and visual feedback across buttons and tabs.',
      'Redesigned Training (collapsible sections), Quality & Backup (single JSON export), and Admin Console.',
      'Biometric charts and reports with baseline reference, moving average, and unified clinical palette.',
    ],
  },
];

export const LATEST_SYSTEM_UPDATE: SystemUpdate = SYSTEM_UPDATES[0];

const SEEN_UPDATE_KEY = 'dietforge_seen_system_update';
export const SYSTEM_UPDATE_EVENT = 'dietforge:system-update-seen';

export function getSeenSystemUpdate(): string | null {
  if (typeof window === 'undefined') return LATEST_SYSTEM_UPDATE.version;
  try {
    return window.localStorage.getItem(SEEN_UPDATE_KEY);
  } catch {
    return null;
  }
}

export function hasUnreadSystemUpdate(): boolean {
  return getSeenSystemUpdate() !== LATEST_SYSTEM_UPDATE.version;
}

export function markSystemUpdateSeen(version: string = LATEST_SYSTEM_UPDATE.version): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SEEN_UPDATE_KEY, version);
  } catch {
    /* Ignore storage quota or privacy-mode errors. */
  }
  window.dispatchEvent(new CustomEvent(SYSTEM_UPDATE_EVENT, { detail: { version } }));
}
