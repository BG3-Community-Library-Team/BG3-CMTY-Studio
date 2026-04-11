<script lang="ts">
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import type { GitCommitDetail } from "../../lib/tauri/git.js";
  import GitCommitIcon from "@lucide/svelte/icons/git-commit";
  import FileIcon from "@lucide/svelte/icons/file";
  import Loader from "@lucide/svelte/icons/loader";

  interface Props {
    commitOid: string;
    modPath: string;
    ondiffopen?: (detail: { path: string; commitOid: string }) => void;
  }

  let { commitOid, modPath, ondiffopen }: Props = $props();

  let detail: GitCommitDetail | null = $derived(gitStore.selectedCommit);
  let loading = $state(false);

  $effect(() => {
    if (commitOid && modPath) {
      loading = true;
      gitStore.selectCommit(modPath, commitOid).finally(() => {
        loading = false;
      });
    }
  });

  function statusIcon(status: string): string {
    switch (status) {
      case "added": return "A";
      case "deleted": return "D";
      case "modified": return "M";
      case "renamed": return "R";
      case "copied": return "C";
      default: return "?";
    }
  }

  function statusColor(status: string): string {
    switch (status) {
      case "added": return "var(--status-added)";
      case "deleted": return "var(--status-deleted)";
      case "modified": return "var(--status-modified)";
      case "renamed": return "var(--status-renamed)";
      default: return "var(--th-text-400)";
    }
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString();
  }

  function handleFileClick(path: string): void {
    ondiffopen?.({ path, commitOid });
  }
</script>

<div class="commit-detail-view" role="region" aria-label="Commit details">
  {#if loading && !detail}
    <div class="loading-state" aria-live="polite">
      <Loader size={24} class="spin" aria-hidden="true" />
      <span>Loading commit…</span>
    </div>
  {:else if detail}
    <!-- Header -->
    <div class="commit-header">
      <div class="commit-header-title">
        <GitCommitIcon size={18} />
        <span class="commit-header-label">Commit</span>
      </div>
      <div class="commit-oid-full" title="Click to select" data-selectable="true">
        {detail.commit.oid}
      </div>

      <div class="commit-meta">
        <div class="meta-row">
          <span class="meta-label">Author</span>
          <span class="meta-value">
            {detail.commit.authorName}
            <span class="meta-email">&lt;{detail.commit.authorEmail}&gt;</span>
          </span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Date</span>
          <span class="meta-value">{formatDate(detail.commit.timestamp)}</span>
        </div>
        {#if detail.commit.parentCount > 0}
          <div class="meta-row">
            <span class="meta-label">Parents</span>
            <span class="meta-value">{detail.commit.parentCount} parent{detail.commit.parentCount > 1 ? "s" : ""}</span>
          </div>
        {:else}
          <div class="meta-row">
            <span class="meta-label">Parents</span>
            <span class="meta-value meta-muted">Initial commit</span>
          </div>
        {/if}
      </div>
    </div>

    <!-- Commit message -->
    <div class="commit-message-section">
      <pre class="commit-message">{detail.commit.message}</pre>
    </div>

    <!-- Changed files -->
    <div class="changed-files-section">
      <div class="section-heading">
        Changed files
        <span class="file-count">{detail.files.length}</span>
      </div>
      <div class="file-list" role="list" aria-label="Changed files">
        {#each detail.files as file}
          <button
            class="file-row"
            onclick={() => handleFileClick(file.path)}
            aria-label="{file.status} file: {file.path}"
          >
            <span class="file-status" style="color: {statusColor(file.status)}" aria-hidden="true">
              {statusIcon(file.status)}
            </span>
            <FileIcon size={14} class="file-icon" />
            <span class="file-path" title={file.path}>
              {file.path}
            </span>
          </button>
        {/each}
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <p>No commit data available.</p>
    </div>
  {/if}
</div>

<style>
  .commit-detail-view {
    height: 100%;
    overflow-y: auto;
    padding: 16px 20px;
    color: var(--th-text-200);
    background: var(--th-bg-900);
  }

  /* ── Loading ──────────────────────────────────────────── */
  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 48px 0;
    color: var(--th-text-400);
    font-size: 0.85rem;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* ── Header ───────────────────────────────────────────── */
  .commit-header {
    border-bottom: 1px solid var(--th-border-700);
    padding-bottom: 14px;
    margin-bottom: 14px;
  }

  .commit-header-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--th-text-200);
    margin-bottom: 6px;
  }

  .commit-header-label {
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 0.7rem;
    color: var(--th-text-400);
  }

  .commit-oid-full {
    font-family: var(--th-font-mono, monospace);
    font-size: 0.78rem;
    color: var(--th-text-300);
    user-select: all;
    padding: 4px 8px;
    background: var(--th-bg-800);
    border-radius: 4px;
    margin-bottom: 12px;
    word-break: break-all;
  }

  .commit-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .meta-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 0.8rem;
  }

  .meta-label {
    flex-shrink: 0;
    width: 55px;
    color: var(--th-text-500);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .meta-value {
    color: var(--th-text-200);
  }

  .meta-email {
    color: var(--th-text-400);
    margin-left: 4px;
  }

  .meta-muted {
    color: var(--th-text-500);
    font-style: italic;
  }

  /* ── Commit message ───────────────────────────────────── */
  .commit-message-section {
    border-bottom: 1px solid var(--th-border-700);
    padding-bottom: 14px;
    margin-bottom: 14px;
  }

  .commit-message {
    font-family: var(--th-font-mono, monospace);
    font-size: 0.82rem;
    line-height: 1.5;
    color: var(--th-text-200);
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    padding: 10px 12px;
    background: var(--th-bg-800);
    border-radius: 4px;
  }

  /* ── Changed files ────────────────────────────────────── */
  .changed-files-section {
    border-bottom: none;
  }

  .section-heading {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--th-text-300);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 6px;
  }

  .file-count {
    font-size: 0.7rem;
    padding: 0 5px;
    border-radius: 8px;
    background: var(--th-bg-700);
    color: var(--th-text-400);
    font-weight: 600;
  }

  .file-list {
    display: flex;
    flex-direction: column;
  }

  .file-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--th-text-200);
    cursor: pointer;
    font-size: 0.8rem;
    text-align: left;
    min-height: 26px;
  }

  .file-row:hover {
    background: var(--th-bg-800);
  }

  .file-status {
    flex-shrink: 0;
    width: 14px;
    font-weight: 700;
    font-size: 0.75rem;
    text-align: center;
    font-family: var(--th-font-mono, monospace);
  }

  :global(.file-icon) {
    flex-shrink: 0;
    color: var(--th-text-500);
  }

  .file-path {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── Empty ────────────────────────────────────────────── */
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 0;
    color: var(--th-text-500);
    font-size: 0.85rem;
  }

  /* ── Status colors (CSS custom properties) ────────────── */
  .commit-detail-view {
    --status-added: #34d399;
    --status-deleted: #f87171;
    --status-modified: #38bdf8;
    --status-renamed: #fbbf24;
  }
</style>
