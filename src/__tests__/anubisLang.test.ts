// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  anubisLua,
  constellationsLua,
  buildDecorations,
} from "../lib/editor/lang-anubis/index.js";
import { LanguageSupport } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/** Create a headless EditorView with the given document text. */
function createView(doc: string): EditorView {
  return new EditorView({
    state: EditorState.create({ doc }),
  });
}

/** Collect decoration classes from buildDecorations. */
function collectDecos(
  doc: string,
  includeEParam: boolean,
): { from: number; to: number; class: string }[] {
  const view = createView(doc);
  const decos = buildDecorations(view, includeEParam);
  const result: { from: number; to: number; class: string }[] = [];
  const cursor = decos.iter();
  while (cursor.value) {
    result.push({
      from: cursor.from,
      to: cursor.to,
      class: (cursor.value.spec as any).class,
    });
    cursor.next();
  }
  view.destroy();
  return result;
}

describe("Anubis & Constellations language", () => {
  describe("exports", () => {
    it("anubisLua() returns a LanguageSupport instance", () => {
      expect(anubisLua()).toBeInstanceOf(LanguageSupport);
    });

    it("constellationsLua() returns a LanguageSupport instance", () => {
      expect(constellationsLua()).toBeInstanceOf(LanguageSupport);
    });

    it("both share the same base language", () => {
      const a = anubisLua();
      const c = constellationsLua();
      expect(a.language).toBe(c.language);
    });

    it("anubisLua has extensions", () => {
      expect((anubisLua().support as readonly unknown[]).length).toBeGreaterThan(0);
    });

    it("constellationsLua has extensions", () => {
      expect((constellationsLua().support as readonly unknown[]).length).toBeGreaterThan(0);
    });
  });

  describe("buildDecorations — constructors", () => {
    it("decorates Config {", () => {
      const decos = collectDecos("Config {}", false);
      expect(decos.some((d) => d.class === "cm-anubis-constructor")).toBe(true);
    });

    it("decorates constructor name only, not the brace", () => {
      const decos = collectDecos("Config {}", false);
      const ctor = decos.find((d) => d.class === "cm-anubis-constructor")!;
      expect("Config {".slice(ctor.from, ctor.to)).toBe("Config");
    });

    it("decorates all recognized constructors", () => {
      const ctors = [
        "Config", "State", "StateRef", "Action", "Selector",
        "ImmediateSelector", "Sequence", "Parallel", "RandomSelector",
        "Proxy", "TriggerOutput", "ExtSocket", "AnubisModule",
      ];
      const doc = ctors.map((c) => `${c} {}`).join("\n");
      const decos = collectDecos(doc, false);
      const ctorDecos = decos.filter((d) => d.class === "cm-anubis-constructor");
      expect(ctorDecos.length).toBe(ctors.length);
    });

    it("does not decorate identifier without trailing brace", () => {
      const decos = collectDecos("Config()", false);
      expect(decos.some((d) => d.class === "cm-anubis-constructor")).toBe(false);
    });

    it("handles constructor with whitespace before brace", () => {
      const decos = collectDecos("Config   {}", false);
      expect(decos.some((d) => d.class === "cm-anubis-constructor")).toBe(true);
    });
  });

  describe("buildDecorations — game namespaces", () => {
    it("decorates game.configs.*", () => {
      const decos = collectDecos("game.configs.MyConfig", false);
      expect(decos.some((d) => d.class === "cm-anubis-namespace")).toBe(true);
    });

    it("decorates game.states.*", () => {
      const decos = collectDecos("game.states.PlayerState", false);
      expect(decos.some((d) => d.class === "cm-anubis-namespace")).toBe(true);
    });

    it("decorates game.roots.*", () => {
      const decos = collectDecos("game.roots.MainRoot", false);
      expect(decos.some((d) => d.class === "cm-anubis-namespace")).toBe(true);
    });

    it("decorates game.actions.*", () => {
      const decos = collectDecos("game.actions.Attack", false);
      expect(decos.some((d) => d.class === "cm-anubis-namespace")).toBe(true);
    });

    it("decorates game.expressions.*", () => {
      const decos = collectDecos("game.expressions.IsAlive", false);
      expect(decos.some((d) => d.class === "cm-anubis-namespace")).toBe(true);
    });

    it("does not decorate game.unknown.*", () => {
      const decos = collectDecos("game.unknown.Foo", false);
      expect(decos.some((d) => d.class === "cm-anubis-namespace")).toBe(false);
    });
  });

  describe("buildDecorations — events", () => {
    it("decorates events.* pattern", () => {
      const decos = collectDecos("events.OnHit", false);
      expect(decos.some((d) => d.class === "cm-anubis-events")).toBe(true);
    });

    it("decorates Events.* capitalized", () => {
      const decos = collectDecos("Events.OnDeath", false);
      expect(decos.some((d) => d.class === "cm-anubis-events")).toBe(true);
    });

    it("decorates socketEvents.*", () => {
      const decos = collectDecos("socketEvents.Connect", false);
      expect(decos.some((d) => d.class === "cm-anubis-events")).toBe(true);
    });
  });

  describe("buildDecorations — EParamType (Constellations only)", () => {
    it("does NOT decorate EParamType when includeEParam=false", () => {
      const decos = collectDecos("EParamType.Strength", false);
      expect(decos.some((d) => d.class === "cm-anubis-eparam")).toBe(false);
    });

    it("decorates EParamType when includeEParam=true", () => {
      const decos = collectDecos("EParamType.Strength", true);
      expect(decos.some((d) => d.class === "cm-anubis-eparam")).toBe(true);
    });

    it("decorates multiple EParamType references", () => {
      const decos = collectDecos(
        "EParamType.Strength\nEParamType.Dexterity\nEParamType.Constitution",
        true,
      );
      const eParamDecos = decos.filter((d) => d.class === "cm-anubis-eparam");
      expect(eParamDecos.length).toBe(3);
    });
  });

  describe("buildDecorations — mixed content", () => {
    it("decorates constructors and namespaces in same document", () => {
      const doc = "Config {\n  game.configs.MyConfig\n}";
      const decos = collectDecos(doc, false);
      expect(decos.some((d) => d.class === "cm-anubis-constructor")).toBe(true);
      expect(decos.some((d) => d.class === "cm-anubis-namespace")).toBe(true);
    });

    it("returns empty decorations for plain Lua code", () => {
      const decos = collectDecos("local x = 42\nprint(x)", false);
      expect(decos.length).toBe(0);
    });

    it("returns empty decorations for empty document", () => {
      const decos = collectDecos("", false);
      expect(decos.length).toBe(0);
    });

    it("decorates all categories simultaneously in Constellations mode", () => {
      const doc = [
        "Config {",
        "  game.configs.Test",
        "  events.OnInit",
        "  EParamType.Str",
        "}",
      ].join("\n");
      const decos = collectDecos(doc, true);
      const classSet = new Set(decos.map((d) => d.class));
      expect(classSet.has("cm-anubis-constructor")).toBe(true);
      expect(classSet.has("cm-anubis-namespace")).toBe(true);
      expect(classSet.has("cm-anubis-events")).toBe(true);
      expect(classSet.has("cm-anubis-eparam")).toBe(true);
    });
  });

  describe("ViewPlugin integration", () => {
    it("anubisLua ViewPlugin applies decorations on construction", () => {
      const ls = anubisLua();
      const view = new EditorView({
        state: EditorState.create({
          doc: "Config {\n  game.configs.Test\n}",
          extensions: [ls],
        }),
      });
      expect(view.state.doc.toString()).toContain("Config");
      view.destroy();
    });

    it("constellationsLua ViewPlugin applies decorations on construction", () => {
      const ls = constellationsLua();
      const view = new EditorView({
        state: EditorState.create({
          doc: "EParamType.Strength",
          extensions: [ls],
        }),
      });
      expect(view.state.doc.toString()).toContain("EParamType");
      view.destroy();
    });

    it("ViewPlugin updates on document change", () => {
      const ls = anubisLua();
      const view = new EditorView({
        state: EditorState.create({
          doc: "Config {}",
          extensions: [ls],
        }),
      });
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: "State {}" },
      });
      expect(view.state.doc.toString()).toBe("State {}");
      view.destroy();
    });
  });
});
