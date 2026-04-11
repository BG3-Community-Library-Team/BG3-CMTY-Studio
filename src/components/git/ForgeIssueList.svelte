<script lang="ts">
  import type { ForgeIssue, ForgeInfo } from "../../lib/tauri/git.js";
  import { forgeAssignIssue, forgeGetIssue, type ForgeIssueDetail } from "../../lib/tauri/git.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import { uiStore } from "../../lib/stores/uiStore.svelte.js";
  import { toastStore } from "../../lib/stores/toastStore.svelte.js";
  import { friendlyGitError } from "../../lib/utils/gitErrors.js";
  import CircleDot from "@lucide/svelte/icons/circle-dot";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import UserPlus from "@lucide/svelte/icons/user-plus";

  interface Props {
    issues: ForgeIssue[];
    info: ForgeInfo;
  }
  let { issues, info }: Props = $props();

  function openIssueDetail(issue: ForgeIssue) {
    uiStore.openTab({
      id: `forge-issue:${issue.number}`,
      label: `#${issue.number} ${issue.title}`,
      type: "forge-issue",
      filePath: String(issue.number),
      icon: "🔵",
      preview: true,
    });
  }

  async function openOnForge(e: MouseEvent, issue: ForgeIssue) {
    e.stopPropagation();
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(issue.htmlUrl);
  }

  async function assignSelf(e: MouseEvent, issue: ForgeIssue) {
    e.stopPropagation();
    const user = gitStore.forgeUser;
    if (!user || !info.owner || !info.repo) return;
    try {
      await forgeAssignIssue(
        info.host, info.forgeType, info.apiBase,
        info.owner, info.repo, issue.number, user.login,
      );
      toastStore.success(`Assigned #${issue.number} to ${user.login}`);
      await gitStore.refreshForge();
    } catch (err) {
      toastStore.error("Failed to assign issue", friendlyGitError(err instanceof Error ? err.message : String(err)));
    }
  }
</script>

{#if issues.length > 0}
  <div class="forge-list" role="list" aria-label="Issues">
    {#each issues as issue}
      <div
        class="forge-list-item"
        role="button"
        tabindex="0"
        onclick={() => openIssueDetail(issue)}
        onkeydown={(e) => { if (e.key === "Enter") openIssueDetail(issue); }}
        aria-label="Issue #{issue.number}: {issue.title}"
      >
        <CircleDot size={14} class="forge-item-icon" aria-hidden="true" />
        <span class="forge-item-number">#{issue.number}</span>
        <span class="forge-item-title">{issue.title}</span>
        {#if issue.assignee}
          <span class="forge-item-meta">{issue.assignee}</span>
        {/if}
        <span class="forge-item-actions">
          <button
            class="forge-action-btn"
            title="Assign to me"
            aria-label="Assign issue #{issue.number} to me"
            onclick={(e) => assignSelf(e, issue)}
          >
            <UserPlus size={13} aria-hidden="true" />
          </button>
          <button
            class="forge-action-btn"
            title="Open on {info.host}"
            aria-label="Open issue #{issue.number} on forge"
            onclick={(e) => openOnForge(e, issue)}
          >
            <ExternalLink size={13} aria-hidden="true" />
          </button>
        </span>
      </div>
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

  .forge-empty {
    padding: 6px 12px;
    font-size: 0.78rem;
    color: var(--th-text-500);
    font-style: italic;
    margin: 0;
  }
</style>
