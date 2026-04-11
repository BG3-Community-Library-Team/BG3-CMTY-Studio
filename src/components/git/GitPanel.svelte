<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import { uiStore } from "../../lib/stores/uiStore.svelte.js";
  import GitToolbar from "./GitToolbar.svelte";
  import GitCommitBox from "./GitCommitBox.svelte";
  import GitFileList from "./GitFileList.svelte";
  import GitHistoryPanel from "./GitHistoryPanel.svelte";
  import GitStashPanel from "./GitStashPanel.svelte";
  import GitRemoteManager from "./GitRemoteManager.svelte";
  import GitInitPrompt from "./GitInitPrompt.svelte";
  import GitMergeConflictBanner from "./GitMergeConflictBanner.svelte";
  import ExplorerDrawer from "../ExplorerDrawer.svelte";
  import ForgeSection from "./ForgeSection.svelte";

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

  /** Track which drawers are present so we know which is "first" (no resize handle) */
  let hasStagedFiles = $derived(gitStore.stagedFiles.length > 0);
  let hasStashes = $derived(gitStore.stashes.length > 0);
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

    {#if gitStore.conflictedFiles.length > 0}
      <GitMergeConflictBanner modPath={gitPath} />
    {/if}

    <div class="git-drawer-layout">
      <!-- Staged Changes (hidden when empty) -->
      {#if hasStagedFiles}
        <div class="git-drawer-slot" class:drawer-collapsed={uiStore.isDrawerCollapsed("git-staged")} class:drawer-sized={!uiStore.isDrawerCollapsed("git-staged") && uiStore.explorerDrawers["git-staged"]?.height != null}>
          <ExplorerDrawer id="git-staged" title={m.git_staged_changes()} isFirst={true}>
            {#snippet children()}
              <GitFileList files={gitStore.stagedFiles} staged={true} modPath={gitPath} />
            {/snippet}
          </ExplorerDrawer>
        </div>
      {/if}

      <!-- Changes (unstaged + untracked) -->
      <div class="git-drawer-slot" class:drawer-collapsed={uiStore.isDrawerCollapsed("git-changes")} class:drawer-sized={!uiStore.isDrawerCollapsed("git-changes") && uiStore.explorerDrawers["git-changes"]?.height != null}>
        <ExplorerDrawer id="git-changes" title={m.git_changes()} isFirst={!hasStagedFiles}>
          {#snippet children()}
            {#if gitStore.unstagedFiles.length > 0 || gitStore.untrackedFiles.length > 0}
              <GitFileList files={[...gitStore.unstagedFiles, ...gitStore.untrackedFiles]} staged={false} modPath={gitPath} />
            {:else}
              <p class="git-no-changes">{m.git_no_changes()}</p>
            {/if}
          {/snippet}
        </ExplorerDrawer>
      </div>

      <!-- History -->
      <div class="git-drawer-slot" class:drawer-collapsed={uiStore.isDrawerCollapsed("git-history")} class:drawer-sized={!uiStore.isDrawerCollapsed("git-history") && uiStore.explorerDrawers["git-history"]?.height != null}>
        <ExplorerDrawer id="git-history" title={m.git_history_heading()} isFirst={false}>
          {#snippet children()}
            <GitHistoryPanel modPath={gitPath} />
          {/snippet}
        </ExplorerDrawer>
      </div>

      <!-- Stashes -->
      {#if hasStashes || gitStore.changedFileCount > 0}
        <div class="git-drawer-slot" class:drawer-collapsed={uiStore.isDrawerCollapsed("git-stashes")} class:drawer-sized={!uiStore.isDrawerCollapsed("git-stashes") && uiStore.explorerDrawers["git-stashes"]?.height != null}>
          <ExplorerDrawer id="git-stashes" title={m.git_stash_heading()} isFirst={false}>
            {#snippet children()}
              <GitStashPanel modPath={gitPath} />
            {/snippet}
          </ExplorerDrawer>
        </div>
      {/if}

      <!-- Remotes -->
      {#if gitStore.remotes.length > 0 || gitStore.isRepo}
        <div class="git-drawer-slot" class:drawer-collapsed={uiStore.isDrawerCollapsed("git-remotes")} class:drawer-sized={!uiStore.isDrawerCollapsed("git-remotes") && uiStore.explorerDrawers["git-remotes"]?.height != null}>
          <ExplorerDrawer id="git-remotes" title={m.git_remote_heading()} isFirst={false}>
            {#snippet children()}
              <GitRemoteManager modPath={gitPath} />
            {/snippet}
          </ExplorerDrawer>
        </div>
      {/if}

      <!-- Forge Integration -->
      <ForgeSection />
    </div>
  {/if}
</div>

<style>
  .git-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
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

  .git-drawer-layout {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
    justify-content: flex-end;
    overflow: hidden;
  }

  .git-drawer-slot {
    position: relative;
    min-height: 0;
    flex: 1 1 0%;
    overflow: hidden;
  }

  .git-drawer-slot.drawer-collapsed,
  .git-drawer-slot.drawer-sized {
    flex: 0 0 auto;
  }

  .git-no-changes {
    padding: 8px 16px;
    font-size: 0.8rem;
    color: var(--th-text-500);
    font-style: italic;
  }
</style>
