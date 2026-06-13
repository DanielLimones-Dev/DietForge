import { checkSubscription, clearSubscriptionCache } from "@/lib/supabase";
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

export function clearStoredEmail() {
  localStorage.removeItem(EMAIL_KEY);
  clearSubscriptionCache();
}

export async function verifySubscription(email: string): Promise<SubscriptionStatus> {
  if (!email) return { active: false, status: null, expiresAt: null };
  return checkSubscription(email);
}

export function needsSubscription(status: SubscriptionStatus): boolean {
  return !status.active;
}

export function daysUntilExpiry(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

export const STRIPE_PAYMENT_LINK = import.meta.env.VITE_STRIPE_PAYMENT_LINK || "";

// Trial system (device-based, 15 days, non-renewable)
export function getTrialStart(): string | null {
  return localStorage.getItem(TRIAL_KEY);
}

export function setTrialStart(): string {
  const now = new Date().toISOString();
  localStorage.setItem(TRIAL_KEY, now);
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
