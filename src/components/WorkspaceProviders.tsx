"use client";

import type { ReactNode } from "react";
import { CloudGate, CloudDataGate } from "@/components/CloudGate";
import { Layout } from "@/components/Layout";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { ToastProvider } from "@/components/Toast";
import { NumericInputNormalizer } from "@/components/NumericInputNormalizer";

// Database-backed screens mount only after the signed-in account has loaded.
// The shared layout keeps the save queue alive when navigating between pages.
export function WorkspaceProviders({ children }: { children: ReactNode }) {
  return (
    <CloudGate>
      <NumericInputNormalizer />
      <ToastProvider>
        <SubscriptionProvider>
          <SubscriptionGate>
            <CloudDataGate>
            <Layout>{children}</Layout>
            </CloudDataGate>
          </SubscriptionGate>
        </SubscriptionProvider>
      </ToastProvider>
    </CloudGate>
  );
}
