<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import { uiStore } from "../../lib/stores/uiStore.svelte.js";
  import GitCommitRow from "./GitCommitRow.svelte";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import History from "@lucide/svelte/icons/history";

  interface Props {
    modPath: string;
  }

  let { modPath }: Props = $props();

  $effect(() => {
    if (modPath) {
      gitStore.loadHistory(modPath);
    }
  });

  function handleCommitSelect(oid: string) {
    const shortOid = oid.slice(0, 7);
    uiStore.openTab({
      id: `git-commit:${oid}`,
      label: `Commit ${shortOid}`,
      type: "git-commit",
      commitOid: oid,
      icon: "⊙",
    });
  }
</script>

<div class="history-panel">
  <div class="history-header">
    <History size={14} />
    <span>{m.git_history_heading()}</span>
  </div>

  <div class="history-list">
    {#if gitStore.commitsLoading && gitStore.commits.length === 0}
      <div class="history-loading">
        <LoaderCircle size={16} class="animate-spin" />
        <span>{m.git_history_loading()}</span>
      </div>
    {:else if gitStore.commits.length === 0}
      <p class="history-empty">{m.git_history_empty()}</p>
    {:else}
      {#each gitStore.commits as commit (commit.oid)}
        <GitCommitRow {commit} onselect={handleCommitSelect} />
      {/each}

      {#if gitStore.commitsHasMore}
        <div class="history-load-more">
          {#if gitStore.commitsLoading}
            <LoaderCircle size={14} class="animate-spin" />
          {:else}
            <button
              class="load-more-btn"
              onclick={() => gitStore.loadMore(modPath)}
              type="button"
            >
              {m.git_history_load_more()}
            </button>
          {/if}
        </div>
      {:else}
        <p class="history-no-more">{m.git_history_no_more()}</p>
      {/if}
    {/if}
  </div>
</div>

<style>
  .history-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .history-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    color: var(--th-text-300);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .history-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .history-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px;
    color: var(--th-text-400);
    font-size: 0.8rem;
  }

  .history-empty {
    padding: 12px 16px;
    font-size: 0.8rem;
    color: var(--th-text-500);
    font-style: italic;
  }

  .history-load-more {
    display: flex;
    justify-content: center;
    padding: 6px;
  }

  .load-more-btn {
    padding: 3px 12px;
    border: 1px solid var(--th-bg-700);
    border-radius: 4px;
    background: transparent;
    color: var(--th-text-400);
    font-size: 0.75rem;
    cursor: pointer;
  }

  .load-more-btn:hover {
    background: var(--th-sidebar-highlight, var(--th-bg-800));
    color: var(--th-text-200);
  }

  .history-no-more {
    padding: 6px;
    text-align: center;
    font-size: 0.7rem;
    color: var(--th-text-500);
    font-style: italic;
  }
</style>
