<!--
  ModioAuthPanel — mod.io authentication panel with direct OAuth2 token entry.
  Users generate an Access Token at mod.io/me/access and paste it here.
-->
<script lang="ts">
  import { m } from "../../../paraglide/messages.js";
  import { settingsStore } from "../../../lib/stores/settingsStore.svelte.js";
  import { modioHasOauthToken, modioGetUser, modioSetOauthToken, modioDisconnect } from "../../../lib/tauri/modio.js";
  import Check from "@lucide/svelte/icons/check";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import LogOut from "@lucide/svelte/icons/log-out";
  import User from "@lucide/svelte/icons/user";

  type AuthState = "disconnected" | "connected" | "expired";

  let tokenInput = $state("");
  let authState = $state<AuthState>("disconnected");
  let errorMsg = $state("");
  let loading = $state(false);
  let showDisconnectConfirm = $state(false);
  let avatarUrl = $state("");
  let userName = $state("");

  let daysUntilExpiry = $derived.by(() => {
    if (!settingsStore.modioTokenExpiry) return -1;
    const expiry = new Date(settingsStore.modioTokenExpiry);
    const now = new Date();
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  });

  let tokenWarning = $derived(daysUntilExpiry > 0 && daysUntilExpiry <= 30);
  let tokenExpired = $derived(daysUntilExpiry <= 0 && settingsStore.modioTokenExpiry !== "");

  const STEP_LABELS = [
    () => m.modio_step_access_token(),
    () => m.modio_step_connected(),
  ];

  let currentStep = $derived(authState === "connected" || authState === "expired" ? 2 : 0);

  // Check initial state on mount
  $effect(() => {
    checkInitialState();
  });

  async function checkInitialState() {
    try {
      const hasToken = await modioHasOauthToken();
      if (!hasToken) {
        authState = "disconnected";
        return;
      }
      try {
        const user = await modioGetUser();
        userName = user.name;
        avatarUrl = user.avatar_url;
        settingsStore.modioUserName = user.name;
        settingsStore.modioUserId = String(user.id);
        settingsStore.persist();
        authState = tokenExpired ? "expired" : "connected";
      } catch {
        // Token stored but invalid/expired — show as disconnected so user can re-enter
        authState = "disconnected";
      }
    } catch {
      authState = "disconnected";
    }
  }

  async function saveToken() {
    if (!tokenInput.trim()) return;
    errorMsg = "";
    loading = true;
    try {
      const user = await modioSetOauthToken(tokenInput.trim());
      userName = user.name;
      avatarUrl = user.avatar_url;
      settingsStore.modioUserName = user.name;
      settingsStore.modioUserId = String(user.id);
      settingsStore.persist();
      authState = "connected";
      tokenInput = "";
    } catch (e: unknown) {
      errorMsg = String(e);
    } finally {
      loading = false;
    }
  }

  async function disconnect() {
    try {
      await modioDisconnect();
    } catch { /* best-effort */ }
    authState = "disconnected";
    userName = "";
    avatarUrl = "";
    settingsStore.modioUserName = "";
    settingsStore.modioUserId = "";
    settingsStore.modioTokenExpiry = "";
    settingsStore.persist();
    showDisconnectConfirm = false;
  }
</script>

