<script lang="ts">
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import GitDiffHunk from "./GitDiffHunk.svelte";
  import Columns2 from "@lucide/svelte/icons/columns-2";
  import AlignJustify from "@lucide/svelte/icons/align-justify";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import type { GitFileDiff, GitDiffHunk as HunkType } from "../../lib/tauri/git.js";

  interface Props {
    filePath: string;
    modPath: string;
    staged?: boolean;
    commitOid?: string;
  }
  let { filePath, modPath, staged = false, commitOid }: Props = $props();

  let diff = $derived.by<GitFileDiff | null>(() => {
    if (commitOid && (gitStore as any).selectedCommit) {
      const commit = (gitStore as any).selectedCommit;
      return commit.diff.find((d: GitFileDiff) => d.path === filePath) ?? null;
    }
    return gitStore.selectedFileDiff;
  });

  let viewMode = $derived(gitStore.diffViewMode);
  let currentHunkIndex = $state(0);

  $effect(() => {
    if (!commitOid && filePath && modPath) {
      gitStore.loadFileDiff(modPath, filePath, staged);
    }
  });

  function toggleViewMode() {
    gitStore.diffViewMode = viewMode === "unified" ? "split" : "unified";
  }

  function navigateHunk(direction: 1 | -1) {
    if (!diff) return;
    const newIndex = currentHunkIndex + direction;
    currentHunkIndex = Math.max(0, Math.min(diff.hunks.length - 1, newIndex));
    const el = document.querySelector(`[data-hunk-index="${currentHunkIndex}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function onKeydown(e: KeyboardEvent) {
    // Ignore when typing in inputs
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    switch (e.key) {
      case "j":
      case "ArrowDown":
        e.preventDefault();
        navigateHunk(1);
        break;
      case "k":
      case "ArrowUp":
        e.preventDefault();
        navigateHunk(-1);
        break;
      case "u":
        gitStore.diffViewMode = "unified";
        break;
      case "s":
        gitStore.diffViewMode = "split";
        break;
    }
  }

  function displayPath(path: string): string {
    const parts = path.split("/");
    return parts.length > 2 ? `…/${parts.slice(-2).join("/")}` : path;
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="diff-view" role="region" aria-label="Diff view for {displayPath(filePath)}" onkeydown={onKeydown} tabindex="-1">
  <div class="diff-toolbar">
    <span class="diff-filepath" title={filePath}>{displayPath(filePath)}</span>

    <div class="diff-toolbar-actions">
      {#if diff && diff.hunks.length > 1}
        <span class="hunk-nav-label">
          {currentHunkIndex + 1}/{diff.hunks.length}
        </span>
        <button
          class="diff-btn"
          title="Previous hunk (k/↑)"
          aria-label="Previous hunk"
          disabled={currentHunkIndex === 0}
          onclick={() => navigateHunk(-1)}
        >
          <ChevronUp size={16} aria-hidden="true" />
        </button>
        <button
          class="diff-btn"
          title="Next hunk (j/↓)"
          aria-label="Next hunk"
          disabled={!diff || currentHunkIndex >= diff.hunks.length - 1}
          onclick={() => navigateHunk(1)}
        >
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      {/if}

      <button
        class="diff-btn"
        class:active={viewMode === "unified"}
        title="Unified view (u)"
        aria-label="Unified view"
        aria-pressed={viewMode === "unified"}
        onclick={toggleViewMode}
      >
        <AlignJustify size={16} aria-hidden="true" />
      </button>
      <button
        class="diff-btn"
        class:active={viewMode === "split"}
        title="Split view (s)"
        aria-label="Split view"
        aria-pressed={viewMode === "split"}
        onclick={toggleViewMode}
      >
        <Columns2 size={16} aria-hidden="true" />
      </button>
    </div>
  </div>

  <div class="diff-content">
    {#if !diff}
      <div class="diff-empty" aria-live="polite">Loading diff…</div>
    {:else if diff.isBinary}
      <div class="diff-empty">Binary file differs</div>
    {:else if diff.hunks.length === 0}
      <div class="diff-empty">No changes</div>
    {:else}
      {#each diff.hunks as hunk, idx (idx)}
        <div data-hunk-index={idx} class:hunk-active={idx === currentHunkIndex}>
          <GitDiffHunk {hunk} {viewMode} />
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .diff-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--th-bg-950, #0a0a0f);
    color: var(--th-text-200);
    outline: none;
  }

  .diff-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: var(--th-bg-900, #111);
    border-bottom: 1px solid var(--th-border-700, #333);
    flex-shrink: 0;
    gap: 8px;
  }

  .diff-filepath {
    font-family: var(--th-font-mono, monospace);
    font-size: 0.8rem;
    color: var(--th-text-300);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .diff-toolbar-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .hunk-nav-label {
    font-size: 0.75rem;
    color: var(--th-text-500);
    padding: 0 4px;
    font-variant-numeric: tabular-nums;
  }

  .diff-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--th-text-400);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .diff-btn:hover:not(:disabled) {
    background: var(--th-bg-800, #1a1a2e);
    color: var(--th-text-200);
  }

  .diff-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .diff-btn.active {
    background: var(--th-accent-muted, rgba(99, 102, 241, 0.2));
    color: var(--th-accent-400, #818cf8);
  }

  .diff-content {
    flex: 1;
    overflow: auto;
  }

  .diff-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--th-text-500);
    font-size: 0.9rem;
  }

  .hunk-active {
    outline: 1px solid var(--th-accent-muted, rgba(99, 102, 241, 0.3));
    outline-offset: -1px;
  }
</style>
