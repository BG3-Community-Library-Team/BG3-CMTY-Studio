<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import { uiStore } from "../../lib/stores/uiStore.svelte.js";
  import { toastStore } from "../../lib/stores/toastStore.svelte.js";
  import GitToolbar from "./GitToolbar.svelte";
  import GitCommitBox from "./GitCommitBox.svelte";
  import GitFileList from "./GitFileList.svelte";
  import GitHistoryPanel from "./GitHistoryPanel.svelte";
  import GitStashPanel from "./GitStashPanel.svelte";
  import GitRemoteManager from "./GitRemoteManager.svelte";
  import GitInitPrompt from "./GitInitPrompt.svelte";
  import GitMergeConflictBanner from "./GitMergeConflictBanner.svelte";
  import ForgePRList from "./ForgePRList.svelte";
  import ForgeIssueList from "./ForgeIssueList.svelte";
  import ExplorerDrawer from "../ExplorerDrawer.svelte";
  import Plus from "@lucide/svelte/icons/plus";
  import XIcon from "@lucide/svelte/icons/x";

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

  // ── Drawer ordering with pin/hide ──

  /** All drawers that are currently relevant given the repo state */
  let activeDrawerIds = $derived.by(() => {
    const ids: string[] = [];
    if (hasStagedFiles) ids.push("git-staged");
    ids.push("git-changes");
    ids.push("git-history");
    if (hasStashes || gitStore.changedFileCount > 0) ids.push("git-stashes");
    if (gitStore.remotes.length > 0 || gitStore.isRepo) ids.push("git-remotes");
    if (gitStore.forgeConnected && gitStore.forgeInfo) {
      ids.push("git-prs");
      ids.push("git-issues");
    }
    return ids;
  });

  /** Visible drawers — hidden filtered out, pinned first */
  let visibleDrawerIds = $derived.by(() => {
    const visible = activeDrawerIds.filter(id => !uiStore.isDrawerHidden(id));
    const pinned = visible.filter(id => uiStore.isDrawerPinned(id));
    const unpinned = visible.filter(id => !uiStore.isDrawerPinned(id));
    return [...pinned, ...unpinned];
  });

  // ── Drawer titles ──
  let prLabel = $derived(
    gitStore.forgeInfo?.forgeType === "GitLab" ? "Merge Requests" : "Pull Requests"
  );

  function drawerTitle(id: string): string {
    switch (id) {
      case "git-staged": return m.git_staged_changes();
      case "git-changes": return m.git_changes();
      case "git-history": return m.git_history_heading();
      case "git-stashes": return m.git_stash_heading();
      case "git-remotes": return m.git_remote_heading();
      case "git-prs": return prLabel;
      case "git-issues": return "Issues";
      default: return id;
    }
  }

  let drawerTitleMap = $derived.by(() => {
    const map: Record<string, string> = {};
    for (const did of activeDrawerIds) map[did] = drawerTitle(did);
    return map;
  });

  // ── Drawer counts ──
  function drawerCount(id: string): number | undefined {
    switch (id) {
      case "git-staged": return gitStore.stagedFiles.length;
      case "git-changes": return gitStore.unstagedFiles.length + gitStore.untrackedFiles.length;
      case "git-stashes": return gitStore.stashes.length;
      case "git-prs": return gitStore.prs.length;
      case "git-issues": return gitStore.issues.length;
      default: return undefined;
    }
  }

  // ── Stash header action ──
  let hasChanges = $derived(gitStore.changedFileCount > 0);

  async function handleCreateStash() {
    const msg = window.prompt(m.git_stash_save_prompt());
    if (msg === null) return;
    try {
      await gitStore.stash(gitPath, msg || undefined);
      toastStore.success(m.git_stash_save_success());
    } catch (e) {
      toastStore.error(m.git_stash_failed(), String(e));
    }
  }

  // ── Remote header action ──
  let showRemoteAddForm = $state(false);
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
      {#each visibleDrawerIds as drawerId, i (drawerId)}
        <div
          class="git-drawer-slot"
          class:drawer-collapsed={uiStore.isDrawerCollapsed(drawerId)}
          class:drawer-sized={!uiStore.isDrawerCollapsed(drawerId) && uiStore.explorerDrawers[drawerId]?.height != null}
        >
          {#if drawerId === "git-staged"}
            <ExplorerDrawer id="git-staged" title={drawerTitle("git-staged")} count={drawerCount("git-staged")} isFirst={i === 0} allDrawerIds={activeDrawerIds} drawerTitles={drawerTitleMap}>
              {#snippet children()}
                <GitFileList files={gitStore.stagedFiles} staged={true} modPath={gitPath} />
              {/snippet}
            </ExplorerDrawer>

          {:else if drawerId === "git-changes"}
            <ExplorerDrawer id="git-changes" title={drawerTitle("git-changes")} count={drawerCount("git-changes")} isFirst={i === 0} allDrawerIds={activeDrawerIds} drawerTitles={drawerTitleMap}>
              {#snippet children()}
                {#if gitStore.unstagedFiles.length > 0 || gitStore.untrackedFiles.length > 0}
                  <GitFileList files={[...gitStore.unstagedFiles, ...gitStore.untrackedFiles]} staged={false} modPath={gitPath} />
                {:else}
                  <p class="git-no-changes">{m.git_no_changes()}</p>
                {/if}
              {/snippet}
            </ExplorerDrawer>

          {:else if drawerId === "git-history"}
            <ExplorerDrawer id="git-history" title={drawerTitle("git-history")} isFirst={i === 0} allDrawerIds={activeDrawerIds} drawerTitles={drawerTitleMap}>
              {#snippet children()}
                <GitHistoryPanel modPath={gitPath} />
              {/snippet}
            </ExplorerDrawer>

          {:else if drawerId === "git-stashes"}
            <ExplorerDrawer id="git-stashes" title={drawerTitle("git-stashes")} count={drawerCount("git-stashes")} isFirst={i === 0} allDrawerIds={activeDrawerIds} drawerTitles={drawerTitleMap}>
              {#snippet headerActions()}
                <button
                  class="drawer-hdr-btn"
                  title={m.git_stash_save()}
                  onclick={(e: MouseEvent) => { e.stopPropagation(); handleCreateStash(); }}
                  disabled={!hasChanges || gitStore.isSyncing}
                >
                  <Plus size={13} />
                </button>
              {/snippet}
              {#snippet children()}
                <GitStashPanel modPath={gitPath} />
              {/snippet}
            </ExplorerDrawer>

          {:else if drawerId === "git-remotes"}
            <ExplorerDrawer id="git-remotes" title={drawerTitle("git-remotes")} isFirst={i === 0} allDrawerIds={activeDrawerIds} drawerTitles={drawerTitleMap}>
              {#snippet headerActions()}
                <button
                  class="drawer-hdr-btn"
                  title={m.git_remote_add()}
                  onclick={(e: MouseEvent) => { e.stopPropagation(); showRemoteAddForm = !showRemoteAddForm; }}
                >
                  {#if showRemoteAddForm}
                    <XIcon size={13} />
                  {:else}
                    <Plus size={13} />
                  {/if}
                </button>
              {/snippet}
              {#snippet children()}
                <GitRemoteManager modPath={gitPath} bind:showAddForm={showRemoteAddForm} />
              {/snippet}
            </ExplorerDrawer>

          {:else if drawerId === "git-prs"}
            <ExplorerDrawer id="git-prs" title={drawerTitle("git-prs")} count={drawerCount("git-prs")} isFirst={i === 0} allDrawerIds={activeDrawerIds} drawerTitles={drawerTitleMap}>
              {#snippet children()}
                <ForgePRList prs={gitStore.prs} info={gitStore.forgeInfo!} prLabel={prLabel.replace(/s$/, "")} />
              {/snippet}
            </ExplorerDrawer>

          {:else if drawerId === "git-issues"}
            <ExplorerDrawer id="git-issues" title={drawerTitle("git-issues")} count={drawerCount("git-issues")} isFirst={i === 0} allDrawerIds={activeDrawerIds} drawerTitles={drawerTitleMap}>
              {#snippet children()}
                <ForgeIssueList issues={gitStore.issues} info={gitStore.forgeInfo!} />
              {/snippet}
            </ExplorerDrawer>
          {/if}
        </div>
      {/each}
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

  .drawer-hdr-btn {
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
    padding: 0;
  }

  .drawer-hdr-btn:hover:not(:disabled) {
    background: var(--th-bg-600, #52525b);
    color: var(--th-text-200);
  }

  .drawer-hdr-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