<div class="space-y-4">
  <!-- Step indicator -->
  <div class="flex items-center gap-1" role="list" aria-label="Authentication steps">
    {#each STEP_LABELS as stepLabel, idx}
      {@const stepNum = idx + 1}
      {@const isActive = currentStep >= stepNum}
      {@const isCurrent = currentStep === stepNum}
      <div class="flex items-center gap-1" role="listitem">
        <div
          class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors"
          class:bg-[var(--th-accent,#0ea5e9)]={isActive}
          class:border-[var(--th-accent,#0ea5e9)]={isActive}
          class:text-white={isActive}
          class:bg-transparent={!isActive}
          class:border-[var(--th-border-600)]={!isActive}
          class:text-[var(--th-text-500)]={!isActive}
          aria-current={isCurrent ? "step" : undefined}
        >
          {#if currentStep > stepNum}
            <Check size={10} />
          {:else}
            {stepNum}
          {/if}
        </div>
        <span
          class="text-[10px] font-medium"
          class:text-[var(--th-text-200)]={isActive}
          class:text-[var(--th-text-500)]={!isActive}
        >{stepLabel()}</span>
      </div>
      {#if idx < STEP_LABELS.length - 1}
        <div
          class="flex-1 h-px mx-1"
          class:bg-[var(--th-accent,#0ea5e9)]={currentStep > stepNum}
          class:bg-[var(--th-border-600)]={currentStep <= stepNum}
        ></div>
      {/if}
    {/each}
  </div>

  <!-- Error display -->
  {#if errorMsg}
    <div class="flex items-start gap-2 p-2 bg-red-900/20 border border-red-700/40 rounded text-xs text-red-300">
      <AlertCircle size={14} class="flex-shrink-0 mt-0.5" />
      <span>{errorMsg}</span>
    </div>
  {/if}

  <!-- State: Disconnected — Token entry -->
  {#if authState === "disconnected"}
    <div class="space-y-2">
      <p class="text-xs text-[var(--th-text-400)]">{m.modio_token_hint()}</p>
      <label class="text-xs font-medium text-[var(--th-text-300)] block" for="modio-token">
        {m.modio_token_label()}
      </label>
      <div class="flex gap-2">
        <input
          id="modio-token"
          type="password"
          class="flex-1 form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
          placeholder={m.modio_token_placeholder()}
          bind:value={tokenInput}
          autocomplete="off"
        />
        <button
          class="px-3 py-1.5 text-xs rounded bg-[var(--th-accent,#0ea5e9)] hover:brightness-110 text-white font-medium transition-colors disabled:opacity-40"
          disabled={!tokenInput.trim() || loading}
          onclick={saveToken}
        >{loading ? m.common_loading() : m.modio_connect_btn()}</button>
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
    </div>

  <!-- State: Connected -->
  {:else if authState === "connected" || authState === "expired"}
    <div class="space-y-3">
      <div class="flex items-center gap-3 p-3 bg-[var(--th-bg-850,var(--th-bg-800))] rounded border border-[var(--th-border-700)]">
        {#if avatarUrl}
          <img
            src={avatarUrl}
            alt=""
            class="w-8 h-8 rounded-full flex-shrink-0"
          />
        {:else}
          <div class="w-8 h-8 rounded-full bg-[var(--th-bg-700)] flex items-center justify-center flex-shrink-0">
            <User size={16} class="text-[var(--th-text-500)]" />
          </div>
        {/if}
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium text-[var(--th-text-200)] truncate">
            {m.modio_connected_as({ name: userName })}
          </p>
          {#if tokenWarning}
            <p class="text-[10px] text-amber-400">
              {m.modio_token_expiry_warning({ days: String(daysUntilExpiry) })}
            </p>
          {/if}
          {#if tokenExpired}
            <p class="text-[10px] text-red-400">
              {m.modio_token_expired()}
            </p>
          {/if}
        </div>
      </div>

      {#if showDisconnectConfirm}
        <div class="p-3 bg-red-900/20 border border-red-700/40 rounded space-y-2">
          <p class="text-xs text-red-300">{m.modio_disconnect_confirm()}</p>
          <div class="flex gap-2">
            <button
              class="px-3 py-1.5 text-xs rounded bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
              onclick={disconnect}
            >{m.modio_disconnect()}</button>
            <button
              class="px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-300)] transition-colors"
              onclick={() => showDisconnectConfirm = false}
            >{m.common_cancel()}</button>
          </div>
        </div>
      {:else}
        <button
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-300)] transition-colors"
          onclick={() => showDisconnectConfirm = true}
        >
          <LogOut size={12} />
          {m.modio_disconnect()}
        </button>
      {/if}
    </div>
  {/if}
</div>
