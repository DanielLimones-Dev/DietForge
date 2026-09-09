"use client";

import { useEffect } from "react";
import { normalizeNumericInput } from "@/lib/numeric-input";

// Number fields are spread across the workspace. Normalize at the document
// boundary so every current and future controlled field follows one rule.
export function NumericInputNormalizer() {
  useEffect(() => {
    const normalize = (event: Event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "number") return;
      const next = normalizeNumericInput(input.value);
      if (next === input.value) return;

      // Bypass React's instance value tracker. Its delegated onChange then sees
      // the corrected browser value and updates the owning controlled state.
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, next);
    };
    const stepFromArrow = (event: PointerEvent) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "number" || input.dataset.plainNumber !== undefined || input.disabled || input.readOnly || event.button !== 0) return;
      const bounds = input.getBoundingClientRect();
      if (event.clientX < bounds.right - 30) return;

      event.preventDefault();
      input.focus({ preventScroll: true });
      try {
        if (event.clientY < bounds.top + bounds.height / 2) input.stepUp();
        else input.stepDown();
      } catch {
        return;
      }
      input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    };
    document.addEventListener("input", normalize, true);
    document.addEventListener("pointerdown", stepFromArrow, true);
    return () => {
      document.removeEventListener("input", normalize, true);
      document.removeEventListener("pointerdown", stepFromArrow, true);
    };
  }, []);

  return null;
}
