<!--
  DiffView — Standalone diff viewer component.
  Computes diff between two text strings using the `diff` npm package,
  then renders via DiffRenderer.
-->
<script lang="ts">
  import { diffLines } from "diff";
  import DiffRenderer, { type DiffHunk, type DiffLine } from "./DiffRenderer.svelte";
  import Columns2 from "@lucide/svelte/icons/columns-2";
  import AlignJustify from "@lucide/svelte/icons/align-justify";
  import FileCode from "@lucide/svelte/icons/file-code";
  import { m } from "../../paraglide/messages.js";

  interface Props {
    leftContent: string;
    rightContent: string;
    leftLabel?: string;
    rightLabel?: string;
    language?: string;
  }

  let { leftContent, rightContent, leftLabel = "Original", rightLabel = "Modified", language }: Props = $props();

  let viewMode: "unified" | "split" = $state("unified");

  function computeHunks(left: string, right: string): DiffHunk[] {
    const changes = diffLines(left, right);
    if (changes.length === 0) return [];

    // Check if there are any actual changes
    const hasChanges = changes.some(c => c.added || c.removed);
    if (!hasChanges) return [];

    const lines: DiffLine[] = [];
    let oldLineNo = 1;
    let newLineNo = 1;

    for (const change of changes) {
      const changeLines = change.value.replace(/\n$/, "").split("\n");
      for (const lineContent of changeLines) {
        if (change.added) {
          lines.push({ content: lineContent, type: "add", newLineNo: newLineNo++ });
        } else if (change.removed) {
          lines.push({ content: lineContent, type: "remove", oldLineNo: oldLineNo++ });
        } else {
          lines.push({ content: lineContent, type: "context", oldLineNo: oldLineNo++, newLineNo: newLineNo++ });
        }
      }
    }

    // Group into hunks: contiguous changed lines with context
    const hunks: DiffHunk[] = [];
    const CONTEXT = 3;
    let hunkLines: DiffLine[] = [];
    let hunkStart = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isChange = line.type !== "context";

      if (isChange) {
        if (hunkStart === -1) {
          // Start new hunk with preceding context
          hunkStart = i;
          const contextStart = Math.max(0, i - CONTEXT);
          for (let j = contextStart; j < i; j++) {
            hunkLines.push(lines[j]);
          }
        }
        hunkLines.push(line);
      } else if (hunkStart !== -1) {
        // Check if next change is within context distance
        let nextChange = -1;
        for (let j = i + 1; j < lines.length && j <= i + CONTEXT * 2; j++) {
          if (lines[j].type !== "context") { nextChange = j; break; }
        }

        if (nextChange !== -1 && nextChange - i <= CONTEXT * 2) {
          // Bridge the gap
          hunkLines.push(line);
        } else {
          // Finish hunk with trailing context
          const contextEnd = Math.min(lines.length, i + CONTEXT);
          for (let j = i; j < contextEnd; j++) {
            hunkLines.push(lines[j]);
          }
          const firstOld = hunkLines.find(l => l.oldLineNo)?.oldLineNo ?? 1;
          const firstNew = hunkLines.find(l => l.newLineNo)?.newLineNo ?? 1;
          hunks.push({
            header: `@@ -${firstOld} +${firstNew} @@`,
            lines: hunkLines,
          });
          hunkLines = [];
          hunkStart = -1;
        }
      }
    }

    // Close any remaining hunk
    if (hunkLines.length > 0) {
      const firstOld = hunkLines.find(l => l.oldLineNo)?.oldLineNo ?? 1;
      const firstNew = hunkLines.find(l => l.newLineNo)?.newLineNo ?? 1;
      hunks.push({
        header: `@@ -${firstOld} +${firstNew} @@`,
        lines: hunkLines,
      });
    }

    return hunks;
  }

  let hunks = $derived(computeHunks(leftContent, rightContent));
  let hasChanges = $derived(hunks.length > 0);

  function toggleViewMode() {
    viewMode = viewMode === "unified" ? "split" : "unified";
  }
</script>

<div class="diff-view">
  <div class="diff-toolbar">
    <div class="diff-labels">
      <FileCode size={14} class="text-[var(--th-text-500)]" />
      <span class="diff-label-left">{leftLabel}</span>
      <span class="diff-label-arrow">→</span>
      <span class="diff-label-right">{rightLabel}</span>
    </div>
    <div class="diff-controls">
      <button
        class="diff-mode-btn"
        class:active={viewMode === "unified"}
        onclick={() => { viewMode = "unified"; }}
        title={m.diff_view_unified()}
        aria-label={m.diff_view_unified()}
      >
        <AlignJustify size={14} />
      </button>
      <button
        class="diff-mode-btn"
        class:active={viewMode === "split"}
        onclick={() => { viewMode = "split"; }}
        title={m.diff_view_split()}
        aria-label={m.diff_view_split()}
      >
        <Columns2 size={14} />
      </button>
    </div>
  </div>

  {#if !hasChanges}
    <div class="diff-empty">
      <p class="text-sm text-[var(--th-text-500)]">{m.diff_view_no_changes()}</p>
    </div>
  {:else}
    <div class="diff-content">
      <DiffRenderer {hunks} {viewMode} {leftLabel} {rightLabel} />
    </div>
  {/if}
</div>

<style>
  .diff-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .diff-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--th-bg-900);
    border-bottom: 1px solid var(--th-border-800);
    flex-shrink: 0;
  }

  .diff-labels {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .diff-label-left,
  .diff-label-right {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--th-text-300);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .diff-label-arrow {
    font-size: 0.75rem;
    color: var(--th-text-600);
    flex-shrink: 0;
  }

  .diff-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .diff-mode-btn {
    display: flex;
    align-items: center;
    padding: 3px 6px;
    border: none;
    background: transparent;
    color: var(--th-text-500);
    cursor: pointer;
    border-radius: 4px;
    transition: color 0.15s, background 0.15s;
  }

  .diff-mode-btn:hover {
    color: var(--th-text-200);
    background: var(--th-bg-700);
  }

  .diff-mode-btn.active {
    color: var(--th-accent-400);
    background: var(--th-bg-700);
  }

  .diff-content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .diff-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
  }
</style>
