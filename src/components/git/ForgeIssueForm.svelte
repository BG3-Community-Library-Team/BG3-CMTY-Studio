<script lang="ts">
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import { forgeCreateIssue } from "../../lib/tauri/git.js";
  import { toastStore } from "../../lib/stores/toastStore.svelte.js";
  import type { ForgeInfo } from "../../lib/tauri/git.js";

  interface Props {
    info: ForgeInfo;
    onclose?: () => void;
  }
  let { info, onclose }: Props = $props();

  let title = $state("");
  let body = $state("");
  let submitting = $state(false);

  async function submit() {
    if (!title.trim() || !info.owner || !info.repo) return;
    submitting = true;
    try {
      await forgeCreateIssue(
        info.host, info.forgeType, info.apiBase,
        info.owner, info.repo,
        title.trim(), body
      );
      toastStore.success("Issue created");
      title = "";
      body = "";
      onclose?.();
      await gitStore.refreshForge();
    } catch (e) {
      toastStore.error("Failed to create issue", String(e));
    } finally {
      submitting = false;
    }
  }
</script>

<form class="forge-form" onsubmit={(e) => { e.preventDefault(); submit(); }} aria-label="Create issue form">
  <h4 class="forge-form-title">Create Issue</h4>

  <label class="forge-field">
    <span class="forge-field-label">Title</span>
    <input
      type="text"
      class="forge-input"
      bind:value={title}
      placeholder="Issue title…"
      required
      disabled={submitting}
    />
  </label>

  <label class="forge-field">
    <span class="forge-field-label">Description</span>
    <textarea
      class="forge-textarea"
      bind:value={body}
      placeholder="Optional description (markdown)…"
      rows="4"
      disabled={submitting}
    ></textarea>
  </label>

  <div class="forge-form-actions">
    <button type="button" class="forge-btn" onclick={onclose} disabled={submitting}>
      Cancel
    </button>
    <button type="submit" class="forge-btn primary" disabled={!title.trim() || submitting}>
      {submitting ? "Creating…" : "Create Issue"}
    </button>
  </div>
</form>

<style>
  .forge-form {
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .forge-form-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--th-text-200);
    margin: 0 0 4px 0;
  }

  .forge-field {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .forge-field-label {
    font-size: 0.7rem;
    color: var(--th-text-400);
    font-weight: 500;
  }

  .forge-input,
  .forge-textarea {
    background: var(--th-bg-800);
    border: 1px solid var(--th-bg-600);
    border-radius: 4px;
    color: var(--th-text-200);
    padding: 4px 8px;
    font-size: 0.75rem;
    font-family: inherit;
  }

  .forge-input:focus,
  .forge-textarea:focus {
    outline: none;
    border-color: var(--th-accent-400, #6366f1);
  }

  .forge-textarea {
    resize: vertical;
    min-height: 60px;
  }

  .forge-form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 4px;
  }

  .forge-btn {
    padding: 4px 12px;
    border: none;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    background: var(--th-bg-700);
    color: var(--th-text-300);
  }

  .forge-btn:hover {
    background: var(--th-bg-600);
  }

  .forge-btn.primary {
    background: var(--th-accent-500, #6366f1);
    color: #fff;
  }

  .forge-btn.primary:hover {
    background: var(--th-accent-400, #818cf8);
  }

  .forge-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
