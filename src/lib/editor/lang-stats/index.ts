/**
 * BG3 Stats language support for CodeMirror 6.
 * Provides syntax highlighting and code folding for Stats data files
 * (Spell_*.txt, Armor.txt, Weapon.txt, etc.)
 */
import { parser } from "./stats.parser.js";
import {
  LRLanguage,
  LanguageSupport,
  foldNodeProp,
  foldInside,
} from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";

const statsHighlight = styleTags({
  "new entry equipment type using data": t.keyword,
  String: t.string,
  LineComment: t.lineComment,
});

const statsFold = foldNodeProp.add({
  StatsEntry: foldInside,
});

const statsLanguage = LRLanguage.define({
  name: "stats",
  parser: parser.configure({
    props: [statsHighlight, statsFold],
  }),
  languageData: {
    commentTokens: { line: "//" },
  },
});

export function stats(): LanguageSupport {
  return new LanguageSupport(statsLanguage);
}
