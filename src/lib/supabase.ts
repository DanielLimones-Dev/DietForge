import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const MASTER_EMAIL = "daniel@live.com";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SubscriptionStatus {
  active: boolean;
  status: string | null;
  expiresAt: string | null;
}

const CACHE_KEY = "dietforge_sub_cache";

interface CacheEntry {
  email: string;
  expiresAt: string | null;
}

export function getCachedSubscription(email: string): SubscriptionStatus | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (entry.email !== email || !entry.expiresAt) return null;
    const expires = new Date(entry.expiresAt).getTime();
    if (Date.now() < expires) {
      return { active: true, status: "active", expiresAt: entry.expiresAt };
    }
    localStorage.removeItem(CACHE_KEY);
    return null;
  } catch {
    return null;
  }
}

export function setCachedSubscription(email: string, status: SubscriptionStatus) {
  if (!status.expiresAt) return;
  const entry: CacheEntry = { email, expiresAt: status.expiresAt };
  localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
}

export function clearSubscriptionCache() {
  localStorage.removeItem(CACHE_KEY);
}

export async function checkSubscription(email: string): Promise<SubscriptionStatus> {
  if (email === MASTER_EMAIL) {
    return { active: true, status: "active", expiresAt: null };
  }
  const cached = getCachedSubscription(email);
  if (cached) return cached;

  const checkUrl = `${supabaseUrl}/functions/v1/check-subscription?email=${encodeURIComponent(email)}`;

  try {
    const res = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${supabaseAnonKey}` },
    });
    if (!res.ok) throw new Error("Check failed");
    const data = await res.json();
    const status: SubscriptionStatus = {
      active: data.active ?? false,
      status: data.status ?? null,
      expiresAt: data.expiresAt ?? null,
    };
    if (status.active) setCachedSubscription(email, status);
    return status;
  } catch {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const entry: CacheEntry = JSON.parse(raw);
      if (entry.email === email && entry.expiresAt) {
        const expires = new Date(entry.expiresAt).getTime();
        if (Date.now() < expires) {
          return { active: true, status: "active", expiresAt: entry.expiresAt };
        }
      }
    }
    return { active: false, status: null, expiresAt: null };
  }
}
