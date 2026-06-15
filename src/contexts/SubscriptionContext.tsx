import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getStoredEmail, setStoredEmail, clearStoredEmail, verifySubscription, isTrialActive, getTrialDaysLeft, getTrialEndDate, setTrialStart, getTrialStart } from "@/lib/subscription";
import type { SubscriptionStatus } from "@/lib/supabase";

interface SubscriptionContextValue {
  email: string;
  status: SubscriptionStatus;
  loading: boolean;
  trialActive: boolean;
  trialDaysLeft: number;
  trialEndDate: string;
  setEmail: (email: string) => void;
  refresh: () => Promise<void>;
  logout: () => void;
  startTrial: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [email, setEmailState] = useState(getStoredEmail);
  const [status, setStatus] = useState<SubscriptionStatus>({ active: false, status: null, expiresAt: null });
  const [loading, setLoading] = useState(true);
  const [trialActive, setTrialActive] = useState(isTrialActive);
  const [trialDaysLeft, setTrialDaysLeft] = useState(getTrialDaysLeft);
  const [trialEndDate, setTrialEndDate] = useState(getTrialEndDate);
  const [trialStarted, setTrialStarted] = useState(!!getTrialStart());

  const refresh = useCallback(async () => {
    const stored = getStoredEmail();
    if (!stored) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const s = await verifySubscription(stored);
    setStatus(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const recheck = () => {
      setTrialActive(isTrialActive());
      setTrialDaysLeft(getTrialDaysLeft());
      setTrialEndDate(getTrialEndDate());
      refresh();
    };
    document.addEventListener("visibilitychange", () => { if (!document.hidden) recheck(); });
    window.addEventListener("focus", recheck);
    const interval = setInterval(recheck, 60000);
    return () => {
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
      clearInterval(interval);
    };
  }, [refresh]);

  const setEmail = useCallback((newEmail: string) => {
    setStoredEmail(newEmail);
    setEmailState(newEmail);
  }, []);

  const logout = useCallback(() => {
    clearStoredEmail();
    setEmailState("");
    setStatus({ active: false, status: null, expiresAt: null });
  }, []);

  const startTrial = useCallback(() => {
    setTrialStart();
    setTrialActive(true);
    setTrialDaysLeft(15);
    setTrialEndDate(getTrialEndDate());
    setTrialStarted(true);
  }, []);

  return (
    <SubscriptionContext.Provider value={{ email, status, loading, trialActive, trialDaysLeft, trialEndDate, setEmail, refresh, logout, startTrial }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be inside SubscriptionProvider");
  return ctx;
}
