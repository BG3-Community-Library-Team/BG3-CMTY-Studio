<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";

  interface Props {
    modPath: string;
  }
  let { modPath }: Props = $props();

  let focused = $state(false);

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
    aria-label="Commit message"
    placeholder={m.git_commit_placeholder()}
    bind:value={gitStore.commitMessage}
    onkeydown={handleKeydown}
    onfocus={() => { focused = true; }}
    onblur={() => { focused = false; }}
    rows={focused ? 3 : 1}
  ></textarea>
  <button
    class="git-commit-btn"
    aria-label="Commit staged changes"
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
    gap: 4px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--th-bg-700);
  }

  .git-commit-input {
    width: 100%;
    resize: none;
    padding: 4px 8px;
    border: 1px solid var(--th-input-border, var(--th-bg-700));
    border-radius: 3px;
    background: var(--th-input-bg, var(--th-bg-800));
    color: var(--th-input-text, var(--th-text-200));
    font-size: 0.75rem;
    font-family: inherit;
    line-height: 1.4;
    transition: all 0.15s ease;
  }

  .git-commit-input::placeholder {
    color: var(--th-text-500);
  }

  .git-commit-input:focus {
    outline: none;
    border-color: var(--th-bg-sky-600);
  }

  .git-commit-btn {
    padding: 3px 10px;
    border: none;
    border-radius: 3px;
    background: var(--th-bg-sky-600);
    color: #fff;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: filter 0.15s ease;
  }

  .git-commit-btn:hover:not(:disabled) {
    filter: brightness(1.15);
  }

  .git-commit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
