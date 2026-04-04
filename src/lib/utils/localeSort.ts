/**
 * Shared locale-aware string comparison utility.
 * Uses a cached Intl.Collator for better performance than repeated .localeCompare() calls.
 * See IPC-09: ensures non-ASCII names (e.g., Äärmend, Über) sort correctly.
 */
const collator = new Intl.Collator(undefined, { sensitivity: "base" });

/** Compare two strings using locale-aware collation. */
export function localeCompare(a: string, b: string): number {
  return collator.compare(a, b);
}

/** Sort an array of strings in locale-aware order (in-place). */
export function localeSortStrings(arr: string[]): string[] {
  return arr.sort(collator.compare);
}
