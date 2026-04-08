/**
 * Convert Markdown text to BBCode format (for Nexus Mods).
 * Supports: headings, bold, italic, links, images, lists, code blocks, blockquotes.
 */
export function markdownToBBCode(md: string): string {
  let result = md;

  // Code blocks (before inline processing to protect content)
  result = result.replace(/```(\w*)\n([\s\S]*?)```/g, "[code]$2[/code]");

  // Inline code
  result = result.replace(/`([^`]+)`/g, "[font=Courier New]$1[/font]");

  // Images: ![alt](url)
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "[img]$2[/img]");

  // Links: [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "[url=$2]$1[/url]");

  // Headings
  result = result.replace(/^#{1,2}\s+(.+)$/gm, "[size=5][b]$1[/b][/size]");
  result = result.replace(/^#{3}\s+(.+)$/gm, "[size=4][b]$1[/b][/size]");
  result = result.replace(/^#{4,6}\s+(.+)$/gm, "[size=3][b]$1[/b][/size]");

  // Bold + italic
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, "[b][i]$1[/i][/b]");
  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, "[b]$1[/b]");
  // Italic
  result = result.replace(/\*(.+?)\*/g, "[i]$1[/i]");

  // Strikethrough
  result = result.replace(/~~(.+?)~~/g, "[s]$1[/s]");

  // Blockquotes
  result = result.replace(/^>\s+(.+)$/gm, "[quote]$1[/quote]");

  // Unordered lists
  result = result.replace(/^[-*+]\s+(.+)$/gm, "[list]\n[*]$1\n[/list]");
  // Merge consecutive list items
  result = result.replace(/\[\/list\]\n\[list\]\n/g, "");

  // Ordered lists
  result = result.replace(/^\d+\.\s+(.+)$/gm, "[list=1]\n[*]$1\n[/list]");
  result = result.replace(/\[\/list\]\n\[list=1\]\n/g, "");

  // Horizontal rule
  result = result.replace(/^[-*_]{3,}$/gm, "[line]");

  return result;
}
