<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import GitToolbar from "./GitToolbar.svelte";
  import GitCommitBox from "./GitCommitBox.svelte";
  import GitFileList from "./GitFileList.svelte";
  import GitHistoryPanel from "./GitHistoryPanel.svelte";
  import GitInitPrompt from "./GitInitPrompt.svelte";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";

  let gitPath = $derived(modStore.projectPath || modStore.selectedModPath || "");

  // Reactive: refresh + restart polling whenever gitPath changes; clean up on unmount
  $effect(() => {
    if (gitPath) {
      gitStore.refresh(gitPath);
      gitStore.startPolling(gitPath);
    }
    return () => {
      gitStore.stopPolling();
    };
  });

  let stagedOpen = $state(true);
  let changesOpen = $state(true);
  let historyOpen = $state(true);
</script>

<div class="git-panel">
  {#if !gitPath}
    <div class="git-panel-empty">
      <p>{m.git_no_mod_loaded()}</p>
    </div>
  {:else if !gitStore.isRepo}
    <GitInitPrompt modPath={gitPath} />
  {:else}
    <GitToolbar modPath={gitPath} />
    <GitCommitBox modPath={gitPath} />

    <!-- Staged Changes (hidden when empty) -->
    {#if gitStore.stagedFiles.length > 0}
    <div class="git-section">
      <button class="git-section-header" onclick={() => { stagedOpen = !stagedOpen; }}>
        <span class="git-section-chevron" class:open={stagedOpen}><ChevronRight size={12} /></span>
        <span>{m.git_staged_changes()}</span>
        <span class="git-section-count">{gitStore.stagedFiles.length}</span>
      </button>
      {#if stagedOpen}
        <GitFileList files={gitStore.stagedFiles} staged={true} modPath={gitPath} />
      {/if}
    </div>
    {/if}

    <!-- Changes (unstaged + untracked) -->
    <div class="git-section">
      <button class="git-section-header" onclick={() => { changesOpen = !changesOpen; }}>
        <span class="git-section-chevron" class:open={changesOpen}><ChevronRight size={12} /></span>
        <span>{m.git_changes()}</span>
        <span class="git-section-count">{gitStore.unstagedFiles.length + gitStore.untrackedFiles.length}</span>
      </button>
      {#if changesOpen}
        {#if gitStore.unstagedFiles.length > 0 || gitStore.untrackedFiles.length > 0}
          <GitFileList files={[...gitStore.unstagedFiles, ...gitStore.untrackedFiles]} staged={false} modPath={gitPath} />
        {:else}
          <p class="git-no-changes">{m.git_no_changes()}</p>
        {/if}
      {/if}
    </div>

    <!-- History -->
    <div class="git-section git-history-section">
      <button class="git-section-header" onclick={() => { historyOpen = !historyOpen; }}>
        <span class="git-section-chevron" class:open={historyOpen}><ChevronRight size={12} /></span>
        <span>{m.git_history_heading()}</span>
      </button>
      {#if historyOpen}
        <GitHistoryPanel modPath={gitPath} />
      {/if}
    </div>
  {/if}
</div>

<style>
  .git-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    background: var(--th-sidebar-bg, var(--th-bg-900));
    color: var(--th-text-200);
  }

  .git-panel-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 1rem;
    text-align: center;
    color: var(--th-text-500);
    font-size: 0.85rem;
  }

  .git-section + .git-section {
    border-top: 1px solid var(--th-bg-700);
  }

  .git-section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 10px;
    border: none;
    background: transparent;
    color: var(--th-text-300);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
  }

  .git-section-header:hover {
    background: var(--th-sidebar-highlight, var(--th-bg-800));
  }

  .git-section-chevron {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s ease;
    color: var(--th-text-400);
  }

  .git-section-chevron.open {
    transform: rotate(90deg);
  }

  .git-section-count {
    margin-left: auto;
    min-width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    background: var(--th-bg-sky-600, #0284c7);
    color: #fff;
    font-size: 0.65rem;
    font-weight: 600;
  }

  .git-no-changes {
    padding: 8px 16px;
    font-size: 0.8rem;
    color: var(--th-text-500);
    font-style: italic;
  }

  .git-history-section {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
</style>
