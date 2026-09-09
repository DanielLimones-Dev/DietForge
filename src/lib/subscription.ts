import { getPreference, setPreference, hasPendingCloudWrites } from "@/lib/db";
import { checkSubscription, clearSubscriptionCache, supabase } from "@/lib/supabase";
import type { SubscriptionStatus } from "@/lib/supabase";

const EMAIL_KEY = "dietforge_email";
const TRIAL_KEY = "dietforge_trial";
const TRIAL_DAYS = 15;

export function getStoredEmail(): string {
  return localStorage.getItem(EMAIL_KEY) || "";
}

export function setStoredEmail(email: string) {
  localStorage.setItem(EMAIL_KEY, email);
}

export async function clearStoredEmail() {
  if(hasPendingCloudWrites())throw new Error("Espera a que termine el guardado antes de cerrar sesión.");
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  localStorage.removeItem(EMAIL_KEY);
  clearSubscriptionCache();
}

export async function verifySubscription(email: string): Promise<SubscriptionStatus> {
  if (!email) return { active: false, status: null, expiresAt: null };
  return checkSubscription();
}

export function needsSubscription(status: SubscriptionStatus): boolean {
  return !status.active;
}

export function daysUntilExpiry(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

export const STRIPE_PAYMENT_LINK_MONTHLY = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_MONTHLY || "";
export const STRIPE_PAYMENT_LINK_ANNUAL = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ANNUAL || "";

// Trial system (device-based, 15 days, non-renewable)
export function getTrialStart(): string | null {
  return getPreference(TRIAL_KEY);
}

export function setTrialStart(): string {
  const now = new Date().toISOString();
  setPreference(TRIAL_KEY, now);

  return now;
}

export function getTrialDaysLeft(): number {
  const start = getTrialStart();
  if (!start) return 0;
  const diff = Date.now() - new Date(start).getTime();
  const used = Math.floor(diff / 86400000);
  return Math.max(0, TRIAL_DAYS - used);
}

export function isTrialActive(): boolean {
  const start = getTrialStart();
  if (!start) return false;
  return getTrialDaysLeft() > 0;
}

export function getTrialEndDate(): string {
  const start = getTrialStart();
  if (!start) return "";
  return new Date(new Date(start).getTime() + TRIAL_DAYS * 86400000).toISOString();
}
