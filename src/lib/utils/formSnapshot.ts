/**
 * Captures a reactive value at call time, returning a non-reactive copy.
 * Used during component initialization to snapshot props/state that should
 * not trigger re-renders when the source changes later.
 *
 * This replaces scattered `svelte-ignore state_referenced_locally` markers
 * by making the one-time-read intent explicit in the code.
 */
export function snapshot<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "object") return JSON.parse(JSON.stringify(value));
  return value;
}
