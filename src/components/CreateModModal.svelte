<script lang="ts">
  import { m } from "../paraglide/messages.js";
  import { getErrorMessage } from "../lib/types/index.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import { createModScaffold } from "../lib/utils/tauri.js";
  import { scanAndImport } from "../lib/services/scanService.js";
  import { open } from "@tauri-apps/plugin-dialog";
  import { focusTrap } from "../lib/utils/focusTrap.js";
  import X from "@lucide/svelte/icons/x";
  import FilePlus2 from "@lucide/svelte/icons/file-plus-2";

  let modName = $state("");
  let author = $state("");
  let description = $state("");
  let useScriptExtender = $state(false);
  let isCreating = $state(false);

  function close() {
    uiStore.showCreateModModal = false;
    modName = "";
    author = "";
    description = "";
    useScriptExtender = false;
  }

  async function handleCreate() {
    if (!modName.trim()) return;
    const selected = await open({ directory: true, title: m.create_mod_dialog_title() });
    if (selected == null) return;
    const targetDir = Array.isArray(selected) ? selected[0] : String(selected);
    isCreating = true;
    try {
      const result = await createModScaffold(
        targetDir,
        modName.trim(),
        author.trim(),
        description.trim(),
        useScriptExtender,
      );
      await scanAndImport(result.mod_root);
      close();
    } catch (e: unknown) {
      toastStore.error(m.create_mod_failed_title(), getErrorMessage(e));
    } finally {
      isCreating = false;
    }
  }
</script>

{#if uiStore.showCreateModModal}
<div
  class="fixed inset-0 bg-[var(--th-modal-backdrop)] z-[60] flex items-center justify-center p-4"
  onclick={close}
  onkeydown={(e) => e.key === "Escape" && close()}
  role="presentation"
>
  <div
    class="bg-[var(--th-bg-800)] border border-[var(--th-border-700)] rounded-lg shadow-2xl w-full max-w-md flex flex-col"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === "Escape" && close()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="create-mod-title"
    tabindex="-1"
    use:focusTrap
  >
    <div class="px-5 py-4 border-b border-[var(--th-border-700)] flex items-center gap-3">
      <FilePlus2 size={18} class="text-emerald-400" />
      <h3 id="create-mod-title" class="text-sm font-bold text-[var(--th-text-100)]">{m.create_mod_title()}</h3>
      <button class="ml-auto p-2 rounded hover:bg-[var(--th-bg-600)]" onclick={close} aria-label={m.common_close()}>
        <X size={14} class="text-[var(--th-text-500)]" />
      </button>
    </div>

    <div class="px-5 py-4 space-y-3">
      <label class="flex flex-col gap-1 text-xs">
        <span class="text-[var(--th-text-400)] font-medium">{m.create_mod_name_label()} <span class="text-red-400">{m.create_mod_name_required()}</span></span>
        <input
          type="text"
          class="form-input bg-[var(--th-bg-700)] border border-[var(--th-border-600)] rounded px-2 py-1.5 text-xs text-[var(--th-text-100)] focus:border-[var(--th-accent-500,#0ea5e9)]"
          bind:value={modName}
          placeholder={m.create_mod_name_placeholder()}
        />
      </label>
      <label class="flex flex-col gap-1 text-xs">
        <span class="text-[var(--th-text-400)] font-medium">{m.create_mod_author_label()}</span>
        <input
          type="text"
          class="form-input bg-[var(--th-bg-700)] border border-[var(--th-border-600)] rounded px-2 py-1.5 text-xs text-[var(--th-text-100)] focus:border-[var(--th-accent-500,#0ea5e9)]"
          bind:value={author}
          placeholder={m.create_mod_author_placeholder()}
        />
      </label>
      <label class="flex flex-col gap-1 text-xs">
        <span class="text-[var(--th-text-400)] font-medium">{m.create_mod_description_label()}</span>
        <textarea
          class="form-input bg-[var(--th-bg-700)] border border-[var(--th-border-600)] rounded px-2 py-1.5 text-xs text-[var(--th-text-100)] focus:border-[var(--th-accent-500,#0ea5e9)] resize-y min-h-[48px]"
          bind:value={description}
          rows="2"
          placeholder={m.create_mod_description_placeholder()}
        ></textarea>
      </label>
      <label class="flex items-center gap-2 text-xs text-[var(--th-text-300)] cursor-pointer">
        <input type="checkbox" class="accent-[var(--th-accent-500)]" bind:checked={useScriptExtender} />
        {m.create_mod_script_extender_checkbox()}
      </label>
    </div>

    <div class="px-5 py-3 border-t border-[var(--th-border-700)] flex justify-end gap-2">
      <button
        class="px-3 py-1.5 text-xs rounded text-[var(--th-text-400)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-600)] transition-colors"
        onclick={close}
      >
        {m.common_cancel()}
      </button>
      <button
        class="px-4 py-1.5 text-xs rounded font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        onclick={handleCreate}
        disabled={isCreating || !modName.trim()}
      >
        {isCreating ? m.create_mod_button_creating() : m.create_mod_button_create()}
      </button>
    </div>
  </div>
</div>
{/if}

<style>
  .form-input {
    box-sizing: border-box;
    height: 2rem;
  }
  textarea.form-input {
    height: auto;
  }
</style>
