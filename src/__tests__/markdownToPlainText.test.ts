import { describe, it, expect } from "vitest";
import { markdownToPlainText } from "../lib/utils/markdownToPlainText.js";

describe("markdownToPlainText", () => {
  // ── Happy Paths ─────────────────────────────────────────────

  describe("happy paths", () => {
    it("converts H1 to uppercased text preceded by blank line", () => {
      const result = markdownToPlainText("# Hello World");
      expect(result).toContain("HELLO WORLD");
    });

    it("converts H2 to text preceded by blank line and followed by ---", () => {
      const result = markdownToPlainText("## Section Title");
      const lines = result.split("\n");
      const idx = lines.findIndex((l) => l === "Section Title");
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(lines[idx + 1]).toBe("---");
    });

    it("converts H3 to plain text preceded by blank line", () => {
      const result = markdownToPlainText("### Sub-section");
      expect(result).toContain("Sub-section");
      // Should not have --- after it
      const lines = result.split("\n");
      const idx = lines.findIndex((l) => l === "Sub-section");
      expect(lines[idx + 1]).not.toBe("---");
    });

    it("converts H4 through H6", () => {
      expect(markdownToPlainText("#### H4 Text")).toContain("H4 Text");
      expect(markdownToPlainText("##### H5 Text")).toContain("H5 Text");
      expect(markdownToPlainText("###### H6 Text")).toContain("H6 Text");
    });

    it("strips bold formatting", () => {
      const result = markdownToPlainText("This is **bold** text");
      expect(result).toContain("This is bold text");
    });

    it("strips italic formatting", () => {
      const result = markdownToPlainText("This is *italic* text");
      expect(result).toContain("This is italic text");
    });

    it("converts links to text (url) format", () => {
      const result = markdownToPlainText("[click here](https://example.com)");
      expect(result).toContain("click here (https://example.com)");
    });

    it("converts images to [Image: alt] format", () => {
      const result = markdownToPlainText("![screenshot](https://img.png)");
      expect(result).toContain("[Image: screenshot]");
    });

    it("strips inline code backticks", () => {
      const result = markdownToPlainText("Use the `console.log` function");
      expect(result).toContain("Use the console.log function");
    });

    it("indents fenced code blocks by 4 spaces", () => {
      const md = "```js\nconst x = 1;\nconst y = 2;\n```";
      const result = markdownToPlainText(md);
      expect(result).toContain("    const x = 1;");
      expect(result).toContain("    const y = 2;");
    });

    it("converts unordered list items with bullet", () => {
      const result = markdownToPlainText("- First item\n- Second item");
      expect(result).toContain("• First item");
      expect(result).toContain("• Second item");
    });

    it("preserves ordered list numbering", () => {
      const result = markdownToPlainText("1. First\n2. Second\n3. Third");
      expect(result).toContain("1. First");
      expect(result).toContain("2. Second");
      expect(result).toContain("3. Third");
    });

    it("converts blockquotes with vertical bar", () => {
      const result = markdownToPlainText("> This is a quote");
      expect(result).toContain("│ This is a quote");
    });

    it("converts horizontal rules to unicode line", () => {
      const result = markdownToPlainText("---");
      expect(result).toContain("────────────────");
    });

    it("converts *** horizontal rule", () => {
      const result = markdownToPlainText("***");
      expect(result).toContain("────────────────");
    });

    it("converts ___ horizontal rule", () => {
      const result = markdownToPlainText("___");
      expect(result).toContain("────────────────");
    });

    it("strips HTML tags", () => {
      const result = markdownToPlainText("<strong>bold</strong> and <em>italic</em>");
      expect(result).toContain("bold and italic");
      expect(result).not.toContain("<strong>");
      expect(result).not.toContain("<em>");
    });

    it("strips strikethrough", () => {
      const result = markdownToPlainText("This is ~~deleted~~ text");
      expect(result).toContain("This is deleted text");
    });
  });

  // ── Unhappy Paths ───────────────────────────────────────────

  describe("unhappy paths", () => {
    it("returns single newline for empty string", () => {
      const result = markdownToPlainText("");
      expect(result).toBe("\n");
    });

    it("trims whitespace-only input", () => {
      const result = markdownToPlainText("   \n  \n   ");
      expect(result.trim()).toBe("");
    });

    it("handles nested formatting (bold + italic)", () => {
      const result = markdownToPlainText("***bold italic***");
      expect(result).toContain("bold italic");
      expect(result).not.toContain("*");
    });

    it("handles unmatched bold markers gracefully", () => {
      // Unmatched ** should stay as-is (regex won't match)
      const result = markdownToPlainText("**unmatched bold");
      // Should not throw, should return something
      expect(typeof result).toBe("string");
    });

    it("handles extremely long lines without error", () => {
      const longLine = "word ".repeat(10000);
      const result = markdownToPlainText(longLine);
      expect(result.length).toBeGreaterThan(0);
    });

    it("handles __text__ bold syntax", () => {
      const result = markdownToPlainText("This is __bold__ text");
      expect(result).toContain("This is bold text");
    });

    it("handles ___text___ bold+italic syntax", () => {
      const result = markdownToPlainText("___bold italic___");
      expect(result).toContain("bold italic");
    });
  });

  // ── Semi-happy Paths ────────────────────────────────────────

  describe("semi-happy paths", () => {
    it("handles mixed elements in one document", () => {
      const md = [
        "# Title",
        "",
        "Some **bold** and *italic* text.",
        "",
        "## Subsection",
        "",
        "- Item 1",
        "- Item 2",
        "",
        "> A quote",
        "",
        "```",
        "code here",
        "```",
        "",
        "---",
        "",
        "Final paragraph with a [link](http://example.com).",
      ].join("\n");

      const result = markdownToPlainText(md);
      expect(result).toContain("TITLE");
      expect(result).toContain("Some bold and italic text.");
      expect(result).toContain("Subsection");
      expect(result).toContain("• Item 1");
      expect(result).toContain("│ A quote");
      expect(result).toContain("    code here");
      expect(result).toContain("────────────────");
      expect(result).toContain("link (http://example.com)");
    });

    it("handles multiple consecutive headings", () => {
      const md = "# First\n## Second\n### Third";
      const result = markdownToPlainText(md);
      expect(result).toContain("FIRST");
      expect(result).toContain("Second");
      expect(result).toContain("Third");
    });

    it("handles blockquote with empty content", () => {
      const result = markdownToPlainText(">");
      expect(result).toContain("│");
    });

    it("handles unordered list with * marker", () => {
      const result = markdownToPlainText("* starred item");
      expect(result).toContain("• starred item");
    });

    it("handles unordered list with + marker", () => {
      const result = markdownToPlainText("+ plus item");
      expect(result).toContain("• plus item");
    });

    it("limits consecutive blank lines to max two", () => {
      const md = "Line 1\n\n\n\n\nLine 2";
      const result = markdownToPlainText(md);
      expect(result).not.toMatch(/\n{3,}/);
    });

    it("handles fenced code block without language tag", () => {
      const md = "```\nplain code\n```";
      const result = markdownToPlainText(md);
      expect(result).toContain("    plain code");
    });

    it("handles fenced code block with language tag", () => {
      const md = "```typescript\nconst x: number = 1;\n```";
      const result = markdownToPlainText(md);
      expect(result).toContain("    const x: number = 1;");
    });

    it("handles image with empty alt text", () => {
      const result = markdownToPlainText("![](https://img.png)");
      expect(result).toContain("[Image: ]");
    });

    it("strips bold within heading", () => {
      const result = markdownToPlainText("# **Bold Heading**");
      expect(result).toContain("BOLD HEADING");
      expect(result).not.toContain("**");
    });
  });
});
