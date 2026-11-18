'use client';

import { useEffect, useState } from 'react';

export type AppLanguage = 'es' | 'en';

const LANG_STORAGE_KEY = 'dietforge_lang';
export const LANGUAGE_CHANGE_EVENT = 'dietforge:language-change';

export function getStoredLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'es';
  try {
    return window.localStorage.getItem(LANG_STORAGE_KEY) === 'en' ? 'en' : 'es';
  } catch {
    return 'es';
  }
}

export function setStoredLanguage(lang: AppLanguage): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* Ignore storage errors in restricted environments. */
  }
  document.documentElement.lang = lang;
  window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGE_EVENT, { detail: { lang } }));
}

export function useAppLanguage() {
  const [lang, setLangState] = useState<AppLanguage>('es');

  useEffect(() => {
    const sync = () => {
      const next = getStoredLanguage();
      setLangState(next);
      document.documentElement.lang = next;
    };
    sync();
    window.addEventListener(LANGUAGE_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setLang = (next: AppLanguage) => {
    setStoredLanguage(next);
  };

  return {
    lang,
    setLang,
    toggleLang: () => setLang(lang === 'es' ? 'en' : 'es'),
  };
}

export const SHELL_COPY = {
  es: {
    workspace: 'ESPACIO DE TRABAJO',
    dashboard: 'Dashboard',
    clients: 'Clientes',
    tracking: 'Seguimiento',
    agenda: 'Agenda',
    reports: 'Reportes',
    planning: 'Planificación',
    routines: 'Rutinas',
    foods: 'Alimentos',
    exercises: 'Ejercicios',
    system: 'Sistema',
    quality: 'Calidad y respaldos',
    admin: 'Administración',
    adminRole: 'Administrador',
    coachAccount: 'Cuenta de coach',
    proCoach: 'Coach profesional',
    myAccount: 'Mi cuenta',
    privacyNotice: 'Aviso de privacidad',
    lightMode: 'Modo claro',
    darkMode: 'Modo oscuro',
    language: 'Idioma',
    logout: 'Cerrar sesión',
    openNav: 'Abrir navegación',
    closeNav: 'Cerrar navegación',
    navLabel: 'Navegación principal',
    updateEyebrow: 'SISTEMA ACTUALIZADO',
    updateAria: 'Actualización del sistema disponible',
    seeUpdates: 'Ver novedades',
    understood: 'Entendido',
    updatesTitle: 'Novedades del sistema',
    updatesEyebrow: 'REGISTRO DE ACTUALIZACIONES',
    closeUpdates: 'Cerrar novedades',
    latestTag: 'Más reciente',
    markRead: 'Marcar como leído',
    notifications: 'Notificaciones',
    unreadLabel: 'sin leer',
    closeNotifications: 'Cerrar notificaciones',
    syncError: 'No se pudo sincronizar. Reintentando automáticamente.',
    noClientNotifications: 'No tienes notificaciones de clientes nuevas.',
    newCheckIn: 'Envió un nuevo check-in',
    unreadBadge: 'Sin leer',
    systemUpdatedItem: 'Sistema actualizado',
    newUpdateBadge: 'Nueva actualización',
  },
  en: {
    workspace: 'WORKSPACE',
    dashboard: 'Dashboard',
    clients: 'Clients',
    tracking: 'Tracking',
    agenda: 'Schedule',
    reports: 'Reports',
    planning: 'Planning',
    routines: 'Training',
    foods: 'Foods',
    exercises: 'Exercises',
    system: 'System',
    quality: 'Quality & backups',
    admin: 'Administration',
    adminRole: 'Administrator',
    coachAccount: 'Coach account',
    proCoach: 'Pro Coach',
    myAccount: 'My account',
    privacyNotice: 'Privacy notice',
    lightMode: 'Light mode',
    darkMode: 'Dark mode',
    language: 'Language',
    logout: 'Sign out',
    openNav: 'Open navigation',
    closeNav: 'Close navigation',
    navLabel: 'Main navigation',
    updateEyebrow: 'SYSTEM UPDATED',
    updateAria: 'System update available',
    seeUpdates: "What's new",
    understood: 'Got it',
    updatesTitle: 'System updates',
    updatesEyebrow: 'RELEASE NOTES',
    closeUpdates: 'Close updates',
    latestTag: 'Latest',
    markRead: 'Mark as read',
    notifications: 'Notifications',
    unreadLabel: 'unread',
    closeNotifications: 'Close notifications',
    syncError: 'Unable to sync. Retrying automatically.',
    noClientNotifications: 'No new client notifications.',
    newCheckIn: 'Submitted a new check-in',
    unreadBadge: 'Unread',
    systemUpdatedItem: 'System updated',
    newUpdateBadge: 'New update',
  },
} as const;
