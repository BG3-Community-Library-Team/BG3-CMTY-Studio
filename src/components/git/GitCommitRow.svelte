<script lang="ts">
  import type { GitCommitInfo } from "../../lib/tauri/git.js";

  interface Props {
    commit: GitCommitInfo;
    onselect?: (oid: string) => void;
  }

  let { commit, onselect }: Props = $props();

  function relativeTime(timestamp: number): string {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
    return `${Math.floor(diff / 31536000)}y ago`;
  }

  let firstLine = $derived(commit.message.split("\n")[0]);
</script>

<button
  class="commit-row"
  onclick={() => onselect?.(commit.oid)}
  type="button"
>
  <span class="commit-oid">{commit.shortOid}</span>
  <span class="commit-body">
    <span class="commit-message">{firstLine}</span>
    <span class="commit-author">{commit.authorName}</span>
  </span>
  <span class="commit-time">{relativeTime(commit.timestamp)}</span>
</button>

<style>
  .commit-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 32px;
    padding: 2px 10px;
    border: none;
    background: transparent;
    color: var(--th-text-200);
    font-size: 0.8rem;
    cursor: pointer;
    text-align: left;
  }

  .commit-row:hover {
    background: var(--th-sidebar-highlight, var(--th-bg-800));
  }

  .commit-oid {
    flex-shrink: 0;
    font-family: var(--th-font-mono, monospace);
    font-size: 0.72rem;
    color: var(--th-text-500);
  }

  .commit-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .commit-message {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .commit-author {
    font-size: 0.7rem;
    color: var(--th-text-500);
  }

  .commit-time {
    flex-shrink: 0;
    font-size: 0.7rem;
    color: var(--th-text-400);
    white-space: nowrap;
  }
</style>
