import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@/index.css";
import {ErrorMonitor} from "@/components/ErrorMonitor";

export const metadata: Metadata = {
  title: { default: "DietForge", template: "%s | DietForge" },
  description: "Planificación nutricional, seguimiento de clientes y planes para coaches.",
  icons: {
    icon: [{ url: "/dietforge-icon.svg", type: "image/svg+xml" }],
    shortcut: "/dietforge-icon.svg",
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="es"><body><ErrorMonitor/>{children}</body></html>;
}
