<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import GitBranch from "@lucide/svelte/icons/git-branch";

  interface Props {
    modPath: string;
  }
  let { modPath }: Props = $props();
</script>

<div class="git-init-prompt">
  <GitBranch size={32} strokeWidth={1.5} aria-hidden="true" />
  <p>{m.git_init_prompt()}</p>
  <button class="git-init-btn" onclick={() => gitStore.init(modPath)} aria-label="Initialize Git repository">
    {m.git_init_button()}
  </button>
</div>

<style>
  .git-init-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 2rem 1.5rem;
    text-align: center;
    color: var(--th-text-400);
  }

  .git-init-prompt p {
    font-size: 0.85rem;
    line-height: 1.5;
    max-width: 260px;
    color: var(--th-text-400);
  }

  .git-init-btn {
    padding: 7px 16px;
    border: none;
    border-radius: 4px;
    background: var(--th-accent-500);
    color: #fff;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .git-init-btn:hover {
    background: var(--th-accent-600);
  }
</style>
