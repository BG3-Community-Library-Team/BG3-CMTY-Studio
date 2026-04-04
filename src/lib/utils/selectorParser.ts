/**
 * Parse raw LSX Selectors attribute strings into structured selector items.
 *
 * BG3 LSX Progressions/Feats store selectors as a semicolon-delimited string:
 *   "SelectSpells(uuid,1,Cantrip);ReplacePassives(uuid,1,SwarmReplace)"
 *
 * Each call: FunctionName(positional_param_0, positional_param_1, ...)
 *
 * This parser extracts function names and maps positional parameters to the
 * named fields used by the ManualEntryForm selector UI.
 *
 * Note: The BG3 game engine treats ReplacePassives identically to SelectPassives.
 * When generating CF config entries, ReplacePassives is mapped to SelectPassives
 * (see https://github.com/BG3-Community-Library-Team/BG3-Compatibility-Framework/wiki/_Selector-API).
 */

// ---- Types ----------------------------------------------------------------

import { emptyParams, type SelectorParamValues } from "../data/selectorDefs.js";

/** A single parsed selector ready for ManualEntryForm consumption. */
export interface ParsedSelector {
  /** Normalized function name (e.g. "SelectSpells"). */
  fn: string;
  /** Named parameter values extracted from positional args. */
  params: SelectorParamValues;
  /** True when the original LSX function was "ReplacePassives" (normalized to SelectPassives). */
  isReplace: boolean;
}

/**
 * Positional parameter mapping for each selector function type.
 * Order matches the BG3 LSX attribute format: FunctionName(param0, param1, …).
 *
 * Sources:
 *  - In-game Progressions.lsx observation
 *  - CF wiki _Selector-API → Sample Objects
 */
const POSITIONAL_PARAMS: Record<string, (keyof SelectorParamValues)[]> = {
  SelectSpells:          ["Guid", "Amount", "SwapAmount", "SelectorId"],
  AddSpells:             ["Guid", "SelectorId", "CastingAbility", "ActionResource", "PrepareType", "CooldownType"],
  SelectSkills:          ["Guid", "Amount", "SelectorId"],
  SelectAbilities:       ["Guid", "Amount", "SelectorId"],
  SelectAbilityBonus:    ["Guid", "Amount", "SelectorId"],
  SelectEquipment:       ["Guid", "Amount", "SelectorId"],
  SelectSkillsExpertise: ["Guid", "Amount", "LimitToProficiency", "SelectorId"],
  SelectPassives:        ["Guid", "Amount", "SelectorId"],
  ReplacePassives:       ["Guid", "Amount", "SelectorId"],
};

/**
 * Split a string on a delimiter character, but only when outside parentheses.
 * Handles nested parentheses correctly so inner commas are preserved.
 */
function splitOutsideParens(input: string, delimiter: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (const ch of input) {
    if (ch === "(") {
      depth++;
      current += ch;
    } else if (ch === ")") {
      depth--;
      current += ch;
    } else if (delimiter.includes(ch) && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// ---- Public API ------------------------------------------------------------

/**
 * Parse a raw LSX Selectors attribute string into structured selector items.
 *
 * @param rawSelectors - The Selectors value from LSX `raw_attributes`, e.g.:
 *   `"SelectSpells(b2c94f10-…,1,Cantrip);ReplacePassives(88336457-…,1,SwarmReplace)"`
 * @returns Array of parsed selectors. Unknown function names are included with
 *   as much data as can be extracted (Guid / Amount from first two positional
 *   params). `ReplacePassives` is normalized to `SelectPassives`.
 */
export function parseRawSelectors(rawSelectors: string): ParsedSelector[] {
  if (!rawSelectors || !rawSelectors.trim()) return [];

  const input = rawSelectors.trim();

  // Standard BG3 LSX separator is semicolon.
  const parts = splitOutsideParens(input, ";");

  const result: ParsedSelector[] = [];

  for (const part of parts) {
    // Match FunctionName(params…)
    const match = part.match(/^(\w+)\(([^)]*)\)$/);
    if (!match) continue;

    const rawFn = match[1];
    const paramStr = match[2];
    const paramValues = paramStr ? paramStr.split(",").map((s) => s.trim()) : [];

    // Normalize: the game treats ReplacePassives as SelectPassives
    const isReplace = rawFn === "ReplacePassives";
    const fn = isReplace ? "SelectPassives" : rawFn;

    // Look up positional mapping (try raw name first, then normalized)
    const positionalKeys = POSITIONAL_PARAMS[rawFn] ?? POSITIONAL_PARAMS[fn];
    const params = emptyParams();

    if (positionalKeys) {
      for (let i = 0; i < positionalKeys.length && i < paramValues.length; i++) {
        const key = positionalKeys[i];
        if (paramValues[i]) {
          params[key] = paramValues[i];
        }
      }
    } else {
      // Unknown function — best-effort: first param → Guid, second → Amount
      if (paramValues.length > 0) params.Guid = paramValues[0];
      if (paramValues.length > 1) params.Amount = paramValues[1];
    }

    result.push({ fn, params, isReplace });
  }

  return result;
}
