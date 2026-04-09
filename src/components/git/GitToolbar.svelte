<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";

  interface Props {
    modPath: string;
  }
  let { modPath }: Props = $props();
</script>

<div class="git-toolbar">
  <h3 class="git-toolbar-title">{m.git_panel_title()}</h3>
  <button
    class="git-toolbar-btn"
    title={m.git_refresh_tooltip()}
    onclick={() => gitStore.refresh(modPath)}
    disabled={gitStore.isLoading}
  >
    <RefreshCw size={14} class={gitStore.isLoading ? "spinning" : ""} />
  </button>
</div>

<style>
  .git-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-bottom: 1px solid var(--th-bg-700);
  }

  .git-toolbar-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--th-text-200);
    margin: 0;
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
</style>
