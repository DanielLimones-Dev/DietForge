import type { FocusEvent } from "react";

/** Keep an interacted block visible after focus leaves it. */
export function revealFocusedCascade(event: FocusEvent<HTMLElement>) {
  const block = event.target.closest<HTMLElement>("[data-cascade]");
  if (block && event.currentTarget.contains(block)) block.dataset.cascadeRevealed = "true";
}
