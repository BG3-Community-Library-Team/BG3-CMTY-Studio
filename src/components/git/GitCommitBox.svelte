<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";

  interface Props {
    modPath: string;
  }
  let { modPath }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      gitStore.commit(modPath);
    }
  }
</script>

<div class="git-commit-box">
  <textarea
    class="git-commit-input"
    placeholder={m.git_commit_placeholder()}
    bind:value={gitStore.commitMessage}
    onkeydown={handleKeydown}
    rows="3"
  ></textarea>
  <button
    class="git-commit-btn"
    disabled={!gitStore.commitMessage.trim() || gitStore.isCommitting || gitStore.stagedFiles.length === 0}
    onclick={() => gitStore.commit(modPath)}
  >
    {m.git_commit_button()}
  </button>
</div>

<style>
  .git-commit-box {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--th-bg-700);
  }

  .git-commit-input {
    width: 100%;
    resize: vertical;
    min-height: 60px;
    padding: 6px 8px;
    border: 1px solid var(--th-bg-700);
    border-radius: 4px;
    background: var(--th-bg-850, var(--th-bg-800));
    color: var(--th-text-200);
    font-size: 0.8rem;
    font-family: inherit;
    line-height: 1.4;
  }

  .git-commit-input::placeholder {
    color: var(--th-text-500);
  }

  .git-commit-input:focus {
    outline: none;
    border-color: var(--th-accent-500);
  }

  .git-commit-btn {
    padding: 5px 12px;
    border: none;
    border-radius: 4px;
    background: var(--th-accent-500);
    color: #fff;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .git-commit-btn:hover:not(:disabled) {
    background: var(--th-accent-600);
  }

  .git-commit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
