<script lang="ts">
  import { m } from "../paraglide/messages.js";
  import { focusTrap } from "../lib/utils/focusTrap.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import { scriptCreateFromTemplate } from "../lib/tauri/scripts.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { getErrorMessage } from "../lib/types/index.js";
  import X from "@lucide/svelte/icons/x";
  import FilePlus2 from "@lucide/svelte/icons/file-plus-2";

  type SeContext = 'Server' | 'Client' | 'Shared' | 'Other';

  interface Props {
    modFolder: string;
    defaultContext?: SeContext;
    onClose: () => void;
    onCreated: (filePath: string) => void;
  }

  let { modFolder, defaultContext = 'Server', onClose, onCreated }: Props = $props();

  // svelte-ignore state_referenced_locally
  let context: SeContext = $state(defaultContext);
  let fileName = $state('');
  let customPath = $state('');
  let isCreating = $state(false);

  const CONTEXT_OPTIONS: { value: SeContext; label: () => string }[] = [
    { value: 'Server', label: () => m.script_creation_context_server() },
    { value: 'Client', label: () => m.script_creation_context_client() },
    { value: 'Shared', label: () => m.script_creation_context_shared() },
    { value: 'Other', label: () => m.script_creation_context_other() },
  ];

  let templateId = $derived.by(() => {
    switch (context) {
      case 'Server': return 'lua_se_server_module';
      case 'Client': return 'lua_se_client_module';
      case 'Shared': return 'lua_se_shared_module';
      default: return 'lua_empty';
    }
  });

  let subfolderPath = $derived.by(() => {
    const prefix = modStore.modFilesPrefix || `Mods/${modFolder}/`;
    switch (context) {
      case 'Server': return `${prefix}ScriptExtender/Lua/Server/`;
      case 'Client': return `${prefix}ScriptExtender/Lua/Client/`;
      case 'Shared': return `${prefix}ScriptExtender/Lua/Shared/`;
      default: return customPath ? `${prefix}${customPath}` : prefix;
    }
  });

  let normalizedFileName = $derived(
    fileName.trim().endsWith('.lua') ? fileName.trim() : (fileName.trim() ? `${fileName.trim()}.lua` : '')
  );

  let fullPath = $derived(normalizedFileName ? `${subfolderPath}${normalizedFileName}` : '');

  let canCreate = $derived(normalizedFileName.length > 0 && !isCreating);

  async function handleCreate() {
    if (!canCreate || !fullPath) return;
    isCreating = true;
    try {
      const modPath = modStore.projectPath || modStore.selectedModPath;
      if (!modPath) throw new Error("No mod folder selected");

      const variables: Record<string, string> = {
        FILE_NAME: normalizedFileName,
        MOD_NAME: modFolder,
      };

      await scriptCreateFromTemplate(modPath, fullPath, templateId, variables);
      toastStore.success(m.script_creation_success());
      onCreated(fullPath);
      onClose();
    } catch (e: unknown) {
      toastStore.error(m.script_creation_title(), getErrorMessage(e));
    } finally {
      isCreating = false;
    }
  }
</script>

<div
  class="fixed inset-0 bg-[var(--th-modal-backdrop)] z-[60] flex items-center justify-center p-4"
  onclick={onClose}
  onkeydown={(e) => e.key === "Escape" && onClose()}
  role="presentation"
>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
  <div
    class="bg-[var(--th-bg-800)] border border-[var(--th-border-700)] rounded-lg shadow-2xl w-full max-w-md flex flex-col"
    onclick={(e) => e.stopPropagation()}
    use:focusTrap
    role="dialog"
    aria-modal="true"
    aria-label={m.script_creation_title()}
    tabindex="-1"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--th-border-700)]">
      <div class="flex items-center gap-2">
        <FilePlus2 size={16} class="text-[var(--th-accent-500)]" />
        <h2 class="text-sm font-semibold text-[var(--th-text-100)]">{m.script_creation_title()}</h2>
      </div>
      <button
        class="p-1 rounded hover:bg-[var(--th-bg-700)] text-[var(--th-text-500)] hover:text-[var(--th-text-200)] transition-colors"
        onclick={onClose}
        aria-label={m.common_close()}
      >
        <X size={16} />
      </button>
    </div>

    <!-- Body -->
    <div class="px-4 py-4 flex flex-col gap-4">
      <!-- Context selector -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-medium text-[var(--th-text-300)]" for="script-context">{m.script_creation_context()}</label>
        <select
          id="script-context"
          class="w-full px-3 py-1.5 text-sm rounded border border-[var(--th-border-700)] bg-[var(--th-bg-900)] text-[var(--th-text-100)] focus:outline-none focus:border-[var(--th-accent-500)]"
          bind:value={context}
        >
          {#each CONTEXT_OPTIONS as opt}
            <option value={opt.value}>{opt.label()}</option>
          {/each}
        </select>
      </div>

      <!-- Custom path (only for Other) -->
      {#if context === 'Other'}
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-[var(--th-text-300)]" for="script-custom-path">{m.script_creation_path_label()}</label>
          <input
            id="script-custom-path"
            type="text"
            class="w-full px-3 py-1.5 text-sm rounded border border-[var(--th-border-700)] bg-[var(--th-bg-900)] text-[var(--th-text-100)] placeholder:text-[var(--th-text-600)] focus:outline-none focus:border-[var(--th-accent-500)]"
            placeholder="ScriptExtender/Lua/"
            bind:value={customPath}
          />
        </div>
      {/if}

      <!-- Filename -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-medium text-[var(--th-text-300)]" for="script-filename">{m.script_creation_filename()}</label>
        <input
          id="script-filename"
          type="text"
          class="w-full px-3 py-1.5 text-sm rounded border border-[var(--th-border-700)] bg-[var(--th-bg-900)] text-[var(--th-text-100)] placeholder:text-[var(--th-text-600)] focus:outline-none focus:border-[var(--th-accent-500)]"
          placeholder="MyModule.lua"
          bind:value={fileName}
          onkeydown={(e) => { if (e.key === 'Enter') handleCreate(); }}
        />
      </div>

      <!-- Preview path -->
      {#if fullPath}
        <div class="text-[10px] text-[var(--th-text-500)] break-all font-mono bg-[var(--th-bg-900)] rounded px-2 py-1.5 border border-[var(--th-border-700)]">
          {fullPath}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="flex justify-end gap-2 px-4 py-3 border-t border-[var(--th-border-700)]">
      <button
        class="px-3 py-1.5 text-xs rounded border border-[var(--th-border-700)] text-[var(--th-text-300)] hover:bg-[var(--th-bg-700)] transition-colors"
        onclick={onClose}
      >
        {m.common_cancel()}
      </button>
      <button
        class="px-3 py-1.5 text-xs rounded bg-[var(--th-accent-500)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!canCreate}
        onclick={handleCreate}
      >
        {#if isCreating}
          {m.common_loading()}
        {:else}
          {m.script_creation_create()}
        {/if}
      </button>
    </div>
  </div>
</div>
