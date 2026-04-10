<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import type { GitFileStatus } from "../../lib/tauri/git.js";
  import Plus from "@lucide/svelte/icons/plus";
  import Minus from "@lucide/svelte/icons/minus";
  import Undo2 from "@lucide/svelte/icons/undo-2";

  interface Props {
    file: GitFileStatus;
    staged: boolean;
    modPath: string;
  }
  let { file, staged, modPath }: Props = $props();

  const STATUS_LABELS: Record<string, string> = {
    modified: "M",
    added: "A",
    deleted: "D",
    renamed: "R",
    untracked: "?",
    conflicted: "U",
  };

  const STATUS_COLORS: Record<string, string> = {
    modified: "var(--th-warning-400, #f59e0b)",
    added: "var(--th-success-400, #22c55e)",
    deleted: "var(--th-error-400, #ef4444)",
    renamed: "var(--th-text-sky-400, #38bdf8)",
    untracked: "var(--th-text-500)",
    conflicted: "var(--th-error-500, #dc2626)",
  };

  function getStatusLabel(): string {
    return STATUS_LABELS[file.status] ?? "?";
  }

  function getStatusColor(): string {
    return STATUS_COLORS[file.status] ?? "var(--th-text-500)";
  }

  function fileName(): string {
    const parts = file.path.split("/");
    return parts[parts.length - 1];
  }

  function dirPart(): string {
    const parts = file.path.split("/");
    if (parts.length <= 1) return "";
    return parts.slice(0, -1).join("/") + "/";
  }
</script>

<div
  class="git-file-item"
  role="button"
  tabindex="0"
  onclick={() => gitStore.loadFileDiff(modPath, file.path, staged)}
  onkeydown={(e) => { if (e.key === "Enter") gitStore.loadFileDiff(modPath, file.path, staged); }}
>
  <span class="git-file-status" style="color: {getStatusColor()}">{getStatusLabel()}</span>
  <span class="git-file-name" title={file.path}>{fileName()}</span>
  {#if dirPart()}
    <span class="git-file-dir-hint">{dirPart()}</span>
  {/if}
  <div class="git-file-actions">
    {#if staged}
      <button
        class="git-action-btn"
        title={m.git_unstage_tooltip()}
        onclick={(e) => { e.stopPropagation(); gitStore.unstage(modPath, [file.path]); }}
      >
        <Minus size={14} />
      </button>
    {:else}
      <button
        class="git-action-btn"
        title={m.git_stage_tooltip()}
        onclick={(e) => { e.stopPropagation(); gitStore.stage(modPath, [file.path]); }}
      >
        <Plus size={14} />
      </button>
      {#if file.status !== "untracked"}
        <button
          class="git-action-btn discard"
          title={m.git_discard_tooltip()}
          onclick={(e) => { e.stopPropagation(); gitStore.discard(modPath, [file.path]); }}
        >
          <Undo2 size={14} />
        </button>
      {/if}
    {/if}
  </div>
</div>

<style>
  .git-file-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px 0 16px;
    cursor: pointer;
    font-size: 0.75rem;
    min-height: 22px;
  }

  .git-file-item:hover {
    background: var(--th-sidebar-highlight, var(--th-bg-800));
  }

  .git-file-status {
    flex-shrink: 0;
    width: 14px;
    font-weight: 700;
    font-size: 0.7rem;
    text-align: center;
    font-family: monospace;
  }

  .git-file-name {
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--th-text-200);
  }

  .git-file-dir-hint {
    flex-shrink: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--th-text-500);
    font-size: 0.7rem;
    margin-left: 4px;
  }

  .git-file-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.1s ease;
  }

  .git-file-item:hover .git-file-actions {
    opacity: 1;
  }

  .git-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--th-text-400);
    cursor: pointer;
  }

  .git-action-btn:hover {
    background: var(--th-bg-700);
    color: var(--th-text-200);
  }

  .git-action-btn.discard:hover {
    color: var(--th-error-400, #ef4444);
  }
</style>
