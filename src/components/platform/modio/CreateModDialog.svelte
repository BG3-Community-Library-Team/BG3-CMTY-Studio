<!--
  CreateModDialog — Modal dialog for creating a new mod on mod.io.
  Collects name, name ID (slug), summary, logo, and visibility.
-->
<script lang="ts">
  import { m } from "../../../paraglide/messages.js";
  import { modioCreateMod, type ModioModSummary, type ModioModResponse } from "../../../lib/tauri/modio.js";
  import { toastStore } from "../../../lib/stores/toastStore.svelte.js";
  import { focusTrap } from "../../../lib/utils/focusTrap.js";
  import { open as dialogOpen } from "@tauri-apps/plugin-dialog";
  import X from "@lucide/svelte/icons/x";
  import Upload from "@lucide/svelte/icons/upload";
  import ImageIcon from "@lucide/svelte/icons/image";
  import { getPrefersReducedMotion } from "../../../lib/stores/motion.svelte.js";

  let { onclose, oncreated }: {
    onclose: () => void;
    oncreated: (mod: ModioModSummary) => void;
  } = $props();

  // ── Form state ──────────────────────────────────────────────
  let name = $state("");
  let nameId = $state("");
  let nameIdManuallyEdited = $state(false);
  let summary = $state("");
  let logoPath = $state("");
  let logoFilename = $state("");
  let visible = $state(true);
  let submitting = $state(false);

  // ── Validation state ────────────────────────────────────────
  let nameError = $state("");
  let summaryError = $state("");
  let logoError = $state("");

  // ── Derived ─────────────────────────────────────────────────
  let summaryCount = $derived(summary.length);
  let autoNameId = $derived(
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  );

  // Auto-derive name ID when not manually edited
  $effect(() => {
    if (!nameIdManuallyEdited) {
      nameId = autoNameId;
    }
  });

  // ── Helpers ─────────────────────────────────────────────────

  const MAX_LOGO_SIZE = 8 * 1024 * 1024; // 8 MB

  function handleNameIdInput() {
    nameIdManuallyEdited = true;
  }

  function validate(): boolean {
    let valid = true;
    nameError = "";
    summaryError = "";
    logoError = "";

    if (!name.trim()) {
      nameError = m.modio_create_validation_name();
      valid = false;
    }
    if (!summary.trim()) {
      summaryError = m.modio_create_validation_summary();
      valid = false;
    }
    if (!logoPath) {
      logoError = m.modio_create_validation_logo();
      valid = false;
    }
    return valid;
  }

  async function selectLogo() {
    const selected = await dialogOpen({
      multiple: false,
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png"] }],
    });
    if (!selected) return;

    const filePath = typeof selected === "string" ? selected : selected;
    // Check file size via Tauri stat — use the path directly,
    // size validation happens server-side, but we do a client check via metadata
    // For now, store the path; the backend validates size on upload
    logoPath = filePath as string;
    // Extract filename for display
    const parts = logoPath.replace(/\\/g, "/").split("/");
    logoFilename = parts[parts.length - 1] || "";
    logoError = "";
  }

  async function handleSubmit() {
    if (!validate()) return;
    submitting = true;

    try {
      const response: ModioModResponse = await modioCreateMod({
        name: name.trim(),
        logo_path: logoPath,
        summary: summary.trim(),
        visible: visible ? 1 : 0,
      });

      // Build a summary object for the callback
      const newMod: ModioModSummary = {
        id: response.id,
        name: response.name,
        name_id: response.name_id,
        summary: summary.trim(),
        logo_url: "",
        status: response.status,
        visibility: visible ? 1 : 0,
        date_added: response.date_added,
        date_updated: response.date_added,
        stats: {
          downloads_total: 0,
          subscribers_total: 0,
          ratings_positive: 0,
          ratings_negative: 0,
        },
      };

      oncreated(newMod);
      onclose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toastStore.error(m.modio_create_mod_title(), message);
    } finally {
      submitting = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onclose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="fixed inset-0 bg-[var(--th-modal-backdrop)] z-[60] flex items-center justify-center p-4"
  role="presentation"
>
  <div
    class="bg-[var(--th-bg-800)] border border-[var(--th-border-700)] rounded-lg shadow-2xl w-full max-w-md flex flex-col"
    role="dialog"
    aria-modal="true"
    aria-labelledby="create-mod-title"
    tabindex="-1"
    use:focusTrap
  >
    <!-- Header -->
    <div class="px-5 py-4 border-b border-[var(--th-border-700)] flex items-center gap-3">
      <h3 id="create-mod-title" class="text-sm font-bold text-[var(--th-text-100)]">
        {m.modio_create_mod_title()}
      </h3>
      <button
        class="ml-auto p-2 rounded hover:bg-[var(--th-bg-600)]"
        onclick={onclose}
        aria-label={m.common_close()}
      >
        <X size={14} class="text-[var(--th-text-500)]" />
      </button>
    </div>

    <!-- Form -->
    <form
      class="px-5 py-4 space-y-4 overflow-y-auto max-h-[70vh]"
      onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}
    >
      <!-- Name -->
      <div class="space-y-1">
        <label for="create-mod-name" class="block text-xs font-medium text-[var(--th-text-300)]">
          {m.modio_create_name_label()}
          <span class="text-[var(--th-error,#ef4444)]">*</span>
        </label>
        <input
          id="create-mod-name"
          type="text"
          bind:value={name}
          required
          class="w-full px-3 py-2 text-sm rounded border bg-[var(--th-bg-900)] border-[var(--th-border-700)] text-[var(--th-text-100)] placeholder:text-[var(--th-text-500)] focus:outline-none focus:ring-1 focus:ring-[var(--th-accent-500)]"
          aria-invalid={nameError ? "true" : undefined}
          aria-describedby={nameError ? "create-mod-name-error" : undefined}
        />
        {#if nameError}
          <p id="create-mod-name-error" class="text-xs text-[var(--th-error,#ef4444)]" aria-live="assertive">
            {nameError}
          </p>
        {/if}
      </div>

      <!-- Name ID -->
      <div class="space-y-1">
        <label for="create-mod-name-id" class="block text-xs font-medium text-[var(--th-text-300)]">
          {m.modio_create_name_id_label()}
        </label>
        <input
          id="create-mod-name-id"
          type="text"
          bind:value={nameId}
          oninput={handleNameIdInput}
          class="w-full px-3 py-2 text-sm rounded border bg-[var(--th-bg-900)] border-[var(--th-border-700)] text-[var(--th-text-100)] placeholder:text-[var(--th-text-500)] focus:outline-none focus:ring-1 focus:ring-[var(--th-accent-500)]"
        />
        <p class="text-[10px] text-[var(--th-text-500)]">
          {m.modio_create_name_id_hint()}
        </p>
      </div>

      <!-- Summary -->
      <div class="space-y-1">
        <label for="create-mod-summary" class="block text-xs font-medium text-[var(--th-text-300)]">
          {m.modio_create_summary_label()}
          <span class="text-[var(--th-error,#ef4444)]">*</span>
        </label>
        <textarea
          id="create-mod-summary"
          bind:value={summary}
          maxlength={250}
          required
          rows={3}
          class="w-full px-3 py-2 text-sm rounded border bg-[var(--th-bg-900)] border-[var(--th-border-700)] text-[var(--th-text-100)] placeholder:text-[var(--th-text-500)] focus:outline-none focus:ring-1 focus:ring-[var(--th-accent-500)] resize-none"
          aria-invalid={summaryError ? "true" : undefined}
          aria-describedby={summaryError ? "create-mod-summary-error" : "create-mod-summary-count"}
        ></textarea>
        <div class="flex justify-between items-center">
          {#if summaryError}
            <p id="create-mod-summary-error" class="text-xs text-[var(--th-error,#ef4444)]" aria-live="assertive">
              {summaryError}
            </p>
          {:else}
            <span></span>
          {/if}
          <span id="create-mod-summary-count" class="text-[10px] text-[var(--th-text-500)]">
            {summaryCount}/250
          </span>
        </div>
      </div>

      <!-- Logo -->
      <div class="space-y-1">
        <span class="block text-xs font-medium text-[var(--th-text-300)]">
          {m.modio_create_logo_label()}
          <span class="text-[var(--th-error,#ef4444)]">*</span>
        </span>
        <button
          type="button"
          onclick={selectLogo}
          class="w-full flex items-center gap-2 px-3 py-2 text-sm rounded border border-dashed bg-[var(--th-bg-900)] border-[var(--th-border-700)] text-[var(--th-text-300)] hover:border-[var(--th-accent-500)] hover:text-[var(--th-text-100)] transition-colors"
        >
          {#if logoFilename}
            <ImageIcon size={14} />
            <span class="truncate">{logoFilename}</span>
          {:else}
            <Upload size={14} />
            <span>{m.modio_create_logo_select()}</span>
          {/if}
        </button>
        <p class="text-[10px] text-[var(--th-text-500)]">
          {m.modio_create_logo_hint()}
        </p>
        {#if logoError}
          <p class="text-xs text-[var(--th-error,#ef4444)]" aria-live="assertive">
            {logoError}
          </p>
        {/if}
      </div>

      <!-- Visibility -->
      <div class="flex items-center gap-3">
        <label for="create-mod-visibility" class="text-xs font-medium text-[var(--th-text-300)]">
          {m.modio_create_visibility_label()}
        </label>
        <input
          id="create-mod-visibility"
          type="checkbox"
          bind:checked={visible}
          class="accent-[var(--th-accent-500)]"
        />
      </div>
    </form>

    <!-- Footer -->
    <div class="px-5 py-3 border-t border-[var(--th-border-700)] flex justify-end">
      <button
        type="button"
        onclick={handleSubmit}
        disabled={submitting}
        class="px-4 py-2 text-sm font-medium rounded bg-[var(--th-accent-500)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {#if submitting}
          <span class="inline-flex items-center gap-2">
            <span class="w-3 h-3 border-2 border-white border-t-transparent rounded-full" class:animate-spin={!getPrefersReducedMotion()}></span>
            {m.modio_create_submit()}
          </span>
        {:else}
          {m.modio_create_submit()}
        {/if}
      </button>
    </div>
  </div>
</div>
