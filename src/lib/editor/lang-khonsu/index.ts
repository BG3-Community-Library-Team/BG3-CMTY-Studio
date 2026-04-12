/**
 * BG3 Khonsu condition script language support for CodeMirror 6.
 * Extends Lua with additional highlighting for Khonsu-specific constructs:
 * condition functions, context accessors, ConditionResult, and bitwise operators.
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

/* ── Khonsu-specific identifiers ─────────────────────────────── */

/** Condition functions recognized by the Khonsu runtime. */
const CONDITION_FUNCTIONS = new Set([
  "ConditionResult",
  "HasPassive", "HasStatus", "HasAppliedStatus", "HasSpell", "IsClass",
  "HasFlag", "Tagged", "GetDistanceTo", "WieldingWeapon", "SpellId",
  "IsSpellOfSchool", "HasSpellFlag", "HasUseCosts", "HasFunctor",
  "Distance", "Self", "Ally", "Enemy", "Character", "Item", "Dead",
  "HasActionResource", "GetLevel", "GetBaseAbility",
  "StatusGetDescriptionParam", "HasProficiency", "GetAbilityModifier",
  "GetProficiencyBonus", "IsInCombat", "HasAnyStatus",
]);

/** Build a single regex that matches all condition function names at word boundaries. */
const conditionFnPattern = new RegExp(
  `\\b(${[...CONDITION_FUNCTIONS].join("|")})\\b`,
  "g",
);

/** context.Source, context.Target, context.HitDescription.* */
const contextAccessorPattern = /\bcontext\.(?:Source|Target|HitDescription(?:\.\w+)?)\b/g;

/* ── Decoration marks ────────────────────────────────────────── */

const conditionFnMark = Decoration.mark({ class: "cm-khn-condition-fn" });
const contextAccessorMark = Decoration.mark({ class: "cm-khn-context" });

/** @internal — exported for testing */
export function buildDecorations(view: EditorView): DecorationSet {
  const decorations: { from: number; to: number; deco: Decoration }[] = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);

    // Condition functions
    conditionFnPattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = conditionFnPattern.exec(text))) {
      decorations.push({
        from: from + m.index,
        to: from + m.index + m[0].length,
        deco: conditionFnMark,
      });
    }

    // Context accessors
    contextAccessorPattern.lastIndex = 0;
    while ((m = contextAccessorPattern.exec(text))) {
      decorations.push({
        from: from + m.index,
        to: from + m.index + m[0].length,
        deco: contextAccessorMark,
      });
    }
  }

  // Sort by position (required by RangeSet)
  decorations.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(decorations.map((d) => d.deco.range(d.from, d.to)));
}

const khonsuHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

/* ── Theme for Khonsu-specific classes ───────────────────────── */

const khonsuTheme = EditorView.baseTheme({
  ".cm-khn-condition-fn": {
    color: "var(--th-syntax-key, var(--th-text-sky-400, #38bdf8))",
    fontWeight: "bold",
  },
  ".cm-khn-context": {
    color: "var(--th-text-teal-300, #5eead4)",
  },
});

/* ── Language export ─────────────────────────────────────────── */

const khonsuLua = StreamLanguage.define(lua);

export function khonsu(): LanguageSupport {
  return new LanguageSupport(khonsuLua, [khonsuHighlighter, khonsuTheme]);
}
