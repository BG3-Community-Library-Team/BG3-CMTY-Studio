<script lang="ts">
  import type { ForgeIssue } from "../../lib/tauri/git.js";
  import CircleDot from "@lucide/svelte/icons/circle-dot";

  interface Props {
    issues: ForgeIssue[];
  }
  let { issues }: Props = $props();
</script>

{#if issues.length > 0}
  <div class="forge-list">
    {#each issues as issue}
      <a class="forge-list-item" href={issue.htmlUrl} target="_blank" rel="noopener noreferrer">
        <CircleDot size={14} class="forge-item-icon" />
        <span class="forge-item-number">#{issue.number}</span>
        <span class="forge-item-title">{issue.title}</span>
        <span class="forge-item-meta">{issue.author}</span>
        {#if issue.labels.length > 0}
          <span class="forge-labels">
            {#each issue.labels.slice(0, 3) as label}
              <span class="forge-label">{label}</span>
            {/each}
          </span>
        {/if}
      </a>
    {/each}
  </div>
{:else}
  <p class="forge-empty">No open issues</p>
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

  .forge-labels {
    display: flex;
    gap: 3px;
    flex-shrink: 0;
  }

  .forge-label {
    font-size: 0.68rem;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--th-bg-600);
    color: var(--th-text-300);
    white-space: nowrap;
  }

  .forge-empty {
    padding: 6px 12px;
    font-size: 0.78rem;
    color: var(--th-text-500);
    font-style: italic;
    margin: 0;
  }
</style>
