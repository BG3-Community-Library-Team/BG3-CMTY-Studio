<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import { toastStore } from "../../lib/stores/toastStore.svelte.js";
  import ArchiveRestore from "@lucide/svelte/icons/archive-restore";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  interface Props {
    modPath: string;
  }
  let { modPath }: Props = $props();

  async function handleApply(index: number) {
    try {
      await gitStore.stashApply(modPath, index);
      toastStore.success(m.git_stash_apply_success());
    } catch (e) {
      toastStore.error(m.git_stash_failed(), String(e));
    }
  }

  async function handleDrop(index: number) {
    if (!confirm(m.git_stash_drop_confirm())) return;
    try {
      await gitStore.stashDrop(modPath, index);
      toastStore.success(m.git_stash_drop_success());
    } catch (e) {
      toastStore.error(m.git_stash_failed(), String(e));
    }
  }
</script>

<div class="stash-panel">
  {#if gitStore.stashes.length > 0}
    <ul class="stash-list" role="list" aria-label="Stash entries">
      {#each gitStore.stashes as entry (entry.index)}
        <li class="stash-entry" role="listitem">
          <span class="stash-message" title={entry.message}>
            <span class="stash-index">#{entry.index + 1}</span>
            {entry.message}
          </span>
          <div class="stash-actions">
            <button
              class="stash-action-btn"
              title={m.git_stash_apply()}
              aria-label="Apply stash #{entry.index + 1}"
              onclick={() => handleApply(entry.index)}
            >
              <ArchiveRestore size={12} aria-hidden="true" />
            </button>
            <button
              class="stash-action-btn stash-action-danger"
              title={m.git_stash_drop()}
              aria-label="Drop stash #{entry.index + 1}"
              onclick={() => handleDrop(entry.index)}
            >
              <Trash2 size={12} aria-hidden="true" />
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="stash-empty">{m.git_stash_empty()}</p>
  {/if}
</div>

<style>
  .stash-panel {
    padding: 0;
  }

  .stash-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .stash-entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 8px 2px 12px;
    font-size: 0.75rem;
  }

  .stash-entry:hover {
    background: var(--th-sidebar-highlight, var(--th-bg-800));
  }

  .stash-message {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
    color: var(--th-text-300);
  }

  .stash-index {
    color: var(--th-text-500);
    margin-right: 4px;
  }

  .stash-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    flex-shrink: 0;
  }

  .stash-entry:hover .stash-actions {
    opacity: 1;
  }

  .stash-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--th-text-400);
    cursor: pointer;
  }

  .stash-action-btn:hover {
    background: var(--th-bg-700);
    color: var(--th-text-200);
  }

  .stash-action-danger:hover {
    color: var(--th-error, #f44747);
  }

  .stash-empty {
    padding: 4px 12px;
    font-size: 0.75rem;
    color: var(--th-text-500);
    font-style: italic;
  }
</style>
