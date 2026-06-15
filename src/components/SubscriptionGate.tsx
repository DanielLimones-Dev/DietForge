import { type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { SubscriptionPage } from "@/pages/SubscriptionPage";

export function SubscriptionGate({ children }: { children?: ReactNode }) {
  const { email, status, loading, trialActive } = useSubscription();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!email) {
    return <SubscriptionPage />;
  }
  if (!status.active && !trialActive) {
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    return <SubscriptionPage offline={offline} />;
  }

  return <>{children || <Outlet />}</>;
}
