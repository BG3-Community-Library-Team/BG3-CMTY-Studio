<script lang="ts">
  import type { GitCommitInfo } from "../../lib/tauri/git.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import Globe from "@lucide/svelte/icons/globe";
  import { forgeCommitUrl } from "../../lib/utils/forgeUrls.js";

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

  async function openCommitOnForge() {
    const info = gitStore.forgeInfo;
    if (!info) return;
    const url = forgeCommitUrl(info, commit.oid);
    if (url) {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
    }
  }
</script>

<button
  class="commit-row"
  onclick={() => onselect?.(commit.oid)}
  type="button"
  aria-label="Commit {commit.shortOid}: {firstLine} by {commit.authorName}"
>
  <span class="commit-oid">{commit.shortOid}</span>
  <span class="commit-message">{firstLine}</span>
  <span class="commit-meta">— {commit.authorName}</span>
  <span class="commit-time">{relativeTime(commit.timestamp)}</span>
  {#if gitStore.forgeInfo && gitStore.forgeInfo.forgeType !== "Unknown"}
    <span
      class="forge-link-btn"
      role="button"
      tabindex="0"
      title="Open on {gitStore.forgeInfo.host}"
      aria-label="Open commit {commit.shortOid} on {gitStore.forgeInfo.host}"
      onclick={(e) => { e.stopPropagation(); openCommitOnForge(); }}
      onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); openCommitOnForge(); } }}
    >
      <Globe size={12} aria-hidden="true" />
    </span>
  {/if}
</button>

<style>
  .commit-row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-height: 26px;
    padding: 2px 10px;
    border: none;
    background: transparent;
    color: var(--th-text-200);
    font-size: 0.75rem;
    cursor: pointer;
    text-align: left;
  }

  .commit-row:hover {
    background: var(--th-sidebar-highlight, var(--th-bg-800));
  }

  .commit-oid {
    flex-shrink: 0;
    font-family: var(--th-font-mono, monospace);
    font-size: 0.65rem;
    color: var(--th-text-500);
    background: var(--th-bg-700);
    border-radius: 3px;
    padding: 0 4px;
    line-height: 1.4;
  }

  .commit-message {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .commit-meta {
    flex-shrink: 0;
    font-size: 0.7rem;
    color: var(--th-text-500);
    white-space: nowrap;
  }

  .commit-time {
    flex-shrink: 0;
    font-size: 0.65rem;
    color: var(--th-text-400);
    white-space: nowrap;
  }

  .forge-link-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--th-text-500);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.1s ease;
    padding: 0;
  }

  .commit-row:hover .forge-link-btn {
    opacity: 1;
  }

  .forge-link-btn:hover {
    background: var(--th-bg-700);
    color: var(--th-text-200);
  }
</style>
