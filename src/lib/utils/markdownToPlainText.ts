/**
 * Convert Markdown text to plain text while preserving readable structure.
 * Strips all Markdown markup, converting headings, lists, links, code blocks,
 * blockquotes, and HTML tags into a clean plain-text format.
 */
export function markdownToPlainText(markdown: string): string {
  let result = markdown;

  // Strip HTML tags
  result = result.replace(/<[^>]+>/g, "");

  // Process fenced code blocks: indent 4 spaces, remove language tag
  result = result.replace(/```\w*\n([\s\S]*?)```/g, (_m, code: string) => {
    const indented = code
      .trimEnd()
      .split("\n")
      .map((line: string) => "    " + line)
      .join("\n");
    return "\n" + indented + "\n";
  });

  // Process line by line for block-level elements
  const lines = result.split("\n");
  const out: string[] = [];

  for (const line of lines) {
    // Indented code block lines (from fenced block processing) — pass through
    if (line.startsWith("    ")) {
      out.push(line);
      continue;
    }

    // Horizontal rules
    if (/^---+\s*$/.test(line) || /^\*\*\*+\s*$/.test(line) || /^___+\s*$/.test(line)) {
      out.push("────────────────");
      continue;
    }

    // H1: uppercase, preceded by blank line
    const h1Match = line.match(/^#\s+(.+)$/);
    if (h1Match) {
      out.push("");
      out.push(stripInline(h1Match[1]).toUpperCase());
      continue;
    }

    // H2: preceded by blank line, followed by ---
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      out.push("");
      out.push(stripInline(h2Match[1]));
      out.push("---");
      continue;
    }

    // H3-H6: preceded by blank line
    const hMatch = line.match(/^#{3,6}\s+(.+)$/);
    if (hMatch) {
      out.push("");
      out.push(stripInline(hMatch[1]));
      continue;
    }

    // Blockquotes
    const bqMatch = line.match(/^>\s?(.*)$/);
    if (bqMatch) {
      out.push("  │ " + stripInline(bqMatch[1]));
      continue;
    }

    // Unordered list items
    const ulMatch = line.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      out.push("• " + stripInline(ulMatch[1]));
      continue;
    }

    // Ordered list items — preserve numbering
    const olMatch = line.match(/^(\d+\.)\s+(.+)$/);
    if (olMatch) {
      out.push(olMatch[1] + " " + stripInline(olMatch[2]));
      continue;
    }

    // Regular line — strip inline formatting
    out.push(stripInline(line));
  }

  // Clean up excessive blank lines (max 2 consecutive)
  let text = out.join("\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  // Strip leading/trailing blank lines but preserve indentation
  return text.replace(/^\n+/, "").replace(/\n+$/, "") + "\n";
}

/** Strip inline Markdown formatting from a single line. */
function stripInline(text: string): string {
  let s = text;

  // Images: ![alt](url) → [Image: alt]
  s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, "[Image: $1]");

  // Links: [text](url) → text (url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");

  // Bold + italic combined: ***text*** or ___text___
  s = s.replace(/\*{3}(.+?)\*{3}/g, "$1");
  s = s.replace(/_{3}(.+?)_{3}/g, "$1");

  // Bold: **text** or __text__
  s = s.replace(/\*{2}(.+?)\*{2}/g, "$1");
  s = s.replace(/_{2}(.+?)_{2}/g, "$1");

  // Italic: *text* or _text_
  s = s.replace(/\*(.+?)\*/g, "$1");
  s = s.replace(/(?<!\w)_(.+?)_(?!\w)/g, "$1");

  // Inline code: `code`
  s = s.replace(/`([^`]+)`/g, "$1");

  // Strikethrough: ~~text~~
  s = s.replace(/~~(.+?)~~/g, "$1");

  return s;
}
