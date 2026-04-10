<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import { uiStore } from "../../lib/stores/uiStore.svelte.js";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import FileWarning from "@lucide/svelte/icons/file-warning";

  interface Props {
    modPath: string;
  }
  let { modPath }: Props = $props();

  function openConflictedFile(filePath: string) {
    uiStore.openScriptTab(filePath);
  }
</script>

<div class="conflict-banner" role="alert">
  <div class="conflict-banner-header">
    <AlertTriangle size={14} class="conflict-icon" />
    <span class="conflict-title">{m.git_conflict_banner_title()}</span>
    <span class="conflict-count">{m.git_conflict_banner_message({ count: gitStore.conflictedFiles.length })}</span>
  </div>

  <ul class="conflict-file-list">
    {#each gitStore.conflictedFiles as file (file.path)}
      <li class="conflict-file-item">
        <FileWarning size={12} />
        <span class="conflict-file-path" title={file.path}>{file.path}</span>
        <button
          class="conflict-open-btn"
          onclick={() => openConflictedFile(file.path)}
        >
          {m.git_conflict_open_file()}
        </button>
      </li>
    {/each}
  </ul>

  <p class="conflict-hint">{m.git_conflict_resolved_hint()}</p>
</div>

<style>
  .conflict-banner {
    background: var(--th-warning-bg, rgba(255, 167, 36, 0.1));
    border: 1px solid var(--th-warning, #ffa724);
    border-radius: 4px;
    margin: 6px 8px;
    padding: 6px 8px;
  }

  .conflict-banner-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--th-warning, #ffa724);
  }

  :global(.conflict-icon) {
    flex-shrink: 0;
  }

  .conflict-title {
    font-weight: 600;
  }

  .conflict-count {
    font-weight: 400;
    font-size: 0.75rem;
    color: var(--th-text-400);
  }

  .conflict-file-list {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
  }

  .conflict-file-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 0;
    font-size: 0.75rem;
    color: var(--th-text-300);
  }

  .conflict-file-path {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .conflict-open-btn {
    flex-shrink: 0;
    padding: 1px 6px;
    border: none;
    border-radius: 3px;
    background: var(--th-bg-700);
    color: var(--th-text-300);
    font-size: 0.7rem;
    cursor: pointer;
  }

  .conflict-open-btn:hover {
    background: var(--th-bg-600);
    color: var(--th-text-200);
  }

  .conflict-hint {
    margin: 4px 0 0;
    font-size: 0.7rem;
    font-style: italic;
    color: var(--th-text-500);
  }
</style>
