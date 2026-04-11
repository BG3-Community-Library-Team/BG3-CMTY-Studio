<script lang="ts">
  import type { ForgePR, ForgeInfo } from "../../lib/tauri/git.js";
  import GitPullRequest from "@lucide/svelte/icons/git-pull-request";

  interface Props {
    prs: ForgePR[];
    info: ForgeInfo;
    prLabel: string;
  }
  let { prs, info, prLabel }: Props = $props();
</script>

{#if prs.length > 0}
  <div class="forge-list">
    {#each prs as pr}
      <a class="forge-list-item" href={pr.htmlUrl} target="_blank" rel="noopener noreferrer">
        <GitPullRequest size={14} class="forge-item-icon" />
        <span class="forge-item-number">#{pr.number}</span>
        <span class="forge-item-title">{pr.title}</span>
        <span class="forge-item-meta">{pr.author}</span>
        <span class="forge-item-state" class:open={pr.state === "open"} class:closed={pr.state === "closed"}>
          {pr.state}
        </span>
      </a>
    {/each}
  </div>
{:else}
  <p class="forge-empty">No open {prLabel.toLowerCase()}s</p>
{/if}

<style>
  .forge-list {
    display: flex;
    flex-direction: column;
  }

  .forge-list-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    font-size: 0.78rem;
    color: var(--th-text-200);
    text-decoration: none;
    cursor: pointer;
    overflow: hidden;
  }

  .forge-list-item:hover {
    background: var(--th-bg-700);
  }

  :global(.forge-item-icon) {
    flex-shrink: 0;
    color: var(--th-text-400);
  }

  .forge-item-number {
    flex-shrink: 0;
    color: var(--th-text-400);
    font-size: 0.75rem;
  }

  .forge-item-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .forge-item-meta {
    flex-shrink: 0;
    color: var(--th-text-500);
    font-size: 0.72rem;
  }

  .forge-item-state {
    flex-shrink: 0;
    font-size: 0.68rem;
    padding: 1px 5px;
    border-radius: 3px;
    text-transform: capitalize;
    background: var(--th-bg-600);
    color: var(--th-text-400);
  }

  .forge-item-state.open {
    background: color-mix(in srgb, var(--th-success, #22c55e) 20%, transparent);
    color: var(--th-success, #22c55e);
  }

  .forge-item-state.closed {
    background: color-mix(in srgb, var(--th-error, #ef4444) 20%, transparent);
    color: var(--th-error, #ef4444);
  }

  .forge-empty {
    padding: 6px 12px;
    font-size: 0.78rem;
    color: var(--th-text-500);
    font-style: italic;
    margin: 0;
  }
</style>
