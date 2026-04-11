<script lang="ts">
  import type { GitDiffHunk, GitDiffLine } from "../../lib/tauri/git.js";

  interface Props {
    hunk: GitDiffHunk;
    viewMode: "unified" | "split";
  }
  let { hunk, viewMode }: Props = $props();

  /**
   * For split mode: pair up deletion and addition lines that are adjacent.
   * Context lines go to both sides.
   */
  function splitLines(lines: GitDiffLine[]): { left: (GitDiffLine | null)[]; right: (GitDiffLine | null)[] } {
    const left: (GitDiffLine | null)[] = [];
    const right: (GitDiffLine | null)[] = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.origin === " ") {
        left.push(line);
        right.push(line);
        i++;
      } else if (line.origin === "-") {
        // Collect consecutive deletions
        const dels: GitDiffLine[] = [];
        while (i < lines.length && lines[i].origin === "-") {
          dels.push(lines[i]);
          i++;
        }
        // Collect consecutive additions
        const adds: GitDiffLine[] = [];
        while (i < lines.length && lines[i].origin === "+") {
          adds.push(lines[i]);
          i++;
        }
        // Pair them up
        const max = Math.max(dels.length, adds.length);
        for (let j = 0; j < max; j++) {
          left.push(j < dels.length ? dels[j] : null);
          right.push(j < adds.length ? adds[j] : null);
        }
      } else if (line.origin === "+") {
        left.push(null);
        right.push(line);
        i++;
      } else {
        i++;
      }
    }

    return { left, right };
  }

  let paired = $derived(splitLines(hunk.lines));
</script>

<div class="diff-hunk" data-selectable="true">
  <div class="hunk-header" aria-label="Diff hunk: {hunk.header}">{hunk.header}</div>

  {#if viewMode === "unified"}
    <table class="diff-table unified" role="presentation">
      <tbody>
        {#each hunk.lines as line, idx (idx)}
          <tr class="diff-line" class:line-add={line.origin === "+"} class:line-del={line.origin === "-"} aria-label={line.origin === "+" ? "Added line" : line.origin === "-" ? "Removed line" : "Context line"}>
            <td class="line-num" aria-hidden="true">{line.oldLineno ?? ""}</td>
            <td class="line-num" aria-hidden="true">{line.newLineno ?? ""}</td>
            <td class="line-origin" aria-hidden="true">{line.origin}</td>
            <td class="line-content">{line.content}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <table class="diff-table split" role="presentation">
      <tbody>
        {#each paired.left as leftLine, idx (idx)}
          {@const rightLine = paired.right[idx]}
          <tr class="diff-line">
            <!-- Left side (old) -->
            {#if leftLine}
              <td class="line-num" aria-hidden="true">{leftLine.oldLineno ?? ""}</td>
              <td class="line-content side-left" class:line-del={leftLine.origin === "-"} aria-label={leftLine.origin === "-" ? "Removed line" : "Context line"}>{leftLine.content}</td>
            {:else}
              <td class="line-num" aria-hidden="true"></td>
              <td class="line-content side-left empty-line"></td>
            {/if}
            <td class="split-gutter" aria-hidden="true"></td>
            <!-- Right side (new) -->
            {#if rightLine}
              <td class="line-num" aria-hidden="true">{rightLine.newLineno ?? ""}</td>
              <td class="line-content side-right" class:line-add={rightLine.origin === "+"} aria-label={rightLine.origin === "+" ? "Added line" : "Context line"}>{rightLine.content}</td>
            {:else}
              <td class="line-num" aria-hidden="true"></td>
              <td class="line-content side-right empty-line"></td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .diff-hunk {
    margin-bottom: 2px;
  }

  .hunk-header {
    padding: 4px 12px;
    font-family: var(--th-font-mono, monospace);
    font-size: 0.75rem;
    color: var(--th-text-500);
    background: var(--th-bg-800, #1a1a2e);
    border-bottom: 1px solid var(--th-border-700, #333);
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
    background: var(--th-border-700, #333);
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
