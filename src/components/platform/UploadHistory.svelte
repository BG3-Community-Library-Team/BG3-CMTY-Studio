<script lang="ts">
  import { uploadHistoryStore, type UploadHistoryEntry } from "../../lib/stores/uploadHistoryStore.svelte.js";
  import { m } from "../../paraglide/messages.js";
  import Clock from "@lucide/svelte/icons/clock";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import CheckCircle from "@lucide/svelte/icons/check-circle";
  import XCircle from "@lucide/svelte/icons/x-circle";

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  function platformLabel(entry: UploadHistoryEntry): string {
    return entry.platform === "Nexus" ? "Nexus Mods" : "mod.io";
  }
</script>

<div class="upload-history" role="region" aria-label={m.upload_history_title()}>
  <div class="history-header">
    <h3>
      <Clock size={16} />
      {m.upload_history_title()}
    </h3>
    {#if uploadHistoryStore.entries.length > 0}
      <button
        type="button"
        class="clear-btn"
        onclick={() => uploadHistoryStore.clear()}
      >
        {m.upload_history_clear()}
      </button>
    {/if}
  </div>

  {#if uploadHistoryStore.entries.length === 0}
    <p class="empty-msg">{m.upload_history_empty()}</p>
  {:else}
    <ul class="history-list" role="list">
      {#each uploadHistoryStore.entries as entry (entry.id)}
        <li class="history-entry" class:failed={entry.status === "failed"}>
          <div class="entry-icon">
            {#if entry.status === "success"}
              <CheckCircle size={16} />
            {:else}
              <XCircle size={16} />
            {/if}
          </div>
          <div class="entry-details">
            <span class="entry-name">{entry.modName}</span>
            <span class="entry-meta">
              {entry.fileName} · v{entry.version} · {platformLabel(entry)} · {formatDate(entry.timestamp)}
            </span>
          </div>
          <div class="entry-actions">
            {#if entry.url}
              <a href={entry.url} target="_blank" rel="noopener noreferrer" class="action-btn" title={m.upload_history_view()}>
                <ExternalLink size={14} />
              </a>
            {/if}
            <button
              type="button"
              class="action-btn delete"
              title={m.upload_history_remove()}
              onclick={() => uploadHistoryStore.removeEntry(entry.id)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .upload-history {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .history-header h3 {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--th-text-100);
    margin: 0;
  }

  .clear-btn {
    font-size: 0.75rem;
    color: var(--th-text-400);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
  }

  .clear-btn:hover {
    color: var(--th-text-200);
    background: var(--th-bg-800);
  }

  .empty-msg {
    font-size: 0.8125rem;
    color: var(--th-text-400);
    text-align: center;
    padding: 1rem 0;
  }

  .history-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .history-entry {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border-radius: 0.375rem;
    background: var(--th-bg-900);
    border: 1px solid var(--th-border-800);
  }

  .history-entry.failed {
    border-color: var(--th-error-border, #7f1d1d);
  }

  .entry-icon {
    display: flex;
    color: var(--th-success-text, #22c55e);
  }

  .history-entry.failed .entry-icon {
    color: var(--th-error-text, #ef4444);
  }

  .entry-details {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .entry-name {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--th-text-100);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .entry-meta {
    font-size: 0.6875rem;
    color: var(--th-text-400);
  }

  .entry-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border: none;
    background: none;
    color: var(--th-text-400);
    cursor: pointer;
    border-radius: 0.25rem;
    text-decoration: none;
  }

  .action-btn:hover {
    background: var(--th-bg-700);
    color: var(--th-text-200);
  }

  .action-btn.delete:hover {
    color: var(--th-error-text, #ef4444);
  }
</style>
