<!--
  ModioSettingsSubpanel — mod.io OAuth token auth settings subpanel for Publishing section.
  Always visible (no project required). Shows connected/disconnected state with token expiry warnings.
-->
<script lang="ts">
  import { m } from "../../../paraglide/messages.js";
  import { modioStore } from "../../../lib/stores/modioStore.svelte.js";
  import { toastStore } from "../../../lib/stores/toastStore.svelte.js";
  import ConnectionBadge from "../ConnectionBadge.svelte";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import LogOut from "@lucide/svelte/icons/log-out";

  let tokenInput = $state("");
  let isSaving = $state(false);
  let tokenInputEl: HTMLInputElement | undefined = $state(undefined);

  let badgeStatus: "connected" | "warning" | "disconnected" = $derived(
    modioStore.isAuthenticated
      ? (modioStore.daysUntilExpiry <= 30 ? "warning" : "connected")
      : "disconnected"
  );

  let badgeLabel = $derived(
    modioStore.isAuthenticated
      ? (modioStore.tokenExpired ? m.modio_status_expired() : m.modio_status_connected())
      : m.modio_status_disconnected()
  );

  async function handleSaveToken() {
    const raw = tokenInput.trim();
    if (!raw || isSaving) return;
    isSaving = true;
    try {
      await modioStore.saveToken(raw);
      tokenInput = "";
    } catch {
      toastStore.error(m.modio_auth_error_title(), modioStore.connectionError ?? m.modio_error_invalid_token());
    } finally {
      isSaving = false;
    }
  }

  async function handleDisconnect() {
    await modioStore.disconnect();
    tokenInputEl?.focus();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      handleSaveToken();
    }
  }
</script>

<div class="space-y-4">
  <!-- Section Header -->
  <div class="flex items-center justify-between">
    <h4 class="text-sm font-semibold text-[var(--th-text-200)]">{m.modio_settings_header()}</h4>
    <ConnectionBadge status={badgeStatus} label={badgeLabel} />
  </div>

  {#if modioStore.isAuthenticated}
    <!-- Connected State -->
    <div class="space-y-3">
      <!-- User profile -->
      <div class="flex items-center gap-3">
        {#if modioStore.avatarUrl}
          <img
            src={modioStore.avatarUrl}
            alt=""
            class="w-8 h-8 rounded-full"
            loading="lazy"
          />
        {/if}
        <div class="text-xs text-[var(--th-text-300)]">
          {m.modio_connected_as({ name: modioStore.userName ?? "" })}
        </div>
      </div>

      <!-- Token expiry -->
      {#if modioStore.tokenExpiry}
        <div
          class="flex items-center gap-1.5 text-xs"
          style="color: {modioStore.tokenExpired ? 'var(--th-error, #ef4444)' : modioStore.daysUntilExpiry <= 30 ? 'var(--th-warning, #f59e0b)' : 'var(--th-success, #10b981)'}"
          aria-live="polite"
        >
          <AlertTriangle size={12} aria-hidden="true" />
          {#if modioStore.tokenExpired}
            {m.modio_token_expired()}
          {:else}
            {m.modio_token_expiry_warning({ days: String(modioStore.daysUntilExpiry) })}
          {/if}
        </div>
      {/if}

      <!-- Disconnect button -->
      <button
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-300)] transition-colors"
        onclick={handleDisconnect}
      >
        <LogOut size={12} aria-hidden="true" />
        {m.modio_disconnect()}
      </button>
    </div>
  {:else}
    <!-- Disconnected State -->
    <div class="space-y-3">
      <p class="text-xs text-[var(--th-text-400)]">
        {m.modio_token_hint()}
      </p>

      <!-- Token input -->
      <div class="flex gap-2">
        <input
          type="password"
          class="flex-1 form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
          placeholder={m.modio_token_placeholder()}
          bind:value={tokenInput}
          bind:this={tokenInputEl}
          onkeydown={handleKeydown}
          autocomplete="off"
          aria-label={m.modio_token_label()}
        />
        <button
          class="px-3 py-1.5 text-xs rounded bg-[var(--th-accent,#0ea5e9)] hover:brightness-110 text-white font-medium transition-colors disabled:opacity-40"
          disabled={!tokenInput.trim() || isSaving}
          onclick={handleSaveToken}
        >
          {#if isSaving}
            <Loader2 size={12} class="animate-spin" />
          {:else}
            {m.modio_connect_btn()}
          {/if}
        </button>
      </div>

      <a
        href="https://mod.io/me/access"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 text-[10px] text-[var(--th-accent,#0ea5e9)] hover:underline"
      >
        {m.modio_get_token_link()}
        <ExternalLink size={10} />
      </a>

      <p class="text-[10px] text-[var(--th-text-500)]">
        {m.modio_connect_to_manage()}
      </p>
    </div>
  {/if}
</div>
