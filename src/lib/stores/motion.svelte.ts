/**
 * PF-019: Reduced Motion Support
 *
 * Reactive store that combines the OS-level `prefers-reduced-motion` media query
 * with a user-toggleable setting from settingsStore.
 *
 * - "system" (default): follows the OS preference
 * - "on": always reduce motion, regardless of OS
 * - "off": never reduce motion, regardless of OS
 *
 * CSS blanket suppression is handled in app.css via the `.reduced-motion` class
 * applied to the root element. This store is for Svelte-level logic that needs
 * to branch on the preference (e.g., skipping `transition:fly` parameters).
 */

import { settingsStore } from "./settingsStore.svelte.js";

const mql =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

/** Reactive OS-level flag. */
let _osPrefersReducedMotion = $state(mql?.matches ?? false);

if (mql) {
  mql.addEventListener("change", (e) => {
    _osPrefersReducedMotion = e.matches;
  });
}

/**
 * Read-only accessor — returns effective reduced-motion preference,
 * combining OS setting with user override from settingsStore.
 */
export function getPrefersReducedMotion(): boolean {
  const userPref = settingsStore.reducedMotion;
  if (userPref === "on") return true;
  if (userPref === "off") return false;
  return _osPrefersReducedMotion; // "system"
}
