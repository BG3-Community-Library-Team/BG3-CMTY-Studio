<script lang="ts">
  import { forgeGetIssue, forgeAssignIssue, type ForgeIssueDetail } from "../../lib/tauri/git.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import { toastStore } from "../../lib/stores/toastStore.svelte.js";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import UserPlus from "@lucide/svelte/icons/user-plus";

  interface Props {
    issueNumber: number;
  }
  let { issueNumber }: Props = $props();

  let detail = $state<ForgeIssueDetail | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    loadIssue(issueNumber);
  });

  async function loadIssue(num: number) {
    const info = gitStore.forgeInfo;
    if (!info || !info.owner || !info.repo) {
      error = "Forge not configured";
      loading = false;
      return;
    }
    loading = true;
    error = null;
    try {
      detail = await forgeGetIssue(
        info.host, info.forgeType, info.apiBase,
        info.owner, info.repo, num,
      );
    } catch (e) {
      error = String(e);
      detail = null;
    } finally {
      loading = false;
    }
  }

  async function assignSelf() {
    const info = gitStore.forgeInfo;
    const user = gitStore.forgeUser;
    if (!info || !info.owner || !info.repo || !user || !detail) return;
    try {
      await forgeAssignIssue(
        info.host, info.forgeType, info.apiBase,
        info.owner, info.repo, detail.number, user.login,
      );
      toastStore.success(`Assigned #${detail.number} to ${user.login}`);
      await loadIssue(detail.number);
      await gitStore.refreshForge();
    } catch (e) {
      toastStore.error("Failed to assign", String(e));
    }
  }

  async function openOnForge() {
    if (!detail) return;
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(detail.htmlUrl);
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric", month: "short", day: "numeric",
      });
    } catch {
      return iso;
    }
  }
</script>

<div class="issue-view">
  {#if loading}
    <div class="issue-loading">Loading issue…</div>
  {:else if error}
    <div class="issue-error">{error}</div>
  {:else if detail}
    <div class="issue-header">
      <h2 class="issue-title">
        <span class="issue-number">#{detail.number}</span>
        {detail.title}
      </h2>
      <div class="issue-header-actions">
        <button class="issue-btn" title="Assign to me" onclick={assignSelf}>
          <UserPlus size={14} /> Assign me
        </button>
        <button class="issue-btn" title="Open on forge" onclick={openOnForge}>
          <ExternalLink size={14} /> Open in browser
        </button>
      </div>
    </div>

    <div class="issue-meta">
      <span class="issue-state" class:open={detail.state === "open"} class:closed={detail.state === "closed"}>
        {detail.state}
      </span>
      <span class="issue-meta-item">Opened by <strong>{detail.author}</strong> on {formatDate(detail.createdAt)}</span>
      {#if detail.closedAt}
        <span class="issue-meta-item">Closed {formatDate(detail.closedAt)}</span>
      {/if}
    </div>

    {#if detail.assignees.length > 0}
      <div class="issue-field">
        <span class="issue-field-label">Assignees</span>
        <span class="issue-field-value">{detail.assignees.join(", ")}</span>
      </div>
    {/if}

    {#if detail.labels.length > 0}
      <div class="issue-field">
        <span class="issue-field-label">Labels</span>
        <span class="issue-labels">
          {#each detail.labels as label}
            <span class="issue-label">{label}</span>
          {/each}
        </span>
      </div>
    {/if}

    {#if detail.milestone}
      <div class="issue-field">
        <span class="issue-field-label">Milestone</span>
        <span class="issue-field-value">{detail.milestone}</span>
      </div>
    {/if}

    <div class="issue-body">
      {#if detail.body.trim()}
        <pre class="issue-body-text">{detail.body}</pre>
      {:else}
        <p class="issue-no-body">No description provided.</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .issue-view {
    padding: 16px 24px;
    max-width: 800px;
    color: var(--th-text-200);
    overflow-y: auto;
    height: 100%;
  }

  .issue-loading,
  .issue-error {
    padding: 2rem;
    text-align: center;
    color: var(--th-text-500);
    font-size: 0.85rem;
  }

  .issue-error {
    color: var(--th-error, #ef4444);
  }

  .issue-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .issue-title {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0;
    line-height: 1.4;
    color: var(--th-text-100);
  }

  .issue-number {
    color: var(--th-text-400);
    font-weight: 400;
    margin-right: 6px;
  }

  .issue-header-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .issue-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: 1px solid var(--th-border-600, #52525b);
    border-radius: 4px;
    background: var(--th-bg-800);
    color: var(--th-text-300);
    font-size: 0.75rem;
    cursor: pointer;
    white-space: nowrap;
  }

  .issue-btn:hover {
    background: var(--th-bg-700);
    color: var(--th-text-100);
  }

  .issue-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    font-size: 0.8rem;
    color: var(--th-text-400);
  }

  .issue-state {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .issue-state.open {
    background: color-mix(in srgb, var(--th-success, #22c55e) 20%, transparent);
    color: var(--th-success, #22c55e);
  }

  .issue-state.closed {
    background: color-mix(in srgb, var(--th-error, #ef4444) 20%, transparent);
    color: var(--th-error, #ef4444);
  }

  .issue-meta-item strong {
    color: var(--th-text-200);
  }

  .issue-field {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 0.8rem;
  }

  .issue-field-label {
    color: var(--th-text-500);
    min-width: 70px;
    flex-shrink: 0;
  }

  .issue-field-value {
    color: var(--th-text-200);
  }

  .issue-labels {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .issue-label {
    font-size: 0.72rem;
    padding: 2px 8px;
    border-radius: 12px;
    background: var(--th-bg-600);
    color: var(--th-text-200);
  }

  .issue-body {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--th-border-700, #3f3f46);
  }

  .issue-body-text {
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: inherit;
    font-size: 0.85rem;
    line-height: 1.6;
    color: var(--th-text-200);
    margin: 0;
  }

  .issue-no-body {
    color: var(--th-text-500);
    font-style: italic;
    font-size: 0.85rem;
    margin: 0;
  }
</style>
