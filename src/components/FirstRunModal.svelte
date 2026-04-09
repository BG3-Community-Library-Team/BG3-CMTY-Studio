<script lang="ts">
  import { m } from "../paraglide/messages.js";
  import { settingsStore } from "../lib/stores/settingsStore.svelte.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import { focusTrap } from "../lib/utils/focusTrap.js";
  import { detectGameDataPath } from "../lib/utils/tauri.js";
  import Info from "@lucide/svelte/icons/info";
  import X from "@lucide/svelte/icons/x";
  import FolderSearch from "@lucide/svelte/icons/folder-search";

  let { show = $bindable(false) }: { show: boolean } = $props();
  let dontShowAgain = $state(false);
  let detecting = $state(false);

  function dismiss(): void {
    if (dontShowAgain) {
      settingsStore.hasSeenFirstRunModal = true;
      settingsStore.persist();
    }
    show = false;
  }

  function configureNow(): void {
    uiStore.toggleSidebar("loaded-data");
    dismiss();
  }

  async function autoDetect(): Promise<void> {
    detecting = true;
    try {
      const detected = await detectGameDataPath();
      if (detected) {
        settingsStore.setGameDataPath(detected);
        toastStore.success(m.first_run_toast_success_title(), detected);
        settingsStore.hasSeenFirstRunModal = true;
        settingsStore.persist();
        show = false;
      } else {
        toastStore.warning(m.first_run_toast_warning_title(), m.first_run_toast_warning_message());
      }
    } catch {
      toastStore.warning(m.first_run_toast_warning_title(), m.first_run_toast_error_message());
    } finally {
      detecting = false;
    }
  }
</script>

{#if show}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-[var(--th-modal-backdrop,rgba(0,0,0,0.6))] z-[70] flex items-center justify-center p-4"
    onkeydown={(e) => { if (e.key === "Escape") dismiss(); }}
  >
    <div
      class="bg-[var(--th-bg-900)] border border-[var(--th-border-700)] rounded-lg shadow-2xl w-full max-w-md"
      use:focusTrap
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-run-title"
    >
      <!-- Header -->
      <div class="px-5 py-4 border-b border-[var(--th-border-700)] flex items-center gap-3">
        <Info class="w-5 h-5 text-amber-500 shrink-0" aria-hidden="true" />
        <h2 id="first-run-title" class="text-sm font-bold text-[var(--th-text-100)] flex-1">
          {m.first_run_title()}
        </h2>
        <button
          class="p-1 rounded hover:bg-[var(--th-bg-700)] text-[var(--th-text-500)] cursor-pointer"
          onclick={dismiss}
          aria-label={m.common_close()}
        >
          <X size={16} />
        </button>
      </div>

      <!-- Content -->
      <div class="px-5 py-4 space-y-4 text-xs text-[var(--th-text-300)]">
        <p>{m.first_run_intro()}</p>
        <p>{m.first_run_features_intro()}</p>
        <ul class="list-disc list-inside space-y-1 ml-1 text-[var(--th-text-400)]">
          <li><strong>{m.first_run_feature_diff_label()}</strong> {m.first_run_feature_diff()}</li>
          <li><strong>{m.first_run_feature_combobox_label()}</strong> {m.first_run_feature_combobox()}</li>
          <li><strong>{m.first_run_feature_classification_label()}</strong> {m.first_run_feature_classification()}</li>
        </ul>
        <div class="pt-3 border-t border-[var(--th-border-700)]">
          <p class="mb-1.5">{m.first_run_without_data_heading()}</p>
          <ul class="list-disc list-inside space-y-1 ml-1 text-[var(--th-text-400)]">
            <li>{m.first_run_can_manual()}</li>
            <li>{m.first_run_can_export()}</li>
          </ul>
        </div>
        <p class="text-[var(--th-text-400)] italic">{m.first_run_project_folder_explanation()}</p>
          <p>{m.first_run_cta_text()}</p>
      </div>

      <!-- Footer -->
      <div class="px-5 py-3 border-t border-[var(--th-border-700)] space-y-3">
        <label class="flex items-center gap-2 text-xs text-[var(--th-text-400)] cursor-pointer select-none">
          <input
            type="checkbox"
            bind:checked={dontShowAgain}
            class="accent-[var(--th-accent-500)]"
          />
          {m.first_run_dont_show_again()}
        </label>
        <div class="flex justify-end gap-2">
          <button
            class="px-3 py-1.5 text-xs rounded text-[var(--th-text-400)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-700)] transition-colors cursor-pointer"
            onclick={dismiss}
          >
            {m.first_run_skip()}
          </button>
          <button
            class="px-3 py-1.5 text-xs rounded font-medium text-[var(--th-text-200)] border border-[var(--th-border-600)] hover:bg-[var(--th-bg-700)] transition-colors cursor-pointer flex items-center gap-1.5"
            onclick={autoDetect}
            disabled={detecting}
          >
            <FolderSearch size={13} />
            {detecting ? m.first_run_auto_detect_searching() : m.first_run_auto_detect()}
          </button>
          <button
            class="px-4 py-1.5 text-xs rounded font-medium bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer"
            onclick={configureNow}
          >
            {m.first_run_configure_manually()}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
