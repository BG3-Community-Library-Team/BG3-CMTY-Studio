import { describe, it, expect, beforeEach } from "vitest";
import { configurationRegistry } from "../lib/plugins/configurationRegistry.svelte.js";
import type { Disposable } from "../lib/plugins/pluginTypes.js";

describe("ConfigurationRegistry", () => {
  // Track disposables so we can clean up the singleton after each test
  const disposables: Disposable[] = [];

  beforeEach(() => {
    // Dispose all registrations from previous tests
    for (const d of disposables) {
      d.dispose();
    }
    disposables.length = 0;
  });

  // ── registerConfiguration / getSections ────────────────

  it("registers a schema and exposes it via getSections", () => {
    const d = configurationRegistry.registerConfiguration("plug.a", {
      title: "Section A",
      properties: {
        "plug.a.name": { type: "string", default: "hi", description: "Name" },
      },
    });
    disposables.push(d);

    const sections = configurationRegistry.getSections();
    expect(sections.some((s) => s.title === "Section A")).toBe(true);
  });

  // ── Default values ─────────────────────────────────────

  it("returns the schema default when no value has been set", () => {
    const d = configurationRegistry.registerConfiguration("plug.def", {
      title: "Defaults",
      properties: {
        "plug.def.flag": { type: "boolean", default: true, description: "Flag" },
      },
    });
    disposables.push(d);

    expect(configurationRegistry.get("plug.def.flag")).toBe(true);
  });

  // ── set / get ──────────────────────────────────────────

  it("set overrides the default and get returns the new value", () => {
    const d = configurationRegistry.registerConfiguration("plug.set", {
      title: "Setter",
      properties: {
        "plug.set.count": { type: "number", default: 0, description: "Count" },
      },
    });
    disposables.push(d);

    configurationRegistry.set("plug.set.count", 99);
    expect(configurationRegistry.get("plug.set.count")).toBe(99);
  });

  // ── Dispose removes schema ─────────────────────────────

  it("dispose removes the section from getSections", () => {
    const d = configurationRegistry.registerConfiguration("plug.rem", {
      title: "Removable",
      properties: {
        "plug.rem.x": { type: "string", default: "", description: "X" },
      },
    });

    expect(configurationRegistry.getSections().some((s) => s.title === "Removable")).toBe(true);

    d.dispose();

    expect(configurationRegistry.getSections().some((s) => s.title === "Removable")).toBe(false);
  });

  // ── Dispose removes values ─────────────────────────────

  it("dispose removes the property values for the disposed section", () => {
    const d = configurationRegistry.registerConfiguration("plug.val", {
      title: "Values",
      properties: {
        "plug.val.color": { type: "string", default: "red", description: "Color" },
      },
    });

    configurationRegistry.set("plug.val.color", "blue");
    expect(configurationRegistry.get("plug.val.color")).toBe("blue");

    d.dispose();

    // After dispose, value should be gone (returns undefined)
    expect(configurationRegistry.get("plug.val.color")).toBeUndefined();
  });

  // ── Multiple sections ──────────────────────────────────

  it("supports multiple sections from different plugins", () => {
    const d1 = configurationRegistry.registerConfiguration("plug.m1", {
      title: "Multi One",
      properties: {
        "plug.m1.a": { type: "string", default: "a", description: "A" },
      },
    });
    const d2 = configurationRegistry.registerConfiguration("plug.m2", {
      title: "Multi Two",
      properties: {
        "plug.m2.b": { type: "number", default: 2, description: "B" },
      },
    });
    disposables.push(d1, d2);

    const titles = configurationRegistry.getSections().map((s) => s.title);
    expect(titles).toContain("Multi One");
    expect(titles).toContain("Multi Two");
  });

  // ── getProperties ──────────────────────────────────────

  it("getProperties returns properties for a given section title", () => {
    const d = configurationRegistry.registerConfiguration("plug.props", {
      title: "Props Section",
      properties: {
        "plug.props.alpha": { type: "string", default: "", description: "Alpha" },
        "plug.props.beta": { type: "boolean", default: false, description: "Beta" },
      },
    });
    disposables.push(d);

    const props = configurationRegistry.getProperties("Props Section");
    expect(Object.keys(props)).toContain("plug.props.alpha");
    expect(Object.keys(props)).toContain("plug.props.beta");
  });

  it("getProperties returns empty object for unknown section", () => {
    const props = configurationRegistry.getProperties("Nonexistent");
    expect(props).toEqual({});
  });

  // ── getAllValues ────────────────────────────────────────

  it("getAllValues returns all stored values", () => {
    const d = configurationRegistry.registerConfiguration("plug.all", {
      title: "All Values",
      properties: {
        "plug.all.x": { type: "number", default: 1, description: "X" },
        "plug.all.y": { type: "number", default: 2, description: "Y" },
      },
    });
    disposables.push(d);

    configurationRegistry.set("plug.all.x", 10);

    const all = configurationRegistry.getAllValues();
    expect(all["plug.all.x"]).toBe(10);
    expect(all["plug.all.y"]).toBe(2); // default was applied on register
  });

  // ── restoreValues ──────────────────────────────────────

  it("restoreValues merges persisted values into current state", () => {
    const d = configurationRegistry.registerConfiguration("plug.restore", {
      title: "Restore",
      properties: {
        "plug.restore.lang": { type: "string", default: "en", description: "Lang" },
      },
    });
    disposables.push(d);

    configurationRegistry.restoreValues({ "plug.restore.lang": "fr" });

    expect(configurationRegistry.get("plug.restore.lang")).toBe("fr");
  });
});
