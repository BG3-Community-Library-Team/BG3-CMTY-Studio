import { describe, it, expect, beforeEach } from "vitest";
import type {
  CompletionPlugin,
  CompletionContext,
  CompletionItem,
} from "../lib/plugins/completionTypes.js";

// We import the class indirectly by creating fresh instances via the registry module
// But the exported singleton is mutable — we can test it directly.
// Better: test by importing from completionRegistry.ts which exports a singleton.
// Since we need isolated tests, let's re-create the class behavior.

function makeCtx(overrides: Partial<CompletionContext> = {}): CompletionContext {
  return {
    lineTextBeforeCursor: "",
    fullText: "",
    language: "lua",
    cursorOffset: 0,
    typedPrefix: "",
    ...overrides,
  };
}

function makePlugin(
  overrides: Partial<CompletionPlugin> & { id: string },
): CompletionPlugin {
  return {
    name: overrides.id,
    languages: ["lua"],
    priority: 100,
    getCompletions: () => [],
    ...overrides,
  };
}

// We test the singleton — reset it between tests
import { completionRegistry } from "../lib/plugins/completionRegistry.js";

describe("CompletionRegistry", () => {
  beforeEach(() => {
    // Unregister all plugins
    for (const p of completionRegistry.getRegisteredPlugins()) {
      completionRegistry.unregister(p.id);
    }
  });

  describe("register", () => {
    it("adds a plugin", () => {
      completionRegistry.register(makePlugin({ id: "test-a" }));
      expect(completionRegistry.getRegisteredPlugins()).toHaveLength(1);
    });

    it("deduplicates by id", () => {
      completionRegistry.register(makePlugin({ id: "dup" }));
      completionRegistry.register(makePlugin({ id: "dup" }));
      expect(completionRegistry.getRegisteredPlugins()).toHaveLength(1);
    });

    it("sorts plugins by priority", () => {
      completionRegistry.register(makePlugin({ id: "low", priority: 200 }));
      completionRegistry.register(makePlugin({ id: "high", priority: 10 }));
      const plugins = completionRegistry.getRegisteredPlugins();
      expect(plugins[0].id).toBe("high");
      expect(plugins[1].id).toBe("low");
    });

    it("uses default priority 100 when omitted", () => {
      completionRegistry.register(
        makePlugin({ id: "no-prio", priority: undefined }),
      );
      completionRegistry.register(makePlugin({ id: "low", priority: 200 }));
      const plugins = completionRegistry.getRegisteredPlugins();
      expect(plugins[0].id).toBe("no-prio");
      expect(plugins[1].id).toBe("low");
    });
  });

  describe("unregister", () => {
    it("removes a plugin by id", () => {
      completionRegistry.register(makePlugin({ id: "remove-me" }));
      completionRegistry.unregister("remove-me");
      expect(completionRegistry.getRegisteredPlugins()).toHaveLength(0);
    });

    it("no-ops for unknown id", () => {
      completionRegistry.register(makePlugin({ id: "keep" }));
      completionRegistry.unregister("nonexistent");
      expect(completionRegistry.getRegisteredPlugins()).toHaveLength(1);
    });
  });

  describe("getCompletions", () => {
    it("returns empty array when no plugins registered", () => {
      const result = completionRegistry.getCompletions(makeCtx());
      expect(result).toEqual([]);
    });

    it("returns completions from matching language", () => {
      completionRegistry.register(
        makePlugin({
          id: "lua-test",
          languages: ["lua"],
          getCompletions: () => [
            {
              label: "test",
              insertText: "test",
              detail: "d",
              kind: "function",
            },
          ],
        }),
      );
      const result = completionRegistry.getCompletions(
        makeCtx({ language: "lua" }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("test");
    });

    it("skips plugins that don't match language", () => {
      completionRegistry.register(
        makePlugin({
          id: "json-only",
          languages: ["json"],
          getCompletions: () => [
            {
              label: "nope",
              insertText: "nope",
              detail: "d",
              kind: "function",
            },
          ],
        }),
      );
      const result = completionRegistry.getCompletions(
        makeCtx({ language: "lua" }),
      );
      expect(result).toEqual([]);
    });

    it("includes wildcard language plugins", () => {
      completionRegistry.register(
        makePlugin({
          id: "wildcard",
          languages: ["*"],
          getCompletions: () => [
            {
              label: "wild",
              insertText: "wild",
              detail: "d",
              kind: "keyword",
            },
          ],
        }),
      );
      const result = completionRegistry.getCompletions(
        makeCtx({ language: "anything" }),
      );
      expect(result).toHaveLength(1);
    });

    it("sets source on items that lack it", () => {
      completionRegistry.register(
        makePlugin({
          id: "src-test",
          languages: ["lua"],
          getCompletions: () => [
            {
              label: "fn",
              insertText: "fn",
              detail: "d",
              kind: "function",
            },
          ],
        }),
      );
      const result = completionRegistry.getCompletions(
        makeCtx({ language: "lua" }),
      );
      expect(result[0].source).toBe("src-test");
    });

    it("preserves existing source", () => {
      completionRegistry.register(
        makePlugin({
          id: "src-test",
          languages: ["lua"],
          getCompletions: () => [
            {
              label: "fn",
              insertText: "fn",
              detail: "d",
              kind: "function",
              source: "custom-source",
            },
          ],
        }),
      );
      const result = completionRegistry.getCompletions(
        makeCtx({ language: "lua" }),
      );
      expect(result[0].source).toBe("custom-source");
    });

    it("sorts results by sortOrder then alphabetically", () => {
      completionRegistry.register(
        makePlugin({
          id: "sorter",
          languages: ["lua"],
          getCompletions: () => [
            {
              label: "zebra",
              insertText: "z",
              detail: "",
              kind: "function",
              sortOrder: 50,
            },
            {
              label: "alpha",
              insertText: "a",
              detail: "",
              kind: "function",
              sortOrder: 50,
            },
            {
              label: "first",
              insertText: "f",
              detail: "",
              kind: "function",
              sortOrder: 10,
            },
          ],
        }),
      );
      const result = completionRegistry.getCompletions(makeCtx());
      expect(result[0].label).toBe("first");
      expect(result[1].label).toBe("alpha");
      expect(result[2].label).toBe("zebra");
    });

    it("limits results to maxResults", () => {
      completionRegistry.register(
        makePlugin({
          id: "many",
          languages: ["lua"],
          getCompletions: () =>
            Array.from({ length: 50 }, (_, i) => ({
              label: `item${i}`,
              insertText: `item${i}`,
              detail: "",
              kind: "function" as const,
            })),
        }),
      );
      const result = completionRegistry.getCompletions(makeCtx(), 5);
      expect(result).toHaveLength(5);
    });

    it("catches and swallows plugin errors", () => {
      completionRegistry.register(
        makePlugin({
          id: "crasher",
          languages: ["lua"],
          getCompletions: () => {
            throw new Error("plugin boom");
          },
        }),
      );
      completionRegistry.register(
        makePlugin({
          id: "good",
          languages: ["lua"],
          getCompletions: () => [
            {
              label: "ok",
              insertText: "ok",
              detail: "d",
              kind: "function",
            },
          ],
        }),
      );
      // Should not throw, and the good plugin's results should still appear
      const result = completionRegistry.getCompletions(makeCtx());
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("ok");
    });

    it("uses default sortOrder 100 when omitted", () => {
      completionRegistry.register(
        makePlugin({
          id: "defaults",
          languages: ["lua"],
          getCompletions: () => [
            {
              label: "low",
              insertText: "l",
              detail: "",
              kind: "function",
              sortOrder: 200,
            },
            {
              label: "default",
              insertText: "d",
              detail: "",
              kind: "function",
            }, // no sortOrder
          ],
        }),
      );
      const result = completionRegistry.getCompletions(makeCtx());
      expect(result[0].label).toBe("default"); // sortOrder 100 < 200
      expect(result[1].label).toBe("low");
    });
  });
});
