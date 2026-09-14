<!--
  CredentialStoreNotice — explains how to enable OS credential storage when the
  keyring / Secret Service can't be used. Shows the provider name while it works.
-->
<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { getCredentialBackendStatus, type CredentialBackendStatus } from "../../lib/tauri/secure-storage.js";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";

  let {
    refreshKey = 0,
    compact = false,
  }: {
    /** Change to re-check, e.g. after a call failed with CredentialStoreUnavailable. */
    refreshKey?: number;
    /** One-line variant for popovers. */
    compact?: boolean;
  } = $props();

  let status: CredentialBackendStatus | null = $state(null);
  let checking = $state(false);

  async function check(): Promise<void> {
    checking = true;
    try {
      status = await getCredentialBackendStatus();
    } catch (e) {
      console.warn("Credential store status check failed:", e);
      status = null;
    } finally {
      checking = false;
    }
  }

  $effect(() => {
    void refreshKey;
    check();
  });
</script>

{#if status && !status.available}
  <div class="rounded border border-amber-700/40 bg-amber-900/20 px-2.5 py-2 text-xs text-amber-200 space-y-1.5" role="alert">
    <div class="flex items-start gap-2">
      <AlertTriangle size={14} class="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
      <p class="font-medium flex-1">{m.credentials_unavailable_title()}</p>
      <button
        class="text-amber-400 hover:text-amber-200 shrink-0 disabled:opacity-50"
        onclick={check}
        disabled={checking}
        title={m.credentials_unavailable_retry()}
        aria-label={m.credentials_unavailable_retry()}
      >
        <RefreshCw size={12} class={checking ? "animate-spin" : ""} />
      </button>
    </div>
    {#if compact}
      <p class="text-amber-300/90">{m.credentials_unavailable_compact()}</p>
    {:else}
      <p class="text-amber-300/90">{m.credentials_unavailable_desc()}</p>
      <ul class="list-disc list-inside space-y-0.5 text-amber-300/90">
        <li>{m.credentials_unavailable_gnome()}</li>
        <li>{m.credentials_unavailable_kwallet()}</li>
        <li>{m.credentials_unavailable_keepassxc()}</li>
        <li>{m.credentials_unavailable_other()}</li>
      </ul>
      {#if status.provider}
        <p class="text-amber-400/80">{m.credentials_unavailable_provider({ provider: status.provider })}</p>
      {/if}
      {#if status.reason}
        <p class="text-[10px] text-amber-400/70 break-words">{m.credentials_unavailable_reason({ reason: status.reason })}</p>
      {/if}
    {/if}
  </div>
{:else if status?.provider && !compact}
  <p class="text-[10px] text-[var(--th-text-500)]">{m.credentials_stored_with({ provider: status.provider })}</p>
{/if}
