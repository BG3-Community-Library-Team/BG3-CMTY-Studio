<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import GitToolbar from "./GitToolbar.svelte";
  import GitCommitBox from "./GitCommitBox.svelte";
  import GitFileList from "./GitFileList.svelte";
  import GitHistoryPanel from "./GitHistoryPanel.svelte";
  import GitInitPrompt from "./GitInitPrompt.svelte";
  import Drawer from "../Drawer.svelte";

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

  let stagedCollapsed = $state(false);
  let changesCollapsed = $state(false);
  let historyCollapsed = $state(false);
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
      <Drawer title={m.git_staged_changes()} count={gitStore.stagedFiles.length} bind:collapsed={stagedCollapsed}>
        <GitFileList files={gitStore.stagedFiles} staged={true} modPath={gitPath} />
      </Drawer>
    </div>
    {/if}

    <!-- Changes (unstaged + untracked) -->
    <div class="git-section">
      <Drawer title={m.git_changes()} count={gitStore.unstagedFiles.length + gitStore.untrackedFiles.length} bind:collapsed={changesCollapsed}>
        {#if gitStore.unstagedFiles.length > 0 || gitStore.untrackedFiles.length > 0}
          <GitFileList files={[...gitStore.unstagedFiles, ...gitStore.untrackedFiles]} staged={false} modPath={gitPath} />
        {:else}
          <p class="git-no-changes">{m.git_no_changes()}</p>
        {/if}
      </Drawer>
    </div>

    <!-- History -->
    <div class="git-section git-history-section">
      <Drawer title={m.git_history_heading()} bind:collapsed={historyCollapsed}>
        <GitHistoryPanel modPath={gitPath} />
      </Drawer>
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
