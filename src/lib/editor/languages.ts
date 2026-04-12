/**
 * Language extension registry — maps ScriptLanguage identifiers to CM6
 * LanguageSupport extensions. Drop-in languages use official CM6 packages;
 * Lua uses the legacy StreamLanguage adapter. Custom grammars (Osiris, Stats,
 * Khonsu, Anubis, Constellations) will be added in Phase 2.
 */
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { markdown } from "@codemirror/lang-markdown";
import { StreamLanguage } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import type { Extension } from "@codemirror/state";
import type { ScriptLanguage } from "../utils/syntaxHighlight.js";

/** Lazy-initialized language extensions keyed by ScriptLanguage. */
const languageMap: Record<string, () => Extension> = {
  lua: () => StreamLanguage.define(lua),
  json: () => json(),
  xml: () => xml(),
  yaml: () => yaml(),
  markdown: () => markdown(),
  // Lua-family languages reuse Lua tokenizer until Phase 2 custom grammars
  khn: () => StreamLanguage.define(lua),
  osiris: () => StreamLanguage.define(lua),
  anubis: () => StreamLanguage.define(lua),
  constellations: () => StreamLanguage.define(lua),
};

/**
 * Get the CM6 language extension for a given ScriptLanguage.
 * Returns an empty extension for unknown/plaintext languages.
 */
export function getLanguageExtension(lang: ScriptLanguage | string): Extension {
  return languageMap[lang]?.() ?? [];
}
