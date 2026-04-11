<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import { toastStore } from "../../lib/stores/toastStore.svelte.js";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import CloudDownload from "@lucide/svelte/icons/cloud-download";
  import GitBranchPicker from "./GitBranchPicker.svelte";
  import GitForgePicker from "./GitForgePicker.svelte";

  interface Props {
    modPath: string;
  }
  let { modPath }: Props = $props();

  async function handlePull() {
    try {
      const result = await gitStore.pull(modPath);
      if (result.mergeResult.conflicts.length > 0) {
        toastStore.warning(m.git_pull_failed(), `${result.mergeResult.conflicts.length} conflicts`);
      } else {
        toastStore.success(m.git_pull_success());
      }
    } catch (e) {
      toastStore.error(m.git_pull_failed(), String(e));
    }
  }

  async function handlePush() {
    try {
      await gitStore.push(modPath);
      toastStore.success(m.git_push_success());
    } catch (e) {
      toastStore.error(m.git_push_failed(), String(e));
    }
  }

  async function handleSync() {
    try {
      await gitStore.sync(modPath);
      toastStore.success(m.git_sync_success());
    } catch (e) {
      toastStore.error(m.git_sync_failed(), String(e));
    }
  }

  async function handleFetch() {
    try {
      await gitStore.fetch(modPath);
      toastStore.success(m.git_fetch_success());
    } catch (e) {
      toastStore.error(m.git_fetch_failed(), String(e));
    }
  }

  let hasRemotes = $derived(gitStore.repoInfo?.hasRemotes ?? false);
  let ahead = $derived(gitStore.repoInfo?.ahead ?? 0);
  let behind = $derived(gitStore.repoInfo?.behind ?? 0);
</script>

<div class="git-toolbar">
  <h3 class="git-toolbar-title">{m.git_panel_title()}</h3>
  <div class="git-toolbar-actions">
    <GitBranchPicker {modPath} />
    <GitForgePicker />

    {#if hasRemotes}
      <!-- Ahead/behind indicator -->
      {#if ahead > 0 || behind > 0}
        <span class="git-ahead-behind">
          {#if behind > 0}<span class="git-behind">↓{behind}</span>{/if}
          {#if ahead > 0}<span class="git-ahead">↑{ahead}</span>{/if}
        </span>
      {/if}

      <button
        class="git-toolbar-btn"
        title={m.git_pull_tooltip()}
        aria-label={m.git_pull_tooltip()}
        onclick={handlePull}
        disabled={gitStore.isSyncing}
      >
        <ArrowDown size={14} aria-hidden="true" />
      </button>

      <button
        class="git-toolbar-btn"
        title={m.git_push_tooltip()}
        aria-label={m.git_push_tooltip()}
        onclick={handlePush}
        disabled={gitStore.isSyncing}
      >
        <ArrowUp size={14} aria-hidden="true" />
      </button>

      <button
        class="git-toolbar-btn"
        title={m.git_fetch_tooltip()}
        aria-label={m.git_fetch_tooltip()}
        onclick={handleFetch}
        disabled={gitStore.isSyncing}
      >
        <CloudDownload size={14} aria-hidden="true" />
      </button>
    {/if}

    <button
      class="git-toolbar-btn"
      title={m.git_refresh_tooltip()}
      aria-label={m.git_refresh_tooltip()}
      onclick={() => gitStore.refresh(modPath)}
      disabled={gitStore.isLoading}
    >
      <RefreshCw size={14} class={gitStore.isLoading ? "spinning" : ""} aria-hidden="true" />
    </button>
  </div>
</div>

{#if gitStore.syncProgress}
  <div class="git-sync-progress" aria-live="polite">
    <span class="git-sync-text">{gitStore.syncProgress}</span>
  </div>
{/if}

<style>
  .git-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 10px;
    border-bottom: 1px solid var(--th-bg-700);
  }

  .git-toolbar-title {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--th-text-200);
    margin: 0;
  }

  .git-toolbar-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .git-toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--th-text-400);
    cursor: pointer;
  }

  .git-toolbar-btn:hover:not(:disabled) {
    background: var(--th-sidebar-highlight, var(--th-bg-800));
    color: var(--th-text-200);
  }

  .git-toolbar-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.spinning) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .git-ahead-behind {
    display: flex;
    gap: 2px;
    font-size: 0.7rem;
    color: var(--th-text-400);
    font-variant-numeric: tabular-nums;
  }

  .git-ahead {
    color: var(--th-accent-green, #4ec9b0);
  }

  .git-behind {
    color: var(--th-accent-blue, #569cd6);
  }

  .git-sync-progress {
    display: flex;
    align-items: center;
    padding: 2px 10px;
    font-size: 0.7rem;
    color: var(--th-text-400);
    background: var(--th-bg-800);
    border-bottom: 1px solid var(--th-bg-700);
  }

  .git-sync-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
