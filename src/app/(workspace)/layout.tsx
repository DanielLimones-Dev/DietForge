import { Suspense, type ReactNode } from "react";
import { WorkspaceProviders } from "@/components/WorkspaceProviders";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <WorkspaceProviders>{children}</WorkspaceProviders>
    </Suspense>
  );
}
