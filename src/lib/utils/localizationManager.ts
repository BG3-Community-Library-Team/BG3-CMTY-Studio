/**
 * Auto-localization utilities for TranslatedString fields.
 *
 * When a user types plain text into a field with a `loca:` combobox descriptor,
 * these functions auto-generate a BG3-format content handle and manage the
 * mapping between handles and display text.
 *
 * Section-agnostic — works for Races, Origins, Backgrounds, Feats, etc.
 */
import { generateUuid } from "./uuid.js";

/**
 * Generate a BG3-format content handle.
 * Format: h{8hex}g{4hex}g{4hex}g{4hex}g{12hex}
 */
export function generateContentHandle(): string {
  const uuid = generateUuid();
  const parts = uuid.split("-");
  return `h${parts[0]}g${parts[1]}g${parts[2]}g${parts[3]}g${parts[4]}`;
}

/**
 * Detect whether a value is a content handle (without version suffix).
 */
export function isContentHandle(value: string): boolean {
  return /^h[0-9a-f]{8}g[0-9a-f]{4}g[0-9a-f]{4}g[0-9a-f]{4}g[0-9a-f]{12}$/i.test(value);
}

/**
 * Parse a content handle + version from the LSX format: "handle;version"
 */
export function parseHandleVersion(value: string): { handle: string; version: number } | null {
  const match = value.match(
    /^(h[0-9a-f]{8}g[0-9a-f]{4}g[0-9a-f]{4}g[0-9a-f]{4}g[0-9a-f]{12});(\d+)$/i,
  );
  if (!match) return null;
  return { handle: match[1], version: parseInt(match[2], 10) };
}

export interface AutoLocaEntry {
  text: string;
  version: number;
}

/**
 * Create or update an auto-localization entry for a field.
 * Returns the handle;version string to store in the field.
 *
 * @param text - The display text the user typed
 * @param currentFieldValue - The current field value (may be a handle;version or plain text)
 * @param autoLocaMap - The auto-localization map (mutated in place)
 */
export function autoLocalize(
  text: string,
  currentFieldValue: string,
  autoLocaMap: Map<string, AutoLocaEntry>,
): { fieldValue: string; handle: string } {
  // Check if current value is an auto-generated handle we own
  const parsed = parseHandleVersion(currentFieldValue);
  if (parsed && autoLocaMap.has(parsed.handle)) {
    // Update existing entry text, keep same handle
    autoLocaMap.set(parsed.handle, { text, version: parsed.version });
    return { fieldValue: currentFieldValue, handle: parsed.handle };
  }

  // Generate new handle
  const handle = generateContentHandle();
  const version = 1;
  autoLocaMap.set(handle, { text, version });
  return { fieldValue: `${handle};${version}`, handle };
}

/**
 * Resolve a localization handle to display text.
 *
 * Resolution order:
 *   1. Parse `handle;version` → check auto-loca entries → check global loca map
 *   2. Bare handle → check auto-loca entries → check global loca map
 *   3. Fall back to original value
 *
 * @param value - A raw field value (may be handle;version, bare handle, or plain text)
 * @param autoLocaEntries - Map of auto-generated loca entries (from configStore)
 * @param lookupGlobal - Function that resolves a handle from the global loca map
 * @returns Resolved display text, or the original value if unresolvable
 */
export function resolveLoca(
  value: string,
  autoLocaEntries: Map<string, AutoLocaEntry>,
  lookupGlobal: (handle: string) => string | undefined,
): string {
  if (!value) return '';
  // Strip leading/trailing pipe delimiters (BG3 uses |handle;version| in some contexts)
  const stripped = value.startsWith('|') && value.endsWith('|') ? value.slice(1, -1) : value;
  const parsed = parseHandleVersion(stripped);
  if (parsed) {
    const auto = autoLocaEntries.get(parsed.handle);
    if (auto) return auto.text;
    const global = lookupGlobal(parsed.handle);
    if (global) return global;
  }
  if (isContentHandle(stripped)) {
    const auto = autoLocaEntries.get(stripped);
    if (auto) return auto.text;
    const global = lookupGlobal(stripped);
    if (global) return global;
  }
  return value;
}
