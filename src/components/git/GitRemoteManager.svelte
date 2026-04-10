<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import { toastStore } from "../../lib/stores/toastStore.svelte.js";
  import { gitAddRemote, gitRemoveRemote } from "../../lib/tauri/git.js";
  import Globe from "@lucide/svelte/icons/globe";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";

  interface Props {
    modPath: string;
  }
  let { modPath }: Props = $props();

  let showAddForm = $state(false);
  let newName = $state("");
  let newUrl = $state("");
  let isAdding = $state(false);

  async function handleAdd() {
    const name = newName.trim();
    const url = newUrl.trim();
    if (!name || !url) return;

    isAdding = true;
    try {
      await gitAddRemote(modPath, name, url);
      await gitStore.loadRemotes(modPath);
      toastStore.success(m.git_remote_add_success({ name }));
      newName = "";
      newUrl = "";
      showAddForm = false;
    } catch (e) {
      toastStore.error(m.git_remote_failed(), String(e));
    } finally {
      isAdding = false;
    }
  }

  async function handleRemove(name: string) {
    if (!confirm(m.git_remote_remove_confirm({ name }))) return;
    try {
      await gitRemoveRemote(modPath, name);
      await gitStore.loadRemotes(modPath);
      toastStore.success(m.git_remote_remove_success({ name }));
    } catch (e) {
      toastStore.error(m.git_remote_failed(), String(e));
    }
  }

  function cancelAdd() {
    showAddForm = false;
    newName = "";
    newUrl = "";
  }
</script>

<div class="remote-manager">
  <div class="remote-header">
    <div class="remote-header-left">
      <Globe size={13} />
      <span>{m.git_remote_heading()}</span>
    </div>
    <button
      class="remote-add-toggle"
      title={m.git_remote_add()}
      onclick={() => { showAddForm = !showAddForm; }}
    >
      {#if showAddForm}
        <X size={13} />
      {:else}
        <Plus size={13} />
      {/if}
    </button>
  </div>

  {#if showAddForm}
    <div class="remote-add-form">
      <input
        class="remote-input"
        type="text"
        placeholder={m.git_remote_name_placeholder()}
        bind:value={newName}
      />
      <input
        class="remote-input"
        type="text"
        placeholder={m.git_remote_url_placeholder()}
        bind:value={newUrl}
      />
      <div class="remote-add-actions">
        <button
          class="remote-add-btn"
          onclick={handleAdd}
          disabled={!newName.trim() || !newUrl.trim() || isAdding}
        >
          {m.git_remote_add()}
        </button>
        <button class="remote-cancel-btn" onclick={cancelAdd}>
          Cancel
        </button>
      </div>
    </div>
  {/if}

  {#if gitStore.remotes.length > 0}
    <ul class="remote-list">
      {#each gitStore.remotes as remote (remote.name)}
        <li class="remote-entry">
          <div class="remote-info">
            <span class="remote-name">{remote.name}</span>
            <span class="remote-url" title={remote.url}>{remote.url}</span>
          </div>
          <button
            class="remote-remove-btn"
            title={m.git_remote_remove()}
            onclick={() => handleRemove(remote.name)}
          >
            <Trash2 size={12} />
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .remote-manager {
    padding: 0;
  }

  .remote-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
  }

  .remote-header-left {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--th-text-300);
  }

  .remote-add-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--th-text-400);
    cursor: pointer;
  }

  .remote-add-toggle:hover {
    background: var(--th-sidebar-highlight, var(--th-bg-800));
    color: var(--th-text-200);
  }

  .remote-add-form {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 8px 8px;
  }

  .remote-input {
    width: 100%;
    padding: 3px 6px;
    border: 1px solid var(--th-bg-600);
    border-radius: 3px;
    background: var(--th-bg-900);
    color: var(--th-text-200);
    font-size: 0.75rem;
    box-sizing: border-box;
  }

  .remote-input:focus {
    border-color: var(--th-accent-500, #007acc);
    outline: none;
  }

  .remote-add-actions {
    display: flex;
    gap: 4px;
    justify-content: flex-end;
  }

  .remote-add-btn,
  .remote-cancel-btn {
    padding: 2px 8px;
    border: none;
    border-radius: 3px;
    font-size: 0.7rem;
    cursor: pointer;
  }

  .remote-add-btn {
    background: var(--th-accent-500, #007acc);
    color: white;
  }

  .remote-add-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .remote-add-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .remote-cancel-btn {
    background: var(--th-bg-700);
    color: var(--th-text-300);
  }

  .remote-cancel-btn:hover {
    background: var(--th-bg-600);
  }

  .remote-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .remote-entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 3px 8px 3px 12px;
  }

  .remote-entry:hover {
    background: var(--th-sidebar-highlight, var(--th-bg-800));
  }

  .remote-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .remote-name {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--th-text-200);
  }

  .remote-url {
    font-size: 0.65rem;
    color: var(--th-text-500);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remote-remove-btn {
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
    opacity: 0;
    flex-shrink: 0;
  }

  .remote-entry:hover .remote-remove-btn {
    opacity: 1;
  }

  .remote-remove-btn:hover {
    background: var(--th-bg-700);
    color: var(--th-error, #f44747);
  }
</style>
