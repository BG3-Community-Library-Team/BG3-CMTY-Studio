<script lang="ts">
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import { uiStore } from "../../lib/stores/uiStore.svelte.js";
  import { settingsStore } from "../../lib/stores/settingsStore.svelte.js";
  import { toastStore } from "../../lib/stores/toastStore.svelte.js";
  import { m } from "../../paraglide/messages.js";
  import { scriptCreateFromTemplate } from "../../lib/tauri/scripts.js";
  import { listModFiles } from "../../lib/utils/tauri.js";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";

  let scanResult = $derived(modStore.scanResult);
  let modFolder = $derived(scanResult?.mod_meta?.folder ?? "");

  /** Derive the active node key from the current tab */
  let activeNodeKey = $derived.by(() => {
    const tab = uiStore.activeTab;
    if (!tab) return "";
    if (tab.type === "readme") return "readme";
    if (tab.type === "script-editor") return `file:${tab.filePath ?? ""}`;
    return "";
  });

  /** Whether MCM_blueprint.json already exists in the mod root (Mods/{folder}/) */
  let mcmBlueprintPath = $derived.by(() => {
    if (!modFolder) return null;
    const prefix = `Mods/${modFolder}/`;
    const match = modStore.modFiles.find(f => f.rel_path === `${prefix}MCM_blueprint.json`);
    return match ? `${prefix}MCM_blueprint.json` : null;
  });

  /** Open existing MCM_blueprint.json or create one from template */
  async function openOrCreateMcmBlueprint() {
    const modPath = modStore.selectedModPath;
    if (!modPath || !modFolder) return;
    if (mcmBlueprintPath) {
      uiStore.openScriptTab(mcmBlueprintPath);
    } else {
      const relPath = `Mods/${modFolder}/MCM_blueprint.json`;
      const variables: Record<string, string> = {
        FILE_NAME: 'MCM_blueprint.json',
        MOD_NAME: modFolder,
        MOD_TABLE: modFolder.replace(/[^a-zA-Z0-9_]/g, '_'),
      };
      try {
        await scriptCreateFromTemplate(modPath, relPath, 'mcm_blueprint', variables);
        modStore.modFiles = await listModFiles(modPath);
        uiStore.openScriptTab(relPath);
        toastStore.success("MCM Blueprint created", "MCM_blueprint.json");
      } catch (e) {
        toastStore.error("MCM Blueprint creation failed", String(e));
      }
    }
  }
</script>

<!-- Readme -->
<button
  class="tree-node"
  class:active-node={activeNodeKey === 'readme'}
  onclick={() => uiStore.openTab({ id: "readme", label: "README.md", type: "readme", icon: "📝" })}
>
  <span class="w-3.5 shrink-0"></span>
  <BookOpen size={14} class="text-[var(--th-text-sky-400)]" />
  <span class="node-label">Readme</span>
</button>

<!-- MCM (if enabled) -->
{#if settingsStore.enableMcmSupport}
  <button
    class="tree-node"
    class:active-node={mcmBlueprintPath ? activeNodeKey === `file:${mcmBlueprintPath}` : false}
    onclick={() => openOrCreateMcmBlueprint()}
  >
    <span class="w-3.5 shrink-0"></span>
    <SlidersHorizontal size={14} class="text-[var(--th-text-purple-400)]" />
    <span class="node-label">Mod Configuration Menu</span>
    {#if !mcmBlueprintPath}
      <span class="ext-badge" style="background: var(--th-badge-yaml)">new</span>
    {/if}
  </button>
{/if}

<style>
  /* Styles inherited from parent .file-explorer :global() rules */
</style>
