<!--
  ModioSettingsSection — mod.io configuration panel for the Publishing settings section.
  Connection status, inline auth panel, game ID override, default preferences.
-->
<script lang="ts">
  import { m } from "../../../paraglide/messages.js";
  import { modioStore } from "../../../lib/stores/modioStore.svelte.js";
  import ModioAuthPanel from "./ModioAuthPanel.svelte";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";

  let collapsed = $state(false);
  let showAuthPanel = $state(false);

  let connectionStatus = $derived.by(() => {
    if (modioStore.tokenExpiry) {
      const expiry = new Date(modioStore.tokenExpiry);
      if (expiry.getTime() <= Date.now()) return "expired";
    }
    if (modioStore.userName) return "connected";
    return "disconnected";
  });

  function statusLabel(): string {
    switch (connectionStatus) {
      case "disconnected": return m.modio_status_disconnected();
      case "connected": return m.modio_connected_as({ name: modioStore.userName });
      case "expired": return m.modio_status_expired();
      default: return "";
    }
  }

  function statusColor(): string {
    switch (connectionStatus) {
      case "connected": return "var(--th-success, #10b981)";
      case "expired": return "var(--th-error, #ef4444)";
      default: return "var(--th-text-500)";
    }
  }
</script>

<div class="space-y-4">
  <!-- Section header (collapsible) -->
  <button
    class="flex items-center gap-2 w-full text-left"
    onclick={() => collapsed = !collapsed}
    aria-expanded={!collapsed}
  >
    {#if collapsed}
      <ChevronRight size={14} class="text-[var(--th-text-400)]" />
    {:else}
      <ChevronDown size={14} class="text-[var(--th-text-400)]" />
    {/if}
    <h3 class="text-sm font-semibold text-[var(--th-text-200)]">{m.modioSettings()}</h3>
  </button>

  {#if !collapsed}
    <div class="space-y-4 pl-1">
      <!-- Connection Status -->
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <div
            class="w-2 h-2 rounded-full flex-shrink-0"
            style="background: {statusColor()}"
          ></div>
          <span class="text-xs" style="color: {statusColor()}">{statusLabel()}</span>
        </div>

        <button
          class="text-[10px] text-[var(--th-accent,#0ea5e9)] hover:underline"
          onclick={() => showAuthPanel = !showAuthPanel}
        >
          {m.modio_manage_connection()}
        </button>


      </div>

      <!-- Inline auth panel -->
      {#if showAuthPanel}
        <div class="p-3 bg-[var(--th-bg-850,var(--th-bg-800))] rounded border border-[var(--th-border-700)]">
          <ModioAuthPanel />
        </div>
      {/if}

      <!-- BG3 Game ID -->
      <div class="space-y-2">
        <label class="text-xs font-medium text-[var(--th-text-300)] block" for="modio-game-id">
          {m.modio_game_id_label()}
        </label>
        <input
          id="modio-game-id"
          type="text"
          class="w-full form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
          value={modioStore.gameId || "629"}
          onblur={(e) => {
            const v = (e.target as HTMLInputElement).value.trim();
            if (v !== modioStore.gameId) {
              modioStore.gameId = v;
            }
          }}
        />
        <p class="text-[10px] text-[var(--th-text-600)]">Default: 629 (Baldur's Gate 3)</p>
      </div>


    </div>
  {/if}
</div>
