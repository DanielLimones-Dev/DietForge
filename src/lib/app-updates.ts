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
    title: 'Nuevas mejoras en DietForge',
    titleEn: 'New improvements in DietForge',
    summary: 'Pulimos el diseño y la fluidez del panel para que trabajes más cómodo.',
    summaryEn: 'We refreshed the dashboard design and flow for a smoother experience.',
    changes: [
      'Menús más ágiles con guardado automático y animaciones suaves.',
      'Diseño más limpio en rutinas, gráficas y calendario Peak Week.',
      'Cambio rápido de idioma (ES / EN) desde el menú lateral.',
    ],
    changesEn: [
      'Faster menus with auto-save and smoother animations.',
      'Cleaner design across training plans, charts, and Peak Week calendar.',
      'Quick language switcher (ES / EN) right from the sidebar.',
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
