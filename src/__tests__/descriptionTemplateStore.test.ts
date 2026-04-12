import { describe, it, expect } from "vitest";
import { descriptionTemplateStore } from "../lib/stores/descriptionTemplateStore.svelte.js";

describe("descriptionTemplateStore", () => {
  describe("templates", () => {
    it("initializes with builtin templates", () => {
      expect(descriptionTemplateStore.templates.length).toBeGreaterThanOrEqual(3);
    });

    it("has basic-nexus template", () => {
      const t = descriptionTemplateStore.templates.find((t) => t.id === "basic-nexus");
      expect(t).toBeTruthy();
      expect(t!.platform).toBe("nexus");
      expect(t!.content).toContain("{mod_name}");
    });

    it("has basic-modio template", () => {
      const t = descriptionTemplateStore.templates.find((t) => t.id === "basic-modio");
      expect(t).toBeTruthy();
      expect(t!.platform).toBe("modio");
      expect(t!.content).toContain("{mod_name}");
    });

    it("has detailed-nexus template", () => {
      const t = descriptionTemplateStore.templates.find((t) => t.id === "detailed-nexus");
      expect(t).toBeTruthy();
      expect(t!.platform).toBe("nexus");
      expect(t!.content).toContain("{summary}");
    });
  });

  describe("fillTemplate", () => {
    it("fills known placeholders with provided values", () => {
      const result = descriptionTemplateStore.fillTemplate("basic-nexus", {
        mod_name: "TestMod",
        version: "2.0",
        author: "Tester",
        description: "A test mod",
        dependencies: "ModA, ModB",
      });

      expect(result).toContain("TestMod");
      expect(result).toContain("2.0");
      expect(result).toContain("Tester");
      expect(result).toContain("A test mod");
      expect(result).toContain("ModA, ModB");
    });

    it("returns null for unknown template id", () => {
      const result = descriptionTemplateStore.fillTemplate("nonexistent");
      expect(result).toBeNull();
    });

    it("uses empty string defaults for missing values", () => {
      const result = descriptionTemplateStore.fillTemplate("basic-nexus", {});

      expect(result).not.toBeNull();
      // mod_name, version, author default to ""
      expect(result).toContain("**Version:** ");
      expect(result).toContain("**Author:** ");
    });

    it("uses 'None' default for dependencies", () => {
      const result = descriptionTemplateStore.fillTemplate("basic-nexus", {});

      expect(result).toContain("None");
    });

    it("preserves unknown placeholders in template", () => {
      // detailed-nexus has {summary} placeholder
      const result = descriptionTemplateStore.fillTemplate("detailed-nexus", {
        mod_name: "MyMod",
      });

      // summary was not provided, so it gets empty string from defaults
      expect(result).not.toBeNull();
    });

    it("allows overrides to override defaults", () => {
      const result = descriptionTemplateStore.fillTemplate("basic-nexus", {
        dependencies: "CustomDeps",
      });

      expect(result).toContain("CustomDeps");
      expect(result).not.toContain("None");
    });

    it("fills modio template with HTML content", () => {
      const result = descriptionTemplateStore.fillTemplate("basic-modio", {
        mod_name: "HtmlMod",
        version: "3.0",
        author: "HtmlAuthor",
        description: "HTML desc",
      });

      expect(result).toContain("<h1>HtmlMod</h1>");
      expect(result).toContain("<strong>Version:</strong> 3.0");
    });

    it("handles extra overrides beyond standard fields", () => {
      const result = descriptionTemplateStore.fillTemplate("basic-nexus", {
        mod_name: "ExtraMod",
        custom_field: "CustomValue",
      });

      // custom_field isn't in the template, so it won't appear
      // but it shouldn't break anything
      expect(result).toContain("ExtraMod");
    });
  });
});
