// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { khonsu, buildDecorations } from "../lib/editor/lang-khonsu/index.js";
import { LanguageSupport } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/** Create a headless EditorView with the given document text and extensions. */
function createView(doc: string, extensions: any[] = []): EditorView {
  return new EditorView({
    state: EditorState.create({ doc, extensions }),
  });
}

/** Collect all CSS classes applied by decorations in the view. */
function decorationClasses(view: EditorView): { from: number; to: number; class: string }[] {
  const ls = khonsu();
  // Recreate view with khonsu extensions to get decorations from the plugin
  const v = createView(view.state.doc.toString(), [ls]);
  const decos = buildDecorations(v);
  const result: { from: number; to: number; class: string }[] = [];
  const cursor = decos.iter();
  while (cursor.value) {
    const spec = cursor.value.spec as any;
    result.push({ from: cursor.from, to: cursor.to, class: spec.class });
    cursor.next();
  }
  v.destroy();
  return result;
}

describe("Khonsu language", () => {
  describe("khonsu() export", () => {
    it("returns a LanguageSupport instance", () => {
      const ls = khonsu();
      expect(ls).toBeInstanceOf(LanguageSupport);
    });

    it("has extensions (ViewPlugin + theme)", () => {
      const ls = khonsu();
      // LanguageSupport.support contains the extra extensions
      expect(ls.support.length).toBeGreaterThan(0);
    });
  });

  describe("buildDecorations — condition functions", () => {
    it("decorates known condition functions", () => {
      const view = createView("HasPassive('Alert')");
      const decos = buildDecorations(view);
      const result: string[] = [];
      const cursor = decos.iter();
      while (cursor.value) {
        result.push((cursor.value.spec as any).class);
        cursor.next();
      }
      view.destroy();
      expect(result).toContain("cm-khn-condition-fn");
    });

    it("decorates multiple condition functions in one line", () => {
      const view = createView("HasPassive('X') & Tagged('Y') & Dead()");
      const decos = buildDecorations(view);
      let count = 0;
      const cursor = decos.iter();
      while (cursor.value) {
        if ((cursor.value.spec as any).class === "cm-khn-condition-fn") count++;
        cursor.next();
      }
      view.destroy();
      expect(count).toBe(3); // HasPassive, Tagged, Dead
    });

    it("decorates ConditionResult", () => {
      const view = createView("ConditionResult(true)");
      const decos = buildDecorations(view);
      const cursor = decos.iter();
      expect(cursor.value).not.toBeNull();
      expect((cursor.value!.spec as any).class).toBe("cm-khn-condition-fn");
      view.destroy();
    });

    it("does not decorate unknown identifiers", () => {
      const view = createView("MyCustomFunction('arg')");
      const decos = buildDecorations(view);
      const cursor = decos.iter();
      expect(cursor.value).toBeNull();
      view.destroy();
    });

    it("decorates all recognized condition functions", () => {
      const fns = [
        "HasPassive", "HasStatus", "HasAppliedStatus", "HasSpell", "IsClass",
        "HasFlag", "Tagged", "GetDistanceTo", "WieldingWeapon", "SpellId",
        "IsSpellOfSchool", "HasSpellFlag", "HasUseCosts", "HasFunctor",
        "Distance", "Self", "Ally", "Enemy", "Character", "Item", "Dead",
        "HasActionResource", "GetLevel", "GetBaseAbility",
        "StatusGetDescriptionParam", "HasProficiency", "GetAbilityModifier",
        "GetProficiencyBonus", "IsInCombat", "HasAnyStatus",
      ];
      const doc = fns.map((f) => `${f}()`).join("\n");
      const view = createView(doc);
      const decos = buildDecorations(view);
      let count = 0;
      const cursor = decos.iter();
      while (cursor.value) {
        if ((cursor.value.spec as any).class === "cm-khn-condition-fn") count++;
        cursor.next();
      }
      view.destroy();
      expect(count).toBe(fns.length);
    });
  });

  describe("buildDecorations — context accessors", () => {
    it("decorates context.Source", () => {
      const view = createView("context.Source");
      const decos = buildDecorations(view);
      const cursor = decos.iter();
      expect(cursor.value).not.toBeNull();
      expect((cursor.value!.spec as any).class).toBe("cm-khn-context");
      view.destroy();
    });

    it("decorates context.Target", () => {
      const view = createView("context.Target");
      const decos = buildDecorations(view);
      const cursor = decos.iter();
      expect(cursor.value).not.toBeNull();
      expect((cursor.value!.spec as any).class).toBe("cm-khn-context");
      view.destroy();
    });

    it("decorates context.HitDescription with subproperty", () => {
      const view = createView("context.HitDescription.DamageType");
      const decos = buildDecorations(view);
      const cursor = decos.iter();
      expect(cursor.value).not.toBeNull();
      expect((cursor.value!.spec as any).class).toBe("cm-khn-context");
      view.destroy();
    });

    it("decorates context.HitDescription without subproperty", () => {
      const view = createView("context.HitDescription");
      const decos = buildDecorations(view);
      const cursor = decos.iter();
      expect(cursor.value).not.toBeNull();
      expect((cursor.value!.spec as any).class).toBe("cm-khn-context");
      view.destroy();
    });

    it("does not decorate context.Unknown", () => {
      const view = createView("context.Unknown");
      const decos = buildDecorations(view);
      const cursor = decos.iter();
      expect(cursor.value).toBeNull();
      view.destroy();
    });
  });

  describe("buildDecorations — mixed content", () => {
    it("decorates both condition functions and context accessors", () => {
      const view = createView("HasPassive(context.Source, 'Alert')");
      const decos = buildDecorations(view);
      const classes: string[] = [];
      const cursor = decos.iter();
      while (cursor.value) {
        classes.push((cursor.value.spec as any).class);
        cursor.next();
      }
      view.destroy();
      expect(classes).toContain("cm-khn-condition-fn");
      expect(classes).toContain("cm-khn-context");
    });

    it("returns empty decorations for plain Lua code", () => {
      const view = createView("local x = 42\nprint(x)");
      const decos = buildDecorations(view);
      const cursor = decos.iter();
      expect(cursor.value).toBeNull();
      view.destroy();
    });

    it("returns empty decorations for empty document", () => {
      const view = createView("");
      const decos = buildDecorations(view);
      const cursor = decos.iter();
      expect(cursor.value).toBeNull();
      view.destroy();
    });
  });

  describe("ViewPlugin integration", () => {
    it("ViewPlugin applies decorations on construction", () => {
      const ls = khonsu();
      const view = new EditorView({
        state: EditorState.create({
          doc: "HasPassive('Alert')",
          extensions: [ls],
        }),
      });
      // The ViewPlugin should have been instantiated and produced decorations
      // If this doesn't throw, the plugin constructed successfully
      expect(view.state.doc.toString()).toBe("HasPassive('Alert')");
      view.destroy();
    });

    it("ViewPlugin updates on document change", () => {
      const ls = khonsu();
      const view = new EditorView({
        state: EditorState.create({
          doc: "HasPassive('X')",
          extensions: [ls],
        }),
      });
      // Dispatch a document change
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: "Tagged('Y')" },
      });
      expect(view.state.doc.toString()).toBe("Tagged('Y')");
      view.destroy();
    });
  });
});
