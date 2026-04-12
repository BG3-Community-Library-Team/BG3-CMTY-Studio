<!--
  DiffRenderer — Shared diff rendering component.
  Renders DiffHunk[] in unified or split view mode.
  Independent from git/ components — uses its own types.
-->
<script lang="ts">
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import { m } from "../../paraglide/messages.js";

  export interface DiffLine {
    content: string;
    type: "add" | "remove" | "context";
    oldLineNo?: number;
    newLineNo?: number;
  }

  export interface DiffHunk {
    header: string;
    lines: DiffLine[];
  }

  interface Props {
    hunks: DiffHunk[];
    viewMode: "unified" | "split";
    leftLabel?: string;
    rightLabel?: string;
  }

  let { hunks, viewMode, leftLabel = "Original", rightLabel = "Modified" }: Props = $props();

  let currentHunkIndex = $state(0);

  function navigateHunk(direction: 1 | -1) {
    const newIndex = currentHunkIndex + direction;
    currentHunkIndex = Math.max(0, Math.min(hunks.length - 1, newIndex));
    const el = document.querySelector(`[data-diff-hunk-index="${currentHunkIndex}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function splitLines(lines: DiffLine[]): { left: (DiffLine | null)[]; right: (DiffLine | null)[] } {
    const left: (DiffLine | null)[] = [];
    const right: (DiffLine | null)[] = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.type === "context") {
        left.push(line);
        right.push(line);
        i++;
      } else if (line.type === "remove") {
        const dels: DiffLine[] = [];
        while (i < lines.length && lines[i].type === "remove") {
          dels.push(lines[i]);
          i++;
        }
        const adds: DiffLine[] = [];
        while (i < lines.length && lines[i].type === "add") {
          adds.push(lines[i]);
          i++;
        }
        const max = Math.max(dels.length, adds.length);
        for (let j = 0; j < max; j++) {
          left.push(j < dels.length ? dels[j] : null);
          right.push(j < adds.length ? adds[j] : null);
        }
      } else if (line.type === "add") {
        left.push(null);
        right.push(line);
        i++;
      } else {
        i++;
      }
    }

    return { left, right };
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    switch (e.key) {
      case "j":
        e.preventDefault();
        navigateHunk(1);
        break;
      case "k":
        e.preventDefault();
        navigateHunk(-1);
        break;
      case "u":
        e.preventDefault();
        break;
      case "s":
        e.preventDefault();
        break;
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="diff-renderer" onkeydown={handleKeydown}>
  {#if hunks.length > 1}
    <div class="hunk-nav">
      <button
        class="hunk-nav-btn"
        onclick={() => navigateHunk(-1)}
        disabled={currentHunkIndex <= 0}
        aria-label={m.diff_view_prev_change()}
        title={m.diff_view_prev_change()}
      >
        <ChevronUp size={14} />
      </button>
      <span class="hunk-nav-label">{currentHunkIndex + 1} / {hunks.length}</span>
      <button
        class="hunk-nav-btn"
        onclick={() => navigateHunk(1)}
        disabled={currentHunkIndex >= hunks.length - 1}
        aria-label={m.diff_view_next_change()}
        title={m.diff_view_next_change()}
      >
        <ChevronDown size={14} />
      </button>
    </div>
  {/if}

  {#if viewMode === "split"}
    <div class="split-labels">
      <span class="split-label">{leftLabel}</span>
      <span class="split-label">{rightLabel}</span>
    </div>
  {/if}

  <div class="diff-body">
    {#each hunks as hunk, hunkIdx (hunkIdx)}
      <div class="diff-hunk" data-diff-hunk-index={hunkIdx}>
        <div class="hunk-header">{hunk.header}</div>

        {#if viewMode === "unified"}
          <table class="diff-table unified" role="presentation">
            <tbody>
              {#each hunk.lines as line, lineIdx (lineIdx)}
                <tr
                  class="diff-line"
                  class:line-add={line.type === "add"}
                  class:line-del={line.type === "remove"}
                >
                  <td class="line-num">{line.oldLineNo ?? ""}</td>
                  <td class="line-num">{line.newLineNo ?? ""}</td>
                  <td class="line-origin">{line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}</td>
                  <td class="line-content">{line.content}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          {@const paired = splitLines(hunk.lines)}
          <table class="diff-table split" role="presentation">
            <tbody>
              {#each paired.left as leftLine, idx (idx)}
                {@const rightLine = paired.right[idx]}
                <tr class="diff-line">
                  {#if leftLine}
                    <td class="line-num">{leftLine.oldLineNo ?? ""}</td>
                    <td class="line-content side-left" class:line-del={leftLine.type === "remove"}>{leftLine.content}</td>
                  {:else}
                    <td class="line-num"></td>
                    <td class="line-content side-left empty-line"></td>
                  {/if}
                  <td class="split-gutter"></td>
                  {#if rightLine}
                    <td class="line-num">{rightLine.newLineNo ?? ""}</td>
                    <td class="line-content side-right" class:line-add={rightLine.type === "add"}>{rightLine.content}</td>
                  {:else}
                    <td class="line-num"></td>
                    <td class="line-content side-right empty-line"></td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .diff-renderer {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .hunk-nav {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    background: var(--th-bg-900);
    border-bottom: 1px solid var(--th-border-700);
    flex-shrink: 0;
  }

  .hunk-nav-btn {
    display: flex;
    align-items: center;
    padding: 2px;
    border: none;
    background: transparent;
    color: var(--th-text-400);
    cursor: pointer;
    border-radius: 3px;
  }

  .hunk-nav-btn:hover:not(:disabled) {
    color: var(--th-text-200);
    background: var(--th-bg-700);
  }

  .hunk-nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .hunk-nav-label {
    font-size: 0.7rem;
    color: var(--th-text-500);
  }

  .split-labels {
    display: flex;
    padding: 4px 12px;
    background: var(--th-bg-800);
    border-bottom: 1px solid var(--th-border-700);
    flex-shrink: 0;
  }

  .split-label {
    flex: 1;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--th-text-400);
  }

  .diff-body {
    flex: 1;
    overflow-y: auto;
  }

  .diff-hunk {
    margin-bottom: 2px;
  }

  .hunk-header {
    padding: 4px 12px;
    font-family: var(--th-font-mono, monospace);
    font-size: 0.75rem;
    color: var(--th-text-500);
    background: var(--th-bg-800);
    border-bottom: 1px solid var(--th-border-700);
    user-select: none;
  }

  .diff-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--th-font-mono, monospace);
    font-size: 0.8rem;
    line-height: 1.5;
    table-layout: fixed;
  }

  .diff-table.unified .line-num {
    width: 4ch;
  }

  .diff-table.unified .line-origin {
    width: 2ch;
    text-align: center;
    color: var(--th-text-500);
    user-select: none;
  }

  .diff-table.split .line-num {
    width: 4ch;
  }

  .diff-table.split .side-left,
  .diff-table.split .side-right {
    width: calc(50% - 5ch);
  }

  .split-gutter {
    width: 2px;
    background: var(--th-border-700);
  }

  .line-num {
    text-align: right;
    padding: 0 6px 0 4px;
    color: var(--th-text-600);
    user-select: none;
    vertical-align: top;
    white-space: nowrap;
    overflow: hidden;
  }

  .line-content {
    padding: 0 8px;
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--th-text-200);
  }

  .line-add {
    background: var(--th-diff-add, rgba(34, 197, 94, 0.15));
  }

  .line-del {
    background: var(--th-diff-remove, rgba(239, 68, 68, 0.15));
  }

  .empty-line {
    background: var(--th-bg-900, #111);
  }

  .diff-line {
    border: none;
  }
</style>
