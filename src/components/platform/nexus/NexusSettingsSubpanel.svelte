<!--
  NexusSettingsSubpanel — Nexus Mods settings subpanel for Publishing section.
  Always visible (no project required). Connection + project-gated sections.
-->
<script lang="ts">
  import { m } from "../../../paraglide/messages.js";
  import { nexusStore } from "../../../lib/stores/nexusStore.svelte.js";
  import {
    nexusHasApiKey,
    nexusSetApiKey,
    nexusValidateApiKey,
    nexusClearApiKey,
  } from "../../../lib/tauri/nexus.js";
  import Check from "@lucide/svelte/icons/check";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Loader2 from "@lucide/svelte/icons/loader-2";

  type KeyStatus = "none" | "saved" | "valid" | "invalid" | "testing";

  let apiKeyInput = $state("");
  let keyStatus: KeyStatus = $state("none");

  // Sync with store's validated state
  $effect(() => {
    if (nexusStore.apiKeyValid) {
      keyStatus = "valid";
    }
  });

  // Check initial key status on mount
  $effect(() => {
    checkKeyStatus();
  });

  async function checkKeyStatus() {
    // If the store already knows the key is valid, trust that
    if (nexusStore.apiKeyValid) {
      keyStatus = "valid";
      return;
    }
    try {
      const hasKey = await nexusHasApiKey();
      if (hasKey) {
        keyStatus = "saved";
      } else {
        keyStatus = "none";
      }
    } catch {
      keyStatus = "none";
    }
  }

  async function saveApiKey() {
    if (!apiKeyInput.trim()) return;
    try {
      await nexusSetApiKey(apiKeyInput.trim());
      keyStatus = "saved";
      apiKeyInput = "";
      // Also update store state
      await nexusStore.checkApiKey();
    } catch {
      keyStatus = "invalid";
    }
  }

  async function testApiKey() {
    keyStatus = "testing";
    try {
      const profile = await nexusValidateApiKey();
      keyStatus = profile ? "valid" : "invalid";
      nexusStore.apiKeyValid = !!profile;
    } catch {
      keyStatus = "invalid";
    }
  }

  async function clearApiKey() {
    try {
      await nexusClearApiKey();
      keyStatus = "none";
      apiKeyInput = "";
      nexusStore.apiKeyValid = false;
    } catch { /* ignore */ }
  }

  function statusLabel(): string {
    switch (keyStatus) {
      case "none": return m.nexus_api_key_status_none();
      case "saved": return m.nexus_api_key_status_saved();
      case "valid": return m.nexus_api_key_status_valid();
      case "invalid": return m.nexus_api_key_status_invalid();
      case "testing": return m.nexus_api_key_status_testing();
      default: return "";
    }
  }

  function statusColor(): string {
    switch (keyStatus) {
      case "valid": return "var(--th-success, #10b981)";
      case "invalid": return "var(--th-error, #ef4444)";
      default: return "var(--th-text-500)";
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      saveApiKey();
    }
  }
</script>

<div class="space-y-4">
  <!-- Section Header -->
  <div class="flex items-center justify-between">
    <h4 class="text-sm font-semibold text-[var(--th-text-200)]">{m.nexus_settings_header()}</h4>
    <span
      class="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full"
      style="color: {keyStatus === 'valid' ? 'var(--th-success, #10b981)' : 'var(--th-text-500)'}; background: {keyStatus === 'valid' ? 'color-mix(in srgb, var(--th-success, #10b981) 12%, transparent)' : 'var(--th-bg-800)'}"
      role="status"
      aria-live="polite"
    >
      {#if keyStatus === "valid"}
        <Check size={10} aria-hidden="true" />
        {m.nexus_connected()}
      {:else}
        {m.nexus_not_connected()}
      {/if}
    </span>
  </div>

  <!-- Connection Section (always visible) -->
  <div class="space-y-3">
    <h5 class="text-xs font-medium text-[var(--th-text-300)]">{m.nexus_connection_section_label()}</h5>

    <!-- Status indicator -->
    <div class="flex items-center gap-1.5">
      <div
        class="w-2 h-2 rounded-full flex-shrink-0"
        style="background: {statusColor()}"
        aria-hidden="true"
      ></div>
      <span class="text-[10px]" style="color: {statusColor()}">{statusLabel()}</span>
      {#if keyStatus === "valid"}
        <Check size={12} class="text-[var(--th-success,#10b981)]" aria-label={m.nexus_api_key_status_valid()} />
      {:else if keyStatus === "invalid"}
        <AlertCircle size={12} class="text-[var(--th-error,#ef4444)]" aria-label={m.nexus_api_key_status_invalid()} />
      {:else if keyStatus === "testing"}
        <Loader2 size={12} class="animate-spin text-[var(--th-text-400)]" aria-label={m.nexus_api_key_status_testing()} />
      {/if}
    </div>

    {#if keyStatus === "none"}
      <!-- API Key Input -->
      <div class="flex gap-2">
        <input
          type="password"
          class="flex-1 form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
          placeholder={m.nexus_api_key_placeholder()}
          bind:value={apiKeyInput}
          onkeydown={handleKeydown}
          autocomplete="off"
          aria-label={m.nexus_api_key_label()}
        />
        <button
          class="px-3 py-1.5 text-xs rounded bg-[var(--th-accent,#0ea5e9)] hover:brightness-110 text-white font-medium transition-colors disabled:opacity-40"
          disabled={!apiKeyInput.trim()}
          onclick={saveApiKey}
        >{m.nexus_save_button()}</button>
      </div>
      <a
        href="https://next.nexusmods.com/settings/api-keys"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 text-[10px] text-[var(--th-accent,#0ea5e9)] hover:underline"
      >
        {m.nexus_api_key_link()}
        <ExternalLink size={10} />
      </a>
    {:else}
      <!-- Test / Clear buttons -->
      <div class="flex gap-2">
        <button
          class="px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-300)] transition-colors disabled:opacity-40"
          disabled={keyStatus === "testing"}
          onclick={testApiKey}
        >{m.nexus_validate_button()}</button>
        <button
          class="px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-300)] transition-colors"
          onclick={clearApiKey}
        >{m.nexus_clear_button()}</button>
      </div>
    {/if}
  </div>
</div>
