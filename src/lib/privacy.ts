/**
 * Contrato único del aviso de privacidad. La página pública, el registro y el
 * consentimiento guardado en Supabase comparten esta versión para que la
 * evidencia siempre corresponda al texto que la persona aceptó.
 */
export const PRIVACY_NOTICE_VERSION = "1.0";
export const PRIVACY_NOTICE_EFFECTIVE_DATE = "2026-11-16";
export const PRIVACY_CONTACT_EMAIL = "hola@dietforge.com.mx";
export const PRIVACY_DELETION_PHRASE = "ELIMINAR";
export const PRIVACY_SOURCES = ["portal_signup", "coach_activation"] as const;
export type PrivacySource = (typeof PRIVACY_SOURCES)[number];

export interface SignupPrivacyFields {
  email: string;
  password: string;
  confirmation: string;
  accepted: boolean;
}

export function signupPrivacyError({ email, password, confirmation, accepted }: SignupPrivacyFields): string | null {
  const account = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)) return "Escribe un correo válido.";
  if (password.length < 12 || password.length > 128) return "Tu contraseña debe tener entre 12 y 128 caracteres.";
  if (password !== confirmation) return "Las contraseñas no coinciden.";
  // El consentimiento se comprueba al final, pero nunca se omite: sin aceptación no hay alta.
  if (!accepted) return "Debes aceptar el aviso de privacidad para crear tu cuenta.";
  return null;
}

export interface DeletionConfirmationFields {
  email: string;
  phrase: string;
}

export function deletionConfirmationError(
  { email, phrase }: DeletionConfirmationFields,
  accountEmail: string,
): string | null {
  if (!accountEmail.trim()) return "No podemos verificar el correo de tu cuenta.";
  if (email.trim().toLowerCase() !== accountEmail.trim().toLowerCase()) return "El correo no coincide con tu cuenta.";
  if (phrase.trim().toUpperCase() !== PRIVACY_DELETION_PHRASE) return `Escribe ${PRIVACY_DELETION_PHRASE} para confirmar.`;
  return null;
}

/** Fecha civil local; toISOString() puede adelantar un día respecto al usuario. */
export function civilDate(value: Date = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function privacyExportFilename(value: Date = new Date()): string {
  return `dietforge-mis-datos-${civilDate(value)}.json`;
}

export function formatConsentTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

export interface StoredConsent {
  version?: string | null;
  accepted_at?: string | null;
}

export function consentSummary(consent: StoredConsent | null | undefined): string {
  if (!consent?.accepted_at) return "Sin consentimiento registrado";
  const timestamp = formatConsentTimestamp(consent.accepted_at);
  return `Versión ${consent.version ?? PRIVACY_NOTICE_VERSION} · ${timestamp || consent.accepted_at}`;
}

export function consentIsCurrent(consent: StoredConsent | null | undefined): boolean {
  return consent?.version === PRIVACY_NOTICE_VERSION;
}
