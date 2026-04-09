<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import Check from "@lucide/svelte/icons/check";
  import X from "@lucide/svelte/icons/x";
  import Plus from "@lucide/svelte/icons/plus";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import Search from "@lucide/svelte/icons/search";

  interface Props {
    modPath: string;
  }

  let { modPath }: Props = $props();

  let isOpen = $state(false);
  let searchQuery = $state("");
  let newBranchName = $state("");
  let searchInput = $state<HTMLInputElement | null>(null);

  let localBranches = $derived(
    gitStore.branches.filter((b) => !b.isRemote),
  );
  let remoteBranches = $derived(
    gitStore.branches.filter((b) => b.isRemote),
  );

  let filteredLocal = $derived(
    localBranches.filter((b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  );
  let filteredRemote = $derived(
    remoteBranches.filter((b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  );

  let hasResults = $derived(filteredLocal.length > 0 || filteredRemote.length > 0);

  function open() {
    isOpen = true;
    searchQuery = "";
    newBranchName = "";
    gitStore.refreshBranches(modPath);
    // Autofocus search after DOM update
    requestAnimationFrame(() => {
      searchInput?.focus();
    });
  }

  function close() {
    isOpen = false;
  }

  async function handleCheckout(branchName: string) {
    await gitStore.checkout(modPath, branchName);
    close();
  }

  async function handleCreate() {
    const name = newBranchName.trim();
    if (!name) return;
    await gitStore.createBranch(modPath, name);
    await gitStore.checkout(modPath, name);
    newBranchName = "";
    close();
  }

  async function handleDelete(branchName: string) {
    const msg = m.git_branch_delete_confirm({ name: branchName });
    if (confirm(msg)) {
      await gitStore.deleteBranch(modPath, branchName);
    }
  }

  function handleCreateKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreate();
    }
  }
</script>

<div class="branch-picker">
  <button class="branch-toggle" onclick={open} title={m.git_branch_picker_label()}>
    <GitBranch size={14} />
    <span class="branch-name">{gitStore.currentBranch ?? "HEAD"}</span>
  </button>

  {#if isOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="branch-backdrop" onclick={close} onkeydown={() => {}}></div>
    <div class="branch-dropdown">
      <!-- Search -->
      <div class="branch-search">
        <Search size={14} />
        <input
          bind:this={searchInput}
          bind:value={searchQuery}
          type="text"
          placeholder={m.git_branch_search_placeholder()}
          class="branch-search-input"
        />
      </div>

      <!-- Create new branch -->
      <div class="branch-create">
        <Plus size={14} />
        <input
          bind:value={newBranchName}
          type="text"
          placeholder={m.git_branch_create_placeholder()}
          class="branch-create-input"
          onkeydown={handleCreateKeydown}
        />
        <button
          class="branch-create-btn"
          onclick={handleCreate}
          disabled={!newBranchName.trim()}
        >
          {m.git_branch_create_button()}
        </button>
      </div>

      <div class="branch-list">
        {#if !hasResults}
          <div class="branch-no-results">{m.git_branch_no_results()}</div>
        {/if}

        <!-- Local branches -->
        {#if filteredLocal.length > 0}
          <div class="branch-heading">{m.git_branch_local_heading()}</div>
          {#each filteredLocal as branch (branch.name)}
            <div
              class="branch-row"
              class:current={branch.isCurrent}
              role="button"
              tabindex="0"
              onclick={() => handleCheckout(branch.name)}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCheckout(branch.name); }}
            >
              <span class="branch-row-icon">
                {#if branch.isCurrent}
                  <Check size={14} />
                {/if}
              </span>
              <span class="branch-row-name">{branch.name}</span>
              {#if branch.ahead > 0}
                <span class="branch-badge ahead">{m.git_branch_ahead({ count: branch.ahead })}</span>
              {/if}
              {#if branch.behind > 0}
                <span class="branch-badge behind">{m.git_branch_behind({ count: branch.behind })}</span>
              {/if}
              {#if !branch.isCurrent}
                <button
                  class="branch-delete-btn"
                  onclick={(e) => { e.stopPropagation(); handleDelete(branch.name); }}
                  title="Delete"
                >
                  <X size={12} />
                </button>
              {/if}
            </div>
          {/each}
        {/if}

        <!-- Separator -->
        {#if filteredLocal.length > 0 && filteredRemote.length > 0}
          <div class="branch-separator"></div>
        {/if}

        <!-- Remote branches -->
        {#if filteredRemote.length > 0}
          <div class="branch-heading">{m.git_branch_remote_heading()}</div>
          {#each filteredRemote as branch (branch.name)}
            <button
              class="branch-row remote"
              onclick={() => handleCheckout(branch.name)}
            >
              <span class="branch-row-icon"></span>
              <span class="branch-row-name">{branch.name}</span>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .branch-picker {
    position: relative;
  }

  .branch-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: var(--th-bg-800);
    border: 1px solid var(--th-border-700);
    border-radius: 4px;
    color: var(--th-text-200);
    cursor: pointer;
    font-size: 12px;
    width: 100%;
  }

  .branch-toggle:hover {
    background: var(--th-bg-700);
  }

  .branch-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .branch-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .branch-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 100;
    margin-top: 2px;
    background: var(--th-bg-800);
    border: 1px solid var(--th-border-700);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .branch-search {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--th-border-700);
    color: var(--th-text-400);
  }

  .branch-search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--th-text-200);
    font-size: 12px;
  }

  .branch-create {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--th-border-700);
    color: var(--th-text-400);
  }

  .branch-create-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--th-text-200);
    font-size: 12px;
  }

  .branch-create-btn {
    padding: 2px 8px;
    background: var(--th-bg-700);
    border: 1px solid var(--th-border-700);
    border-radius: 3px;
    color: var(--th-text-200);
    font-size: 11px;
    cursor: pointer;
  }

  .branch-create-btn:hover:not(:disabled) {
    background: var(--th-bg-800);
  }

  .branch-create-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .branch-list {
    max-height: 260px;
    overflow-y: auto;
  }

  .branch-heading {
    padding: 4px 8px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--th-text-400);
  }

  .branch-row {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 0 8px;
    height: 28px;
    background: transparent;
    border: none;
    color: var(--th-text-200);
    cursor: pointer;
    font-size: 12px;
    text-align: left;
  }

  .branch-row:hover {
    background: var(--th-bg-700);
  }

  .branch-row.current {
    color: var(--th-text-200);
    font-weight: 600;
  }

  .branch-row.remote {
    color: var(--th-text-400);
  }

  .branch-row-icon {
    width: 16px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .branch-row-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .branch-badge {
    font-size: 10px;
    padding: 0 4px;
    border-radius: 3px;
    line-height: 16px;
  }

  .branch-badge.ahead {
    background: rgba(80, 200, 120, 0.15);
    color: #50c878;
  }

  .branch-badge.behind {
    background: rgba(200, 120, 80, 0.15);
    color: #c87850;
  }

  .branch-delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: transparent;
    border: none;
    border-radius: 3px;
    color: var(--th-text-400);
    cursor: pointer;
    opacity: 0;
    flex-shrink: 0;
  }

  .branch-row:hover .branch-delete-btn {
    opacity: 1;
  }

  .branch-delete-btn:hover {
    background: rgba(200, 60, 60, 0.2);
    color: #c83c3c;
  }

  .branch-separator {
    height: 1px;
    margin: 4px 8px;
    background: var(--th-border-700);
  }

  .branch-no-results {
    padding: 12px 8px;
    text-align: center;
    color: var(--th-text-400);
    font-size: 12px;
  }
</style>
