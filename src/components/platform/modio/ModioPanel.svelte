<!-- ModioPanel — Sidebar pane for mod.io mod management. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { m } from "../../../paraglide/messages.js";
  import { modioStore } from "../../../lib/stores/modioStore.svelte.js";
  import { platformUploadStore } from "../../../lib/stores/platformUploadStore.svelte.js";
  import { toastStore } from "../../../lib/stores/toastStore.svelte.js";
  import { open as shellOpen } from "@tauri-apps/plugin-shell";
  import { getPrefersReducedMotion } from "../../../lib/stores/motion.svelte.js";
  import { modioPackageAndUpload } from "../../../lib/tauri/modio.js";
  import { modStore } from "../../../lib/stores/modStore.svelte.js";
  import { localizeError, type AppError } from "../../../lib/errorLocalization.js";

  // Icons — always use direct imports
  import Settings from "@lucide/svelte/icons/settings";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Upload from "@lucide/svelte/icons/upload";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import Plus from "@lucide/svelte/icons/plus";
  import Check from "@lucide/svelte/icons/check";
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import Download from "@lucide/svelte/icons/download";
  import Users from "@lucide/svelte/icons/users";
  import UnlinkIcon from "@lucide/svelte/icons/unlink";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";

  // Section components (stubs for now, replaced by other agents)
  import ModioFileVersions from "./ModioFileVersions.svelte";
  import ModioModDetails from "./ModioModDetails.svelte";
  import ModioMediaSection from "./ModioMediaSection.svelte";
  import ModioTagSection from "./ModioTagSection.svelte";
  import ModioDependencies from "./ModioDependencies.svelte";
  import CreateModDialog from "./CreateModDialog.svelte";
  import UploadProgressModal from "../UploadProgressModal.svelte";

  // ── Upload form state ──
  let uploadVersion = $state("");
  let uploadChangelog = $state("");
  let uploadActive = $state(true);
  let showUploadForm = $state(true);

  // ── UI state ──
  let showCreateDialog = $state(false);
  let showUploadModal = $state(false);
  let focusedModIndex = $state(-1);
  let isRefreshing = $state(false);
  let lastRefreshAt = 0;
  const REFRESH_COOLDOWN_MS = 30_000;

  // ── Collapsible sections ──
  let sectionsExpanded: Record<string, boolean> = $state({
    fileVersions: false,
    modDetails: false,
    media: false,
    tags: false,
    dependencies: false,
  });

  // ── Derived ──
  let canUpload = $derived(
    modioStore.isAuthenticated &&
    modioStore.selectedModId != null &&
    uploadVersion.trim() !== "" &&
    !platformUploadStore.isUploading
  );

  function formatStatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  function formatFullNumber(n: number): string {
    return n.toLocaleString();
  }

  // ── Actions ──
  async function handleRefresh() {
    const now = Date.now();
    if (now - lastRefreshAt < REFRESH_COOLDOWN_MS) {
      const remaining = Math.ceil((REFRESH_COOLDOWN_MS - (now - lastRefreshAt)) / 1000);
      toastStore.error(`Rate limited — try again in ${remaining}s`);
      return;
    }
    isRefreshing = true;
    lastRefreshAt = Date.now();
    try {
      await modioStore.loadUserMods();
    } finally {
      isRefreshing = false;
    }
  }

  async function openModPage() {
    const url = modioStore.selectedModUrl;
    if (!url) return;
    try {
      await shellOpen(url);
    } catch {
      window.open(url, "_blank");
    }
  }

  function handleUnlink() {
    modioStore.selectedModId = null;
    modioStore.selectedModName = null;
    modioStore.selectedModNameId = null;
    modioStore.selectedModUrl = null;
    modioStore.saveProjectConfig();
  }

  function navigateToSettings() {
    // Settings gear: navigate to mod.io settings subpanel
    // Dispatched via the sidebar navigation system
    const event = new CustomEvent("navigate-settings", { detail: "modio", bubbles: true });
    document.dispatchEvent(event);
  }

  function handleModListKeydown(e: KeyboardEvent) {
    const mods = modioStore.userMods;
    if (!mods.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusedModIndex = Math.min(focusedModIndex + 1, mods.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusedModIndex = Math.max(focusedModIndex - 1, 0);
    } else if (e.key === "Enter" && focusedModIndex >= 0 && focusedModIndex < mods.length) {
      e.preventDefault();
      modioStore.selectMod(mods[focusedModIndex]);
    }
  }

  function toggleSection(key: string) {
    sectionsExpanded[key] = !sectionsExpanded[key];
  }

  async function handleUpload() {
    if (!canUpload || !modioStore.selectedModId) return;

    // Reset upload store for fresh progress tracking
    platformUploadStore.reset();
    showUploadModal = true;

    try {
      await modioPackageAndUpload({
        source_dir: modStore.selectedModPath!,
        mod_id: modioStore.selectedModId,
        version: uploadVersion.trim(),
        changelog: uploadChangelog.trim() || undefined,
        active: uploadActive,
      });

      toastStore.success(
        m.modio_upload_success_title(),
        m.modio_upload_success_message({ version: uploadVersion.trim(), modName: modioStore.selectedModName ?? "" })
      );

      // Reset form
      uploadVersion = "";
      uploadChangelog = "";
      uploadActive = true;

    } catch (e) {
      const error = e as { message?: string; status?: number };

      if (error.status === 401) {
        modioStore.isAuthenticated = false;
        toastStore.error(m.modio_error_session_expired());
      } else if (error.status === 429) {
        toastStore.error(m.modio_error_rate_limited({ seconds: "60" }));
      } else {
        const msg = localizeError(e as AppError);
        toastStore.error(m.modio_error_upload_failed(), msg);
      }
    }
  }

  // Find the selected mod in the user mods list for stats display
  let selectedModData = $derived.by(() => {
    if (!modioStore.selectedModId) return null;
    return modioStore.userMods.find(mod => mod.id === modioStore.selectedModId) ?? null;
  });

  onMount(async () => {
    if (modioStore.isAuthenticated) {
      await modioStore.loadUserMods();
    }
  });
</script>

<div class="flex h-full flex-col bg-[var(--th-sidebar-bg,var(--th-bg-900))]">
  <!-- Header bar -->
  <div class="flex items-center gap-1 border-b border-[var(--th-border-700)] px-3 py-2 shrink-0">
    <h2 class="flex-1 truncate text-xs font-semibold text-[var(--th-text-200)]">
      {m.modio_settings_header()}
    </h2>

    {#if modioStore.selectedModId}
      <!-- Refresh button (rate-limited) -->
      <button
        type="button"
        class="rounded p-1 text-[var(--th-text-500)] hover:bg-[var(--th-bg-800)] hover:text-[var(--th-text-200)] disabled:opacity-40"
        onclick={handleRefresh}
        disabled={isRefreshing}
        aria-label={m.modio_refresh()}
        title={m.modio_refresh()}
      >
        <RefreshCw size={14} class={isRefreshing && !getPrefersReducedMotion() ? "animate-spin" : ""} />
      </button>

      <!-- External link to mod profile -->
      {#if modioStore.selectedModUrl}
        <button
          type="button"
          class="rounded p-1 text-[var(--th-text-500)] hover:bg-[var(--th-bg-800)] hover:text-[var(--th-text-200)]"
          onclick={openModPage}
          aria-label={m.modio_view_on_modio()}
          title={m.modio_view_on_modio()}
        >
          <ExternalLink size={14} />
        </button>
      {/if}

      <!-- Unlink button -->
      <button
        type="button"
        class="rounded p-1 text-[var(--th-text-500)] hover:bg-[var(--th-bg-800)] hover:text-red-400"
        onclick={handleUnlink}
        aria-label="Unlink mod"
        title="Unlink mod"
      >
        <UnlinkIcon size={14} />
      </button>
    {/if}

    <!-- Settings gear — always visible -->
    <button
      type="button"
      class="rounded p-1 text-[var(--th-text-500)] hover:bg-[var(--th-bg-800)] hover:text-[var(--th-text-200)]"
      onclick={navigateToSettings}
      aria-label={m.modio_settings_gear()}
      title={m.modio_settings_gear()}
    >
      <Settings size={14} />
    </button>
  </div>

  {#if modioStore.selectedModId}
    <!-- ── Linked state ─────────────────────────────────────────── -->
    <div class="flex-1 overflow-y-auto">
      <!-- Mod info header -->
      <div class="border-b border-[var(--th-border-700)] px-3 py-3">
        <!-- Mod name -->
        <h3 class="text-xs font-semibold text-[var(--th-text-200)] truncate">
          {modioStore.selectedModName ?? "Unknown Mod"}
        </h3>

        <!-- Badges row -->
        <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
          <!-- Status badge -->
          {#if selectedModData}
            {#if selectedModData.status === 1}
              <span
                class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                style="background: color-mix(in srgb, var(--th-success, #10b981) 15%, transparent); color: var(--th-success, #10b981);"
              >
                <Check size={10} aria-hidden="true" />
                {m.modio_mod_status_accepted()}
              </span>
            {:else}
              <span
                class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                style="background: color-mix(in srgb, var(--th-warning, #f59e0b) 15%, transparent); color: var(--th-warning, #f59e0b);"
              >
                <Loader2 size={10} aria-hidden="true" />
                {m.modio_mod_status_pending()}
              </span>
            {/if}

            <!-- Visibility badge -->
            {#if selectedModData.visibility === 1}
              <span
                class="inline-flex items-center gap-1 rounded-full bg-[var(--th-bg-700)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--th-text-400)]"
              >
                <Eye size={10} aria-hidden="true" />
                {m.modio_mod_visibility_public()}
              </span>
            {:else}
              <span
                class="inline-flex items-center gap-1 rounded-full bg-[var(--th-bg-700)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--th-text-500)]"
              >
                <EyeOff size={10} aria-hidden="true" />
                {m.modio_mod_visibility_hidden()}
              </span>
            {/if}
          {/if}
        </div>

        <!-- Quick stats -->
        {#if selectedModData?.stats}
          <div class="mt-2 flex items-center gap-3">
            <span
              class="inline-flex items-center gap-1 text-[10px] text-[var(--th-text-400)]"
              aria-label="{formatFullNumber(selectedModData.stats.downloads_total)} downloads"
            >
              <Download size={11} aria-hidden="true" />
              {formatStatNumber(selectedModData.stats.downloads_total)}
              <span class="text-[var(--th-text-500)]">{m.modio_dashboard_downloads()}</span>
            </span>
            <span
              class="inline-flex items-center gap-1 text-[10px] text-[var(--th-text-400)]"
              aria-label="{formatFullNumber(selectedModData.stats.subscribers_total)} subscribers"
            >
              <Users size={11} aria-hidden="true" />
              {formatStatNumber(selectedModData.stats.subscribers_total)}
              <span class="text-[var(--th-text-500)]">{m.modio_dashboard_subscribers()}</span>
            </span>
          </div>
        {/if}
      </div>

      <!-- Upload form (collapsible) -->
      <div class="border-b border-[var(--th-border-700)]">
        <button
          type="button"
          class="flex w-full items-center gap-1.5 px-3 py-2 text-[10px] font-medium text-[var(--th-text-300)] hover:bg-[var(--th-bg-800)]"
          onclick={() => { showUploadForm = !showUploadForm; }}
          aria-expanded={showUploadForm}
        >
          {#if showUploadForm}
            <ChevronDown size={12} aria-hidden="true" />
          {:else}
            <ChevronRight size={12} aria-hidden="true" />
          {/if}
          <Upload size={12} aria-hidden="true" />
          {m.modio_upload_button()}
        </button>

        {#if showUploadForm}
          <div class="flex flex-col gap-2 px-3 pb-3">
            <!-- Version input -->
            <div>
              <label for="modio-upload-version" class="mb-0.5 block text-[10px] font-medium text-[var(--th-text-500)]">
                {m.modio_upload_version_label()}
              </label>
              <input
                id="modio-upload-version"
                type="text"
                class="w-full rounded border border-[var(--th-input-border,var(--th-bg-700))] bg-[var(--th-input-bg,var(--th-bg-800))] px-2 py-1 text-xs text-[var(--th-text-200)] placeholder:text-[var(--th-text-500)] focus:border-[var(--th-accent,#0ea5e9)] focus:outline-none"
                placeholder={m.modio_upload_version_placeholder()}
                bind:value={uploadVersion}
                required
              />
            </div>

            <!-- Changelog textarea -->
            <div>
              <label for="modio-upload-changelog" class="mb-0.5 block text-[10px] font-medium text-[var(--th-text-500)]">
                {m.modio_upload_changelog_label()}
              </label>
              <textarea
                id="modio-upload-changelog"
                class="w-full resize-none rounded border border-[var(--th-input-border,var(--th-bg-700))] bg-[var(--th-input-bg,var(--th-bg-800))] px-2 py-1 text-xs text-[var(--th-text-200)] placeholder:text-[var(--th-text-500)] focus:border-[var(--th-accent,#0ea5e9)] focus:outline-none"
                placeholder={m.modio_upload_changelog_placeholder()}
                rows={3}
                bind:value={uploadChangelog}
              ></textarea>
            </div>

            <!-- Active checkbox -->
            <label class="flex items-center gap-2 text-xs text-[var(--th-text-300)] cursor-pointer">
              <input
                type="checkbox"
                class="accent-[var(--th-accent,#0ea5e9)]"
                bind:checked={uploadActive}
              />
              {m.modio_upload_active_label()}
            </label>

            <!-- Upload button -->
            <button
              type="button"
              class="flex items-center justify-center gap-1.5 rounded bg-[var(--th-accent,#0ea5e9)] px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 disabled:opacity-50"
              onclick={handleUpload}
              disabled={!canUpload}
            >
              {#if platformUploadStore.isUploading}
                <Loader2 size={14} class={getPrefersReducedMotion() ? "" : "animate-spin"} aria-hidden="true" />
              {:else}
                <Upload size={14} aria-hidden="true" />
              {/if}
              {m.modio_upload_button()}
            </button>
          </div>
        {/if}
      </div>

      <!-- Collapsible sections -->
      {#each [
        { key: "fileVersions", label: m.modio_file_versions_header(), component: "fileVersions" },
        { key: "modDetails", label: m.modio_mod_details_header(), component: "modDetails" },
        { key: "media", label: m.modio_media_header(), component: "media" },
        { key: "tags", label: m.modio_tags_header(), component: "tags" },
        { key: "dependencies", label: m.modio_dependencies_header(), component: "dependencies" },
      ] as section (section.key)}
        <div class="border-b border-[var(--th-border-700)]">
          <button
            type="button"
            class="flex w-full items-center gap-1.5 px-3 py-2 text-[10px] font-medium text-[var(--th-text-300)] hover:bg-[var(--th-bg-800)]"
            onclick={() => toggleSection(section.key)}
            aria-expanded={sectionsExpanded[section.key]}
          >
            {#if sectionsExpanded[section.key]}
              <ChevronDown size={12} aria-hidden="true" />
            {:else}
              <ChevronRight size={12} aria-hidden="true" />
            {/if}
            {section.label}
          </button>
          {#if sectionsExpanded[section.key]}
            {#if section.component === "fileVersions"}
              <ModioFileVersions modId={modioStore.selectedModId} gameId={modioStore.GAME_ID} />
            {:else if section.component === "modDetails"}
              <ModioModDetails modId={modioStore.selectedModId} gameId={modioStore.GAME_ID} />
            {:else if section.component === "media"}
              <ModioMediaSection modId={modioStore.selectedModId} gameId={modioStore.GAME_ID} />
            {:else if section.component === "tags"}
              <ModioTagSection modId={modioStore.selectedModId} gameId={modioStore.GAME_ID} />
            {:else if section.component === "dependencies"}
              <ModioDependencies modId={modioStore.selectedModId} gameId={modioStore.GAME_ID} />
            {/if}
          {/if}
        </div>
      {/each}
    </div>

    {#if showUploadModal}
      <UploadProgressModal onclose={() => { showUploadModal = false; }} />
    {/if}
  {:else}
    <!-- ── Unlinked state ───────────────────────────────────────── -->
    <div class="flex-1 overflow-y-auto">
      <div class="flex flex-col gap-3 p-4">
        <!-- Header message -->
        <div class="text-center">
          <p class="text-sm font-medium text-[var(--th-text-300)]">
            {m.modio_no_mod_selected()}
          </p>
          <p class="mt-1 text-xs text-[var(--th-text-500)]">
            {m.modio_select_mod_cta()}
          </p>
        </div>

        <!-- Create New Mod button -->
        <button
          type="button"
          class="flex items-center justify-center gap-1.5 rounded border border-[var(--th-border-600)] bg-[var(--th-bg-800)] px-3 py-1.5 text-xs font-medium text-[var(--th-text-300)] hover:bg-[var(--th-bg-700)]"
          onclick={() => { showCreateDialog = true; }}
        >
          <Plus size={14} aria-hidden="true" />
          {m.modio_create_mod()}
        </button>

        <!-- Mod list -->
        {#if modioStore.isLoadingMods}
          <div class="flex items-center justify-center gap-2 py-4 text-xs text-[var(--th-text-500)]">
            <Loader2 size={14} class={getPrefersReducedMotion() ? "" : "animate-spin"} aria-hidden="true" />
            {m.modio_dashboard_loading()}
          </div>
        {:else if modioStore.userMods.length === 0}
          <p class="py-4 text-center text-xs text-[var(--th-text-500)]">
            {m.modio_dashboard_empty()}
          </p>
        {:else}
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <ul
            class="flex flex-col gap-0.5"
            role="listbox"
            aria-label={m.modio_select_mod()}
            onkeydown={handleModListKeydown}
          >
            {#each modioStore.userMods as mod, i (mod.id)}
              <li
                class="group flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-[var(--th-bg-800)] cursor-pointer"
                class:bg-[var(--th-bg-800)]={focusedModIndex === i}
                role="option"
                aria-selected={focusedModIndex === i}
                tabindex={i === 0 ? 0 : -1}
                onclick={() => modioStore.selectMod(mod)}
                onkeydown={(e: KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    modioStore.selectMod(mod);
                  }
                }}
                onfocus={() => { focusedModIndex = i; }}
              >
                <span class="truncate text-[var(--th-text-300)]">{mod.name}</span>
                <button
                  type="button"
                  class="shrink-0 rounded bg-[var(--th-accent,#0ea5e9)] px-2 py-0.5 text-[10px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity hover:brightness-110"
                  onclick={(e: MouseEvent) => { e.stopPropagation(); modioStore.selectMod(mod); }}
                  tabindex={-1}
                >
                  {m.modio_select_mod()}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>

    {#if showCreateDialog}
      <CreateModDialog
        onclose={() => { showCreateDialog = false; }}
        oncreated={async (mod) => {
          showCreateDialog = false;
          modioStore.selectMod(mod);
          await modioStore.loadUserMods();
        }}
      />
    {/if}
  {/if}
</div>
