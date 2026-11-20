"use client";

import { useEffect } from "react";

export function PortalRippleEffect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const spawnRipple = (btn: HTMLButtonElement, clientX?: number, clientY?: number) => {
      if (reducedMotion.matches) return;
      if (btn.disabled || btn.classList.contains("portal-day-pill")) return;

      const rect = btn.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const hasCoords = typeof clientX === "number" && typeof clientY === "number" && (clientX !== 0 || clientY !== 0);
      const x = hasCoords ? Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)) : 50;
      const y = hasCoords ? Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)) : 50;

      btn.classList.add("portal-has-ripple");

      const host = document.createElement("span");
      host.className = "portal-btn-ripple";
      host.setAttribute("aria-hidden", "true");
      host.style.setProperty("--drop-x", `${x}%`);
      host.style.setProperty("--drop-y", `${y}%`);

      const drop = document.createElement("i");
      drop.className = "portal-day-drop";
      const r1 = document.createElement("i");
      r1.className = "portal-day-ring is-one";
      const r2 = document.createElement("i");
      r2.className = "portal-day-ring is-two";
      const r3 = document.createElement("i");
      r3.className = "portal-day-ring is-three";

      host.append(drop, r1, r2, r3);
      btn.appendChild(host);

      window.setTimeout(() => {
        host.remove();
      }, 1350);
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest(".portal-app button:not(:disabled)") as HTMLButtonElement | null;
      if (!btn) return;
      spawnRipple(btn, e.clientX, e.clientY);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const target = e.target as HTMLElement | null;
      const btn = target?.closest(".portal-app button:not(:disabled)") as HTMLButtonElement | null;
      if (!btn) return;
      spawnRipple(btn);
    };

    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("keydown", onKeyDown, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}
