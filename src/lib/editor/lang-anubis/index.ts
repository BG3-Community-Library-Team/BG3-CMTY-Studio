/**
 * BG3 Anubis & Constellations language support for CodeMirror 6.
 * Extends Lua with additional highlighting for framework-specific constructs:
 * constructors (Config, State, Action, etc.), game.* namespaces, and
 * Constellations-specific EParamType.
 */
import { StreamLanguage } from "@codemirror/language";
import { LanguageSupport } from "@codemirror/language";
import {
  ViewPlugin,
  Decoration,
  EditorView,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { lua } from "@codemirror/legacy-modes/mode/lua";

/* ── Anubis framework identifiers ────────────────────────────── */

/** Framework constructors shared by Anubis and Constellations. */
const CONSTRUCTORS = new Set([
  "Config", "State", "StateRef", "Action", "Selector",
  "ImmediateSelector", "Sequence", "Parallel", "RandomSelector",
  "Proxy", "TriggerOutput", "ExtSocket", "AnubisModule",
]);

const constructorPattern = new RegExp(
  `\\b(${[...CONSTRUCTORS].join("|")})\\s*\\{`,
  "g",
);

/** game.configs.*, game.states.*, game.roots.*, game.actions.*, game.expressions.* */
const gameNamespacePattern = /\bgame\.(?:configs|states|roots|actions|expressions)\.\w+/g;

/** events.*, socketEvents.* patterns */
const eventsPattern = /\b(?:socket)?[Ee]vents\.\w+/g;

/** Constellations-specific: EParamType.* */
const eParamPattern = /\bEParamType\.\w+/g;

/* ── Decoration marks ────────────────────────────────────────── */

const constructorMark = Decoration.mark({ class: "cm-anubis-constructor" });
const namespaceMark = Decoration.mark({ class: "cm-anubis-namespace" });
const eventsMark = Decoration.mark({ class: "cm-anubis-events" });
const eParamMark = Decoration.mark({ class: "cm-anubis-eparam" });

function buildDecorations(
  view: EditorView,
  includeEParam: boolean,
): DecorationSet {
  const decorations: { from: number; to: number; deco: Decoration }[] = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);

    // Constructors — highlight only the name, not the {
    constructorPattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = constructorPattern.exec(text))) {
      decorations.push({
        from: from + m.index,
        to: from + m.index + m[1].length,
        deco: constructorMark,
      });
    }

    // game.* namespace references
    gameNamespacePattern.lastIndex = 0;
    while ((m = gameNamespacePattern.exec(text))) {
      decorations.push({
        from: from + m.index,
        to: from + m.index + m[0].length,
        deco: namespaceMark,
      });
    }

    // events.* / socketEvents.*
    eventsPattern.lastIndex = 0;
    while ((m = eventsPattern.exec(text))) {
      decorations.push({
        from: from + m.index,
        to: from + m.index + m[0].length,
        deco: eventsMark,
      });
    }

    // Constellations-only: EParamType.*
    if (includeEParam) {
      eParamPattern.lastIndex = 0;
      while ((m = eParamPattern.exec(text))) {
        decorations.push({
          from: from + m.index,
          to: from + m.index + m[0].length,
          deco: eParamMark,
        });
      }
    }
  }

  decorations.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(decorations.map((d) => d.deco.range(d.from, d.to)));
}

function frameworkHighlighter(includeEParam: boolean) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, includeEParam);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view, includeEParam);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}

/* ── Theme for framework-specific classes ────────────────────── */

const frameworkTheme = EditorView.baseTheme({
  ".cm-anubis-constructor": {
    color: "var(--th-syntax-key, var(--th-text-sky-400, #38bdf8))",
    fontWeight: "bold",
  },
  ".cm-anubis-namespace": {
    color: "var(--th-text-teal-300, #5eead4)",
  },
  ".cm-anubis-events": {
    color: "var(--th-syntax-bool, var(--th-text-amber-400, #fbbf24))",
  },
  ".cm-anubis-eparam": {
    color: "var(--th-syntax-string, var(--th-text-emerald-400, #34d399))",
  },
});

/* ── Language exports ────────────────────────────────────────── */

const anubisLuaBase = StreamLanguage.define(lua);

export function anubisLua(): LanguageSupport {
  return new LanguageSupport(anubisLuaBase, [
    frameworkHighlighter(false),
    frameworkTheme,
  ]);
}

export function constellationsLua(): LanguageSupport {
  return new LanguageSupport(anubisLuaBase, [
    frameworkHighlighter(true),
    frameworkTheme,
  ]);
}
