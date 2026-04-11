<script lang="ts">
  import type { ForgePR, ForgeInfo } from "../../lib/tauri/git.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import { toastStore } from "../../lib/stores/toastStore.svelte.js";
  import GitPullRequest from "@lucide/svelte/icons/git-pull-request";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";

  interface Props {
    prs: ForgePR[];
    info: ForgeInfo;
    prLabel: string;
  }
  let { prs, info, prLabel }: Props = $props();

  let checkingOut = $state<number | null>(null);

  async function checkoutPR(e: MouseEvent, pr: ForgePR) {
    e.stopPropagation();
    const modPath = modStore.projectPath || modStore.selectedModPath || "";
    if (!modPath) return;

    // Safety: only checkout if working tree is clean
    if (gitStore.changedFileCount > 0) {
      toastStore.error("Cannot checkout", "You have uncommitted changes. Stash or commit them first.");
      return;
    }

    checkingOut = pr.number;
    try {
      // Fetch to ensure we have the remote branch
      await gitStore.fetch(modPath);
      // Try checkout — branch may be local or remote
      try {
        await gitStore.checkout(modPath, pr.headRef);
      } catch {
        // If the local branch doesn't exist, try the remote tracking branch
        await gitStore.checkout(modPath, `origin/${pr.headRef}`);
      }
      toastStore.success(`Checked out ${pr.headRef}`);
    } catch (e) {
      toastStore.error("Checkout failed", String(e));
    } finally {
      checkingOut = null;
    }
  }

  async function openOnForge(e: MouseEvent, pr: ForgePR) {
    e.stopPropagation();
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(pr.htmlUrl);
  }
</script>

{#if prs.length > 0}
  <div class="forge-list">
    {#each prs as pr}
      <div class="forge-list-item">
        <GitPullRequest size={14} class="forge-item-icon" />
        <span class="forge-item-number">#{pr.number}</span>
        <span class="forge-item-title">{pr.title}</span>
        {#if pr.mergeable === false}
          <span class="forge-conflict" title="Has merge conflicts">
            <AlertTriangle size={12} />
          </span>
        {/if}
        <span class="forge-item-meta">{pr.headRef}</span>
        <span class="forge-item-actions">
          <button
            class="forge-action-btn"
            title="Checkout {pr.headRef}"
            onclick={(e) => checkoutPR(e, pr)}
            disabled={checkingOut !== null}
          >
            <GitBranch size={13} />
          </button>
          <button
            class="forge-action-btn"
            title="Open on {info.host}"
            onclick={(e) => openOnForge(e, pr)}
          >
            <ExternalLink size={13} />
          </button>
        </span>
      </div>
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
    cursor: default;
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
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .forge-conflict {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    color: var(--th-warning-400, #f59e0b);
    title: "Merge conflicts";
  }

  .forge-item-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.1s ease;
    margin-left: auto;
  }

  .forge-list-item:hover .forge-item-actions {
    opacity: 1;
  }

  .forge-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--th-text-400);
    cursor: pointer;
    padding: 0;
  }

  .forge-action-btn:hover {
    background: var(--th-bg-600);
    color: var(--th-text-200);
  }

  .forge-action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .forge-empty {
    padding: 6px 12px;
    font-size: 0.78rem;
    color: var(--th-text-500);
    font-style: italic;
    margin: 0;
  }
</style>
