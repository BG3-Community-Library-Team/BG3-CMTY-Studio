/**
 * Language extension registry — maps ScriptLanguage identifiers to CM6
 * LanguageSupport extensions. Drop-in languages use official CM6 packages;
 * custom Lezer grammars provide Osiris and Stats; Lua-family languages
 * (Khonsu, Anubis, Constellations) extend the Lua tokenizer with
 * framework-specific keyword highlights.
 */
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { markdown } from "@codemirror/lang-markdown";
import { StreamLanguage } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import type { Extension } from "@codemirror/state";
import type { ScriptLanguage } from "./types.js";
import { osiris } from "./lang-osiris/index.js";
import { stats } from "./lang-stats/index.js";
import { khonsu } from "./lang-khonsu/index.js";
import { anubisLua, constellationsLua } from "./lang-anubis/index.js";

/** Lazy-initialized language extensions keyed by ScriptLanguage. */
const languageMap: Record<string, () => Extension> = {
  lua: () => StreamLanguage.define(lua),
  json: () => json(),
  xml: () => xml(),
  yaml: () => yaml(),
  markdown: () => markdown(),
  osiris: () => osiris(),
  stats: () => stats(),
  khn: () => khonsu(),
  anubis: () => anubisLua(),
  constellations: () => constellationsLua(),
};

/**
 * Get the CM6 language extension for a given ScriptLanguage.
 * Returns an empty extension for unknown/plaintext languages.
 */
export function getLanguageExtension(lang: ScriptLanguage | string): Extension {
  return languageMap[lang]?.() ?? [];
}
