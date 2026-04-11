<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import { uiStore } from "../../lib/stores/uiStore.svelte.js";
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import { registerDynamicBranchCommands } from "../../lib/plugins/gitCommands.svelte.js";
  import GitBranch from "@lucide/svelte/icons/git-branch";

  interface Props {
    modPath: string;
  }

  let { modPath }: Props = $props();

  function openBranchPalette() {
    // Ensure branch list + history are fresh, register dynamic commands, then open palette
    gitStore.refreshBranches(modPath);
    const gitPath = modStore.projectPath || modStore.selectedModPath || "";
    if (gitPath) gitStore.loadHistory(gitPath);
    registerDynamicBranchCommands();
    uiStore.openCommandPalette(">git:");
  }
</script>

<button class="branch-toggle" onclick={openBranchPalette} title={m.git_branch_picker_label()} aria-label={`Current branch: ${gitStore.currentBranch ?? "HEAD"}. Click to switch branch`}>
  <GitBranch size={14} aria-hidden="true" />
  <span class="branch-name">{gitStore.currentBranch ?? "HEAD"}</span>
</button>

<style>
  .branch-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    background: transparent;
    border: 1px solid var(--th-input-border, var(--th-bg-700));
    border-radius: 3px;
    color: var(--th-text-200);
    cursor: pointer;
    font-size: 0.75rem;
  }

  .branch-toggle:hover {
    background: var(--th-sidebar-highlight, var(--th-bg-800));
  }

  .branch-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
