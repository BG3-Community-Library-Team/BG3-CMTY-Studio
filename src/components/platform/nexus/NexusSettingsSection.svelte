<!--
  NexusSettingsSection — Nexus Mods configuration panel for the Publishing settings section.
  API key management, mod resolution, file group selection, and category settings.
-->
<script lang="ts">
  import { m } from "../../../paraglide/messages.js";
  import { settingsStore } from "../../../lib/stores/settingsStore.svelte.js";
  import { invoke } from "@tauri-apps/api/core";
  import Check from "@lucide/svelte/icons/check";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";

  type KeyStatus = "none" | "saved" | "valid" | "invalid" | "testing";

  let collapsed = $state(false);
  let apiKeyInput = $state("");
  let keyStatus: KeyStatus = $state("none");
  let modUrlInput = $state("");
  let resolving = $state(false);
  let resolveError = $state("");
  let fileGroups: Array<{ id: string; name: string; version_count: number; last_upload: string }> = $state([]);
  let loadingGroups = $state(false);

  // Check initial key status on mount
  $effect(() => {
    checkKeyStatus();
  });

  async function checkKeyStatus() {
    try {
      const hasKey = await invoke<boolean>("cmd_nexus_has_api_key");
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
      await invoke("cmd_nexus_set_api_key", { apiKey: apiKeyInput.trim() });
      keyStatus = "saved";
      apiKeyInput = "";
    } catch {
      keyStatus = "invalid";
    }
  }

  async function testApiKey() {
    keyStatus = "testing";
    try {
      const valid = await invoke<boolean>("cmd_nexus_validate_api_key");
      keyStatus = valid ? "valid" : "invalid";
    } catch {
      keyStatus = "invalid";
    }
  }

  async function clearApiKey() {
    try {
      await invoke("cmd_nexus_clear_api_key");
      keyStatus = "none";
      apiKeyInput = "";
    } catch { /* ignore */ }
  }

  async function resolveMod() {
    if (!modUrlInput.trim()) return;
    resolving = true;
    resolveError = "";
    try {
      const result = await invoke<{ game_scoped_id: number; uuid: string; name: string }>(
        "cmd_nexus_resolve_mod",
        { urlOrId: modUrlInput.trim() },
      );
      settingsStore.nexusModId = String(result.game_scoped_id);
      settingsStore.nexusModUuid = result.uuid;
      settingsStore.nexusModName = result.name;
      settingsStore.persist();
    } catch {
      resolveError = m.nexus_resolve_failed();
    } finally {
      resolving = false;
    }
  }

  async function refreshFileGroups() {
    if (!settingsStore.nexusModUuid) return;
    loadingGroups = true;
    try {
      fileGroups = await invoke<typeof fileGroups>(
        "cmd_nexus_get_file_groups",
        { modUuid: settingsStore.nexusModUuid },
      );
    } catch {
      fileGroups = [];
    } finally {
      loadingGroups = false;
    }
  }

  function statusLabel(): string {
    switch (keyStatus) {
      case "none": return m.apiKeyStatusNotConfigured();
      case "saved": return m.apiKeyStatusSaved();
      case "valid": return m.apiKeyStatusValid();
      case "invalid": return m.apiKeyStatusInvalid();
      case "testing": return m.common_loading();
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
    <h3 class="text-sm font-semibold text-[var(--th-text-200)]">{m.nexusSettings()}</h3>
  </button>

  {#if !collapsed}
    <div class="space-y-4 pl-1">
      <!-- API Key -->
      <div class="space-y-2">
        <label class="text-xs font-medium text-[var(--th-text-300)] block" for="nexus-api-key">
          {m.apiKeyLabel()}
        </label>
        <div class="flex items-center gap-1.5">
          <div
            class="w-2 h-2 rounded-full flex-shrink-0"
            style="background: {statusColor()}"
          ></div>
          <span class="text-[10px]" style="color: {statusColor()}">{statusLabel()}</span>
          {#if keyStatus === "valid"}
            <Check size={12} class="text-[var(--th-success,#10b981)]" />
          {:else if keyStatus === "invalid"}
            <AlertCircle size={12} class="text-[var(--th-error,#ef4444)]" />
          {/if}
        </div>

        {#if keyStatus === "none"}
          <div class="flex gap-2">
            <input
              id="nexus-api-key"
              type="password"
              class="flex-1 form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
              placeholder={m.apiKeyPlaceholder()}
              bind:value={apiKeyInput}
              autocomplete="off"
            />
            <button
              class="px-3 py-1.5 text-xs rounded bg-[var(--th-accent,#0ea5e9)] hover:brightness-110 text-white font-medium transition-colors disabled:opacity-40"
              disabled={!apiKeyInput.trim()}
              onclick={saveApiKey}
            >{m.saveApiKey()}</button>
          </div>
          <a
            href="https://next.nexusmods.com/settings/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-[10px] text-[var(--th-accent,#0ea5e9)] hover:underline"
          >
            {m.nexus_get_api_key_link()}
            <ExternalLink size={10} />
          </a>
        {:else}
          <div class="flex gap-2">
            <button
              class="px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-300)] transition-colors disabled:opacity-40"
              disabled={keyStatus === "testing"}
              onclick={testApiKey}
            >{m.testApiKey()}</button>
            <button
              class="px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-300)] transition-colors"
              onclick={clearApiKey}
            >{m.clearApiKey()}</button>
          </div>
        {/if}
      </div>

      <!-- Mod URL Resolution -->
      <div class="space-y-2">
        <label class="text-xs font-medium text-[var(--th-text-300)] block" for="nexus-mod-url">
          {m.nexus_mod_url_label()}
        </label>
        <div class="flex gap-2">
          <input
            id="nexus-mod-url"
            type="text"
            class="flex-1 form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
            placeholder={m.nexus_mod_url_placeholder()}
            bind:value={modUrlInput}
            autocomplete="off"
          />
          <button
            class="px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-300)] transition-colors disabled:opacity-40"
            disabled={!modUrlInput.trim() || resolving}
            onclick={resolveMod}
          >{resolving ? m.common_loading() : m.nexus_resolve_mod()}</button>
        </div>
        {#if settingsStore.nexusModName}
          <p class="text-[10px] text-emerald-400">
            {m.nexus_resolved_mod({ name: settingsStore.nexusModName })}
          </p>
        {/if}
        {#if resolveError}
          <p class="text-[10px] text-red-400">{resolveError}</p>
        {/if}
      </div>

      <!-- File Update Group -->
      {#if settingsStore.nexusModUuid}
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <label class="text-xs font-medium text-[var(--th-text-300)]" for="nexus-file-group">
              {m.nexus_file_group_label()}
            </label>
            <button
              class="p-1 rounded hover:bg-[var(--th-bg-600)] text-[var(--th-text-500)] transition-colors"
              onclick={refreshFileGroups}
              aria-label={m.nexus_file_group_refresh()}
              disabled={loadingGroups}
            >
              <RefreshCw size={12} class={loadingGroups ? "upload-spin" : ""} />
            </button>
          </div>
          <select
            id="nexus-file-group"
            class="w-full form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
            value={settingsStore.nexusDefaultFileGroup}
            onchange={(e) => {
              settingsStore.nexusDefaultFileGroup = (e.target as HTMLSelectElement).value;
              settingsStore.persist();
            }}
          >
            <option value="">{m.nexus_file_group_placeholder()}</option>
            {#each fileGroups as group}
              <option value={group.id}>
                {group.name} ({group.version_count} versions)
              </option>
            {/each}
          </select>
        </div>
      {/if}

      <!-- Default Category -->
      <div class="space-y-2">
        <label class="text-xs font-medium text-[var(--th-text-300)] block" for="nexus-category">
          {m.nexus_category_label()}
        </label>
        <select
          id="nexus-category"
          class="w-full form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
          value={settingsStore.nexusDefaultCategory}
          onchange={(e) => {
            settingsStore.nexusDefaultCategory = (e.target as HTMLSelectElement).value;
            settingsStore.persist();
          }}
        >
          <option value="">Main</option>
          <option value="update">Update</option>
          <option value="optional">Optional</option>
          <option value="old_version">Old Version</option>
          <option value="miscellaneous">Miscellaneous</option>
        </select>
      </div>

      <!-- Game Domain -->
      <div class="space-y-2">
        <label class="text-xs font-medium text-[var(--th-text-300)] block" for="nexus-game-domain">
          {m.nexus_game_domain_label()}
        </label>
        <input
          id="nexus-game-domain"
          type="text"
          class="w-full form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
          value={settingsStore.nexusGameDomain}
          onblur={(e) => {
            const v = (e.target as HTMLInputElement).value.trim();
            if (v && v !== settingsStore.nexusGameDomain) {
              settingsStore.nexusGameDomain = v;
              settingsStore.persist();
            }
          }}
        />
      </div>
    </div>
  {/if}
</div>
