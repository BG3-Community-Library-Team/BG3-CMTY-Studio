/**
 * BG3 Osiris goal file language support for CodeMirror 6.
 * Provides syntax highlighting and code folding for Osiris script files.
 */
import { parser } from "./osiris.parser.js";
import {
  LRLanguage,
  LanguageSupport,
  foldNodeProp,
  foldInside,
} from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";

const osirisHighlight = styleTags({
  "Version SubGoalCombiner SGC_AND ParentTargetEdge": t.keyword,
  "INITSECTION KBSECTION EXITSECTION ENDEXITSECTION": t.keyword,
  "IF THEN AND NOT PROC QRY": t.keyword,
  "INTEGER INTEGER64 REAL STRING GUIDSTRING CHARACTERGUID ITEMGUID TRIGGERGUID CHARACTER ITEM TRIGGER SPLINE LEVELTEMPLATE SPLINEGUID LEVELTEMPLATEGUID": t.typeName,
  Identifier: t.variableName,
  String: t.string,
  Number: t.number,
  Comment: t.lineComment,
});

const osirisFold = foldNodeProp.add({
  InitSection: foldInside,
  KbSection: foldInside,
  ExitSection: foldInside,
  Rule: foldInside,
  ProcDef: foldInside,
  QryDef: foldInside,
});

const osirisLanguage = LRLanguage.define({
  name: "osiris",
  parser: parser.configure({
    props: [osirisHighlight, osirisFold],
  }),
  languageData: {
    commentTokens: { line: "//" },
  },
});

export function osiris(): LanguageSupport {
  return new LanguageSupport(osirisLanguage);
}
