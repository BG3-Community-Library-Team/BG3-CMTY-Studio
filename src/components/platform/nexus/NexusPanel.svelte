<!-- NexusPanel — Sidebar pane for Nexus mod management. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { m } from "../../../paraglide/messages.js";
  import { nexusStore } from "../../../lib/stores/nexusStore.svelte.js";
  import { open as shellOpen } from "@tauri-apps/plugin-shell";
  import Globe from "@lucide/svelte/icons/globe";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import Upload from "@lucide/svelte/icons/upload";
  import X from "@lucide/svelte/icons/x";
  import LogOut from "@lucide/svelte/icons/log-out";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import File from "@lucide/svelte/icons/file";
  import Plus from "@lucide/svelte/icons/plus";
  import { platformUploadStore } from "../../../lib/stores/platformUploadStore.svelte.js";
  import { toastStore } from "../../../lib/stores/toastStore.svelte.js";
  import { modStore } from "../../../lib/stores/modStore.svelte.js";
  import { localizeError, type AppError } from "../../../lib/errorLocalization.js";
  import { getPrefersReducedMotion } from "../../../lib/stores/motion.svelte.js";
  import { nexusPackageAndUpload, nexusUploadFile, nexusSetApiKey, nexusSetFileDependencies, nexusGetFileVersions, nexusGetAllModFiles, nexusResolveMod } from "../../../lib/tauri/nexus.js";
  import type { NexusFileVersion } from "../../../lib/tauri/nexus.js";
  import { open as dialogOpen } from "@tauri-apps/plugin-dialog";
  import UploadProgressModal from "../UploadProgressModal.svelte";
  import NexusFileHistory from "./NexusFileHistory.svelte";
  import NexusDependencies from "./NexusDependencies.svelte";
  import NexusChangelog from "./NexusChangelog.svelte";
  import { dependencyStore } from "../../../lib/stores/dependencyStore.svelte.js";
  import ExplorerDrawer from "../../ExplorerDrawer.svelte";
  import { uiStore } from "../../../lib/stores/uiStore.svelte.js";

  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Settings from "@lucide/svelte/icons/settings";

  let linkInput = $state("");
  let isLinking = $state(false);
  let linkError: string | null = $state(null);

  // ── UI state ──
  let summaryExpanded = $state(false);
  let summaryEl: HTMLParagraphElement | null = $state(null);
  let summaryTruncated = $state(false);
  let showUploadForm = $state(false);
  let showDepAddForm = $state(false);
  let nexusFileCount = $state(0);
  let showSettingsDropdown = $state(false);
  let settingsBtnEl: HTMLButtonElement | null = $state(null);
  let settingsDropdownEl: HTMLDivElement | null = $state(null);

  // ── Drawer visibility & pinning (matches Git pane pattern) ──
  const allNexusDrawerIds = ["nexus-file-history", "nexus-changelog"];
  const nexusDrawerTitles: Record<string, string> = $derived({
    "nexus-file-history": m.nexus_file_history_header(),
    "nexus-changelog": m.nexus_changelog_header(),
  });
  let visibleDrawerIds = $derived.by(() => {
    const visible = allNexusDrawerIds.filter(id => !uiStore.isDrawerHidden(id));
    const pinned = visible.filter(id => uiStore.isDrawerPinned(id));
    const unpinned = visible.filter(id => !uiStore.isDrawerPinned(id));
    return [...pinned, ...unpinned];
  });

  // Detect if summary text is actually truncated by line-clamp
  $effect(() => {
    if (summaryEl && !summaryExpanded) {
      summaryTruncated = summaryEl.scrollHeight > summaryEl.clientHeight;
    }
  });

  // ── Refresh rate-limiting ──
  let lastRefreshAt = 0;
  let isRefreshing = $state(false);
  const REFRESH_COOLDOWN_MS = 30_000;

  // ── Connection popover state ──
  let showConnectionPopover = $state(false);
  let connectionApiKeyInput = $state("");
  let connectionPopoverEl: HTMLDivElement | null = $state(null);
  let connectionBtnEl: HTMLButtonElement | null = $state(null);
  let popoverPos = $state({ top: 0, right: 0 });

  let connectionDotColor = $derived(
    nexusStore.isValidating ? "var(--th-warning, #f59e0b)" :
    nexusStore.apiKeyValid ? "var(--th-success, #10b981)" :
    "var(--th-text-600, #6b7280)"
  );

  function toggleConnectionPopover() {
    showConnectionPopover = !showConnectionPopover;
    if (showConnectionPopover) {
      connectionApiKeyInput = "";
      if (connectionBtnEl) {
        const rect = connectionBtnEl.getBoundingClientRect();
        popoverPos = { top: rect.bottom + 4, right: window.innerWidth - rect.right };
      }
    }
  }

  function handlePopoverClickOutside(e: MouseEvent) {
    if (connectionPopoverEl && !connectionPopoverEl.contains(e.target as Node)) {
      showConnectionPopover = false;
    }
  }

  $effect(() => {
    if (showConnectionPopover) {
      document.addEventListener("click", handlePopoverClickOutside, true);
      return () => document.removeEventListener("click", handlePopoverClickOutside, true);
    }
  });

  async function popoverSaveKey() {
    if (!connectionApiKeyInput.trim()) return;
    try {
      await nexusSetApiKey(connectionApiKeyInput.trim());
      connectionApiKeyInput = "";
      await nexusStore.checkApiKey();
    } catch {
      // handled by store
    }
  }

  async function popoverTestKey() {
    await nexusStore.validateApiKey();
  }

  async function popoverClearKey() {
    await nexusStore.clearApiKey();
  }

  const NEXUS_URL_PREFIX = "https://www.nexusmods.com/";

  onMount(async () => {
    // Restore API key validity from OS keyring
    await nexusStore.checkApiKey();

    if (modStore.selectedModPath) {
      dependencyStore.loadDependencies(modStore.selectedModPath);
    }
    // Auto-refresh mod data if stale (>24 h), missing enrichment fields,
    // or has a legacy numeric modUuid that needs v3 resolution.
    await nexusStore.refreshIfStale();

    if (nexusStore.modUuid && nexusStore.fileGroups.length === 0) {
      nexusStore.loadFileGroups();
    }
  });

  // Auto-resolve: if modUrl is set (e.g. from meta.lsx) but mod isn't linked, resolve it
  $effect(() => {
    const url = nexusStore.modUrl;
    if (url && !nexusStore.modUuid && !isLinking) {
      const match = url.match(/\/mods\/(\d+)/);
      if (match) {
        nexusStore.resolveMod(match[1]).then(() => {
          if (nexusStore.modUuid) {
            nexusStore.saveProjectConfig();
            nexusStore.loadFileGroups();
          }
        });
      }
    }
  });

  async function handleRefresh() {
    const now = Date.now();
    if (now - lastRefreshAt < REFRESH_COOLDOWN_MS) {
      const remaining = Math.ceil((REFRESH_COOLDOWN_MS - (now - lastRefreshAt)) / 1000);
      toastStore.error(m.nexus_error_rate_limited({ seconds: String(remaining) }));
      return;
    }
    isRefreshing = true;
    lastRefreshAt = Date.now();
    try {
      if (nexusStore.modId) {
        await nexusStore.resolveMod(nexusStore.modId);
        nexusStore.saveProjectConfig();
      }
      await nexusStore.loadFileGroups();
    } finally {
      isRefreshing = false;
    }
  }

  async function openModPage() {
    const url = nexusStore.modUrl;
    if (!url || !url.startsWith(NEXUS_URL_PREFIX)) return;
    try {
      await shellOpen(url);
    } catch {
      window.open(url, "_blank");
    }
  }

  async function handleLinkMod() {
    const raw = linkInput.trim();
    if (!raw) return;

    // Basic pattern: URL, numeric ID, or path fragment with digits
    if (!/^(\d+|https?:\/\/.+|.*\/mods\/\d+.*)$/.test(raw)) {
      linkError = m.nexus_error_invalid_input();
      return;
    }

    isLinking = true;
    linkError = null;
    try {
      await nexusStore.resolveMod(raw);
      if (nexusStore.connectionError) {
        linkError = nexusStore.connectionError;
        nexusStore.connectionError = null;
        return;
      }
      // Build canonical URL from resolved data
      if (nexusStore.modId) {
        nexusStore.modUrl = `${NEXUS_URL_PREFIX}${nexusStore.gameDomain}/mods/${nexusStore.modId}`;
      }
      nexusStore.saveProjectConfig();
      await nexusStore.loadFileGroups();
      linkInput = "";
    } catch (e) {
      linkError = e instanceof Error ? e.message : String(e);
    } finally {
      isLinking = false;
    }
  }

  let uploadVersion = $state(modStore.scanResult?.mod_meta?.version ?? "");
  let uploadName = $state(nexusStore.modName ?? "");
  let uploadCategory = $state(nexusStore.category ?? "main");
  let uploadDescription = $state("");
  let showUploadModal = $state(false);
  let uploadButtonRef: HTMLButtonElement | null = $state(null);
  let showPublishDropdown = $state(false);

  // ── Upload requirements ──
  let uploadRequirements: Array<{ modId: string; name: string }> = $state([]);
  let requirementInput = $state("");
  let isResolvingRequirement = $state(false);
  let requirementError: string | null = $state(null);

  async function addRequirement() {
    const raw = requirementInput.trim();
    if (!raw) return;
    isResolvingRequirement = true;
    requirementError = null;
    try {
      const details = await nexusResolveMod(raw);
      const modId = String(details.game_scoped_id);
      if (!uploadRequirements.some(r => r.modId === modId)) {
        uploadRequirements = [...uploadRequirements, { modId, name: details.name }];
      }
      requirementInput = "";
    } catch (e) {
      requirementError = e instanceof Error ? e.message : String(e);
    } finally {
      isResolvingRequirement = false;
    }
  }

  function removeRequirement(modId: string) {
    uploadRequirements = uploadRequirements.filter(r => r.modId !== modId);
  }

  /** After a successful upload, set file-level requirements on the newest file version. */
  async function setRequirementsOnLatestFile() {
    if (uploadRequirements.length === 0) return;
    try {
      let versions;
      if (nexusStore.useUploadV3 && nexusStore.selectedFileGroupId) {
        versions = await nexusGetFileVersions(nexusStore.selectedFileGroupId);
      } else if (nexusStore.modId) {
        versions = await nexusGetAllModFiles(Number(nexusStore.modId));
      }
      if (versions && versions.length > 0) {
        const sorted = [...versions].sort((a, b) => {
          if (a.created_at && b.created_at) return b.created_at.localeCompare(a.created_at);
          return b.id.localeCompare(a.id);
        });
        await nexusSetFileDependencies(
          String(sorted[0].id),
          uploadRequirements.map(r => r.modId),
        );
      }
    } catch {
      // Best-effort — v3 experimental API may fail
    }
  }

  /** Pre-fill upload form from an existing file entry (Update file action). */
  function handleUpdateFile(file: NexusFileVersion) {
    // Strip Nexus filename suffix: -modId-version-timestamp.ext
    let name = file.name;
    if (nexusStore.modId) {
      const suffix = new RegExp(`-${nexusStore.modId}-[\\d-]+-\\d+\\.[a-zA-Z0-9]+$`);
      name = name.replace(suffix, "");
    }
    uploadName = name;
    uploadDescription = file.description ?? "";
    uploadCategory = (file.category ?? "main").toLowerCase();
    uploadVersion = "";
    showUploadForm = true;
  }

  async function handlePublishFile() {
    showPublishDropdown = false;
    const selected = await dialogOpen({
      title: "Select file to publish",
      defaultPath: modStore.selectedModPath || undefined,
      filters: [{ name: "PAK / ZIP files", extensions: ["pak", "zip"] }],
      multiple: false,
      directory: false,
    });
    if (!selected) return;
    const filePath = typeof selected === "string" ? selected : selected;
    showUploadModal = true;
    try {
      await nexusUploadFile({
        file_path: filePath,
        mod_uuid: nexusStore.modUuid!,
        file_group_id: nexusStore.selectedFileGroupId!,
        name: uploadName.trim() || nexusStore.modName || "",
        version: uploadVersion.trim(),
        description: uploadDescription.trim() || null,
        category: uploadCategory,
      });
      await setRequirementsOnLatestFile();
      toastStore.success(
        m.nexus_upload_success_title(),
        m.nexus_upload_success_message({ modName: nexusStore.modName ?? "", version: uploadVersion.trim() }),
      );
      showUploadForm = false;
    } catch (e: unknown) {
      const msg = localizeError(e as AppError);
      toastStore.error(m.nexus_upload_error_title(), msg);
    } finally {
      showUploadModal = false;
    }
  }

  // Autofill version from meta.lsx when it changes
  $effect(() => {
    const metaVer = modStore.scanResult?.mod_meta?.version;
    if (metaVer && !uploadVersion) {
      uploadVersion = metaVer;
    }
  });

  // Autofill upload name from mod name when it changes
  $effect(() => {
    const name = nexusStore.modName;
    if (name && !uploadName) {
      uploadName = name;
    }
  });

  // Check if current version already exists in file history
  let versionAlreadyReleased = $derived.by(() => {
    if (!uploadVersion.trim()) return false;
    const ver = uploadVersion.trim();
    // Check against file groups' last_upload or other version data
    return nexusStore.fileGroups.some(g => g.last_upload === ver);
  });

  async function handleUpload() {
    showUploadModal = true;
    try {
      await nexusPackageAndUpload({
        source_dir: modStore.selectedModPath,
        mod_uuid: nexusStore.modUuid!,
        file_group_id: nexusStore.selectedFileGroupId!,
        name: uploadName.trim() || nexusStore.modName || "",
        version: uploadVersion.trim(),
        description: uploadDescription.trim() || null,
        category: uploadCategory,
        exclude_patterns: null,
      });
      await setRequirementsOnLatestFile();
      toastStore.success(
        m.nexus_upload_success_title(),
        m.nexus_upload_success_message({ modName: nexusStore.modName ?? "", version: uploadVersion.trim() }),
      );
      uploadVersion = "";
      uploadName = "";
      uploadDescription = "";
      showUploadModal = false;
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      if (msg.includes("429") || msg.includes("rate")) {
        toastStore.error(m.nexus_error_rate_limited({ seconds: "30" }));
      } else if (msg.includes("network") || msg.includes("connection") || msg.includes("timeout")) {
        toastStore.error(m.nexus_error_network());
      } else if (msg.includes("package") || msg.includes("pak") || msg.includes("zip")) {
        toastStore.error(m.nexus_error_packaging_failed());
      } else {
        toastStore.error(
          m.nexus_error_upload_failed(),
          localizeError({ kind: "upload", message: err instanceof Error ? err.message : String(err) }),
        );
      }
    }
  }

  function handleModalClose() {
    showUploadModal = false;
    uploadButtonRef?.focus();
  }

  function handleFileGroupChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    nexusStore.selectedFileGroupId = target.value || null;
    nexusStore.saveProjectConfig();
  }

  // ── Settings dropdown ──
  function toggleSettingsDropdown() {
    showSettingsDropdown = !showSettingsDropdown;
  }

  function handleSettingsClickOutside(e: MouseEvent) {
    if (
      settingsDropdownEl && !settingsDropdownEl.contains(e.target as Node) &&
      settingsBtnEl && !settingsBtnEl.contains(e.target as Node)
    ) {
      showSettingsDropdown = false;
    }
  }

  $effect(() => {
    if (showSettingsDropdown) {
      document.addEventListener("click", handleSettingsClickOutside, true);
      return () => document.removeEventListener("click", handleSettingsClickOutside, true);
    }
  });

  function handleInputKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLinkMod();
    }
  }
</script>

<div class="flex h-full flex-col bg-[var(--th-sidebar-bg,var(--th-bg-900))]">
  <!-- Header bar -->
  <div class="flex items-center gap-1 border-b border-[var(--th-border-700)] px-3 py-2 shrink-0">
    <h2 class="flex-1 truncate text-xs font-semibold text-[var(--th-text-200)]">
      {m.nexus_panel_title()}
    </h2>
    {#if nexusStore.modUuid}
      <!-- Refresh button (rate-limited) -->
      <button
        type="button"
        class="rounded p-1 text-[var(--th-text-500)] hover:bg-[var(--th-bg-800)] hover:text-[var(--th-text-200)] disabled:opacity-40"
        onclick={handleRefresh}
        disabled={isRefreshing}
        aria-label={m.nexus_refresh_button()}
        title={m.nexus_refresh_button()}
      >
        <RefreshCw size={14} class={isRefreshing && !getPrefersReducedMotion() ? 'animate-spin' : ''} />
      </button>
      <!-- Upload toggle button (only when connected) -->
      {#if nexusStore.apiKeyValid}
        <button
          type="button"
          class="rounded p-1 text-[var(--th-text-500)] hover:bg-[var(--th-bg-800)] hover:text-[var(--th-text-200)]"
          class:text-[var(--th-accent,#0ea5e9)]={showUploadForm}
          onclick={() => { showUploadForm = !showUploadForm; }}
          aria-label={showUploadForm ? m.nexus_cancel_button() : m.nexus_upload_button()}
          title={showUploadForm ? m.nexus_cancel_button() : m.nexus_upload_button()}
        >
          {#if showUploadForm}
            <X size={14} />
          {:else}
            <Upload size={14} />
          {/if}
        </button>
      {/if}
      <!-- Settings dropdown -->
      <div class="relative">
        <button
          type="button"
          class="rounded p-1 text-[var(--th-text-500)] hover:bg-[var(--th-bg-800)] hover:text-[var(--th-text-200)]"
          class:text-[var(--th-accent,#0ea5e9)]={showSettingsDropdown}
          bind:this={settingsBtnEl}
          onclick={toggleSettingsDropdown}
          aria-label={m.nexus_settings_gear_label()}
          title={m.nexus_settings_gear_label()}
          aria-haspopup="true"
          aria-expanded={showSettingsDropdown}
        >
          <Settings size={14} />
        </button>
        {#if showSettingsDropdown}
          <div
            class="absolute right-0 top-full z-[10000] mt-1 w-52 rounded-md border border-[var(--th-border-600)] bg-[var(--th-bg-800)] shadow-lg overflow-hidden"
            bind:this={settingsDropdownEl}
            role="menu"
          >
            <label class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-[var(--th-text-300)] hover:bg-[var(--th-bg-700)]">
              <input
                type="checkbox"
                class="accent-[var(--th-accent,#0ea5e9)]"
                checked={nexusStore.useUploadV3}
                onchange={() => { nexusStore.useUploadV3 = !nexusStore.useUploadV3; nexusStore.saveProjectConfig(); }}
              />
              {m.nexus_setting_use_upload_v3()}
            </label>
          </div>
        {/if}
      </div>
    {/if}
    <!-- Connection indicator button -->
    <div class="relative" bind:this={connectionPopoverEl}>
      <button
        type="button"
        class="relative rounded p-1 text-[var(--th-text-500)] hover:bg-[var(--th-bg-800)] hover:text-[var(--th-text-200)]"
        bind:this={connectionBtnEl}
        onclick={toggleConnectionPopover}
        aria-label={m.nexus_connection_section_label()}
      >
        <Globe size={14} />
        <span
          class="absolute -bottom-0.5 -right-0.5 block h-2 w-2 rounded-full border border-[var(--th-sidebar-bg,var(--th-bg-900))]"
          style="background: {connectionDotColor};"
        ></span>
      </button>
      {#if showConnectionPopover}
        <div
          class="fixed z-[10000] w-56 rounded-md border border-[var(--th-border-600)] bg-[var(--th-bg-800)] shadow-lg overflow-hidden"
          style="top: {popoverPos.top}px; right: {popoverPos.right}px;"
          role="dialog"
          aria-label={m.nexus_connection_section_label()}
        >
          {#if nexusStore.apiKeyValid}
            <!-- Connected state: avatar + name + disconnect (like Git forge picker) -->
            <div class="flex items-center gap-2 border-b border-[var(--th-border-700)] px-3 py-2.5">
              {#if nexusStore.userProfile?.profile_url}
                <img
                  src={nexusStore.userProfile.profile_url}
                  alt={nexusStore.userProfile.name ?? "User"}
                  class="h-7 w-7 shrink-0 rounded-full object-cover"
                />
              {:else}
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--th-accent,#0ea5e9)] text-[11px] font-bold text-white">
                  {(nexusStore.userProfile?.name ?? "U").charAt(0).toUpperCase()}
                </span>
              {/if}
              <div class="flex flex-col min-w-0">
                <span class="text-xs font-semibold text-[var(--th-text-200)] truncate">
                  {nexusStore.userProfile?.name ?? m.nexus_connected()}
                </span>
                <span class="text-[10px] text-[var(--th-text-500)]">Nexus Mods</span>
              </div>
            </div>
            <div class="px-2 py-1.5">
              <button
                type="button"
                class="flex w-full items-center gap-1.5 rounded px-2 py-1 text-xs text-red-400 hover:bg-red-950/30"
                onclick={popoverClearKey}
              >
                <LogOut size={12} aria-hidden="true" />
                {m.nexus_disconnect_button()}
              </button>
            </div>
          {:else}
            <!-- Disconnected state: API key input -->
            <div class="border-b border-[var(--th-border-700)] px-3 py-2">
              <span class="text-xs text-[var(--th-text-300)]">
                {#if nexusStore.isValidating}
                  {m.nexus_api_key_status_testing()}
                {:else}
                  {m.nexus_not_connected()}
                {/if}
              </span>
            </div>
            <div class="flex flex-col gap-1.5 px-3 py-2">
              <input type="password" class="w-full rounded border border-[var(--th-border-700)] bg-[var(--th-bg-900)] px-2 py-1 text-[10px] text-[var(--th-text-200)] placeholder:text-[var(--th-text-500)] focus:outline-none focus:ring-1 focus:ring-[var(--th-accent,#0ea5e9)]" placeholder={m.nexus_api_key_placeholder()} bind:value={connectionApiKeyInput} onkeydown={(e) => { if (e.key === "Enter") popoverSaveKey(); }} />
              <button type="button" class="rounded bg-[var(--th-accent,#0ea5e9)] px-2 py-1 text-[10px] font-medium text-white hover:brightness-110 disabled:opacity-50" onclick={popoverSaveKey} disabled={!connectionApiKeyInput.trim()}>{m.nexus_save_button()}</button>
              <a href="https://www.nexusmods.com/users/myaccount?tab=api+access" target="_blank" rel="noopener noreferrer" class="text-[10px] text-[var(--th-accent,#0ea5e9)] hover:underline">{m.nexus_api_key_link()}</a>
            </div>
          {/if}
        </div>
      {/if}
    </div>
    {#if nexusStore.modUrl}
      <button type="button" class="rounded p-1 text-[var(--th-text-500)] hover:bg-[var(--th-bg-800)] hover:text-[var(--th-text-200)]" onclick={openModPage} aria-label={m.nexus_external_link_label()}>
        <ExternalLink size={14} />
      </button>
    {/if}
  </div>

  {#if nexusStore.modUuid}
    <!-- ── Linked state ─────────────────────────────────────────── -->

    {#if showUploadForm}
      <!-- ── Upload form (replaces mod info card, like Git commit box) ── -->
      <div class="flex flex-col gap-2 border-b border-[var(--th-border-700)] px-3 py-2">
        <!-- Description -->
        <div>
          <label for="nexus-upload-description" class="mb-0.5 block text-[10px] font-medium text-[var(--th-text-500)]">{m.nexus_upload_description_label()}</label>
          <textarea
            id="nexus-upload-description"
            class="w-full resize-none rounded border border-[var(--th-input-border,var(--th-bg-700))] bg-[var(--th-input-bg,var(--th-bg-800))] px-2 py-1 text-xs text-[var(--th-text-200)] placeholder:text-[var(--th-text-500)] focus:border-[var(--th-accent,#0ea5e9)] focus:outline-none"
            placeholder={m.nexus_upload_description_placeholder()}
            rows={3}
            bind:value={uploadDescription}
          ></textarea>
        </div>

        <!-- Display Name -->
        <div>
          <label for="nexus-upload-name" class="mb-0.5 block text-[10px] font-medium text-[var(--th-text-500)]">{m.nexus_upload_name_label()}</label>
          <input
            id="nexus-upload-name"
            type="text"
            class="w-full rounded border border-[var(--th-input-border,var(--th-bg-700))] bg-[var(--th-input-bg,var(--th-bg-800))] px-2 py-1 text-xs text-[var(--th-text-200)] placeholder:text-[var(--th-text-500)] focus:border-[var(--th-accent,#0ea5e9)] focus:outline-none"
            placeholder={m.nexus_upload_name_placeholder()}
            bind:value={uploadName}
          />
        </div>

        <!-- Version + File Group (same row when v3) -->
        <div class="flex items-start gap-2">
          <div class="flex-1 min-w-0">
            <label for="nexus-upload-version" class="mb-0.5 block text-[10px] font-medium text-[var(--th-text-500)]">{m.nexus_upload_version_label()}</label>
            <input
              id="nexus-upload-version"
              type="text"
              class="w-full rounded border border-[var(--th-input-border,var(--th-bg-700))] bg-[var(--th-input-bg,var(--th-bg-800))] px-2 py-1 text-xs text-[var(--th-text-200)] placeholder:text-[var(--th-text-500)] focus:border-[var(--th-accent,#0ea5e9)] focus:outline-none"
              placeholder={m.nexus_upload_version_placeholder()}
              bind:value={uploadVersion}
              required
            />
            {#if versionAlreadyReleased}
              <p class="mt-0.5 text-[10px] text-amber-400">{m.nexus_upload_version_exists_warning()}</p>
            {/if}
          </div>
          {#if nexusStore.useUploadV3}
            <div class="flex-1 min-w-0">
              <label for="nexus-file-group" class="mb-0.5 block text-[10px] font-medium text-[var(--th-text-500)]">{m.nexus_file_group_switcher_label()}</label>
              <select
                id="nexus-file-group"
                class="w-full rounded border border-[var(--th-input-border,var(--th-bg-700))] bg-[var(--th-input-bg,var(--th-bg-800))] px-2 py-1 text-xs text-[var(--th-text-200)] focus:border-[var(--th-accent,#0ea5e9)] focus:outline-none"
                value={nexusStore.selectedFileGroupId ?? ""}
                onchange={handleFileGroupChange}
                title={m.nexus_file_group_tooltip()}
              >
                <option value="">{m.nexus_file_group_placeholder()}</option>
                {#each nexusStore.fileGroups as group (group.id)}
                  <option value={group.id}>{group.latest_file_name ?? group.name}{group.version_count ? ` (${group.version_count})` : ''}</option>
                {/each}
              </select>
            </div>
          {/if}
        </div>

        <!-- Category pill selector -->
        <div class="flex flex-col items-center">
          <span class="mb-0.5 block text-[10px] font-medium text-[var(--th-text-500)]">{m.nexus_upload_category_label()}</span>
          <div class="inline-flex rounded-md border border-[var(--th-border-700)] overflow-hidden" role="radiogroup" aria-label={m.nexus_upload_category_label()}>
            {#each [{ value: "main", label: m.nexus_category_main() }, { value: "optional", label: m.nexus_category_optional() }, { value: "miscellaneous", label: m.nexus_category_miscellaneous() }] as opt}
              <button
                type="button"
                role="radio"
                aria-checked={uploadCategory === opt.value}
                class="px-2 py-1 text-[10px] font-medium transition-colors
                  {uploadCategory === opt.value
                    ? 'bg-[var(--th-accent,#0ea5e9)] text-white'
                    : 'bg-[var(--th-bg-800)] text-[var(--th-text-400)] hover:bg-[var(--th-bg-700)]'}"
                onclick={() => { uploadCategory = opt.value; }}
              >
                {opt.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Requirements (v3 file-level) -->
        {#if nexusStore.useUploadV3}
          <div>
            <label for="nexus-upload-requirements" class="mb-0.5 block text-[10px] font-medium text-[var(--th-text-500)]">{m.nexus_upload_requirements_label()}</label>
            {#if uploadRequirements.length > 0}
              <div class="mb-1 flex flex-wrap gap-1">
                {#each uploadRequirements as req (req.modId)}
                  <span class="inline-flex items-center gap-1 rounded-full bg-[var(--th-bg-700)] px-2 py-0.5 text-[10px] text-[var(--th-text-300)]">
                    {req.name}
                    <button
                      type="button"
                      class="ml-0.5 text-[var(--th-text-500)] hover:text-red-400"
                      onclick={() => removeRequirement(req.modId)}
                      aria-label="Remove {req.name}"
                    >&times;</button>
                  </span>
                {/each}
              </div>
            {/if}
            <div class="flex items-center gap-1.5">
              <input
                id="nexus-upload-requirements"
                type="text"
                class="flex-1 rounded border border-[var(--th-input-border,var(--th-bg-700))] bg-[var(--th-input-bg,var(--th-bg-800))] px-2 py-1 text-xs text-[var(--th-text-200)] placeholder:text-[var(--th-text-500)] focus:border-[var(--th-accent,#0ea5e9)] focus:outline-none"
                placeholder={m.nexus_upload_requirements_placeholder()}
                bind:value={requirementInput}
                onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRequirement(); } }}
                disabled={isResolvingRequirement}
              />
              <button
                type="button"
                class="rounded border border-[var(--th-border-600)] bg-[var(--th-bg-700)] px-2 py-1 text-xs text-[var(--th-text-300)] hover:bg-[var(--th-bg-600)] disabled:opacity-50"
                onclick={addRequirement}
                disabled={isResolvingRequirement || !requirementInput.trim()}
              >
                {#if isResolvingRequirement}
                  <Loader2 size={12} class={getPrefersReducedMotion() ? '' : 'animate-spin'} aria-hidden="true" />
                {:else}
                  <Plus size={12} aria-hidden="true" />
                {/if}
              </button>
            </div>
            {#if requirementError}
              <p class="mt-0.5 text-[10px] text-red-400">{requirementError}</p>
            {/if}
            <p class="mt-0.5 text-[9px] text-[var(--th-text-600)]">{m.nexus_upload_requirements_hint()}</p>
          </div>
        {/if}

        <!-- Publish split button + Cancel -->
        <div class="flex items-center gap-2">
          <div class="relative flex flex-1">
            <button
              type="button"
              class="flex flex-1 items-center justify-center gap-1.5 rounded-l bg-[var(--th-accent,#0ea5e9)] px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 disabled:opacity-50"
              bind:this={uploadButtonRef}
              onclick={handleUpload}
              disabled={!nexusStore.apiKeyValid || !nexusStore.modUuid || (nexusStore.useUploadV3 && !nexusStore.selectedFileGroupId) || !uploadVersion.trim() || platformUploadStore.isUploading}
            >
              {#if platformUploadStore.isUploading}
                <Loader2 size={14} class={getPrefersReducedMotion() ? '' : 'animate-spin'} aria-hidden="true" />
              {:else}
                <Upload size={14} aria-hidden="true" />
              {/if}
              {m.nexus_publish_mod_button()}
            </button>
            <button
              type="button"
              class="flex items-center rounded-r border-l border-white/20 bg-[var(--th-accent,#0ea5e9)] px-1.5 py-1.5 text-white hover:brightness-110 disabled:opacity-50"
              onclick={() => { showPublishDropdown = !showPublishDropdown; }}
              disabled={!nexusStore.apiKeyValid || !nexusStore.modUuid || (nexusStore.useUploadV3 && !nexusStore.selectedFileGroupId) || !uploadVersion.trim() || platformUploadStore.isUploading}
              aria-haspopup="true"
              aria-expanded={showPublishDropdown}
            >
              <ChevronDown size={12} aria-hidden="true" />
            </button>
            {#if showPublishDropdown}
              <div class="absolute left-0 top-full z-50 mt-1 w-full rounded border border-[var(--th-border-600)] bg-[var(--th-bg-800)] shadow-lg overflow-hidden">
                <button
                  type="button"
                  class="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--th-text-300)] hover:bg-[var(--th-bg-700)]"
                  onclick={handlePublishFile}
                >
                  <File size={12} aria-hidden="true" />
                  {m.nexus_publish_file_button()}
                </button>
              </div>
            {/if}
          </div>
          <button
            type="button"
            class="rounded border border-[var(--th-border-600)] px-3 py-1.5 text-xs text-[var(--th-text-400)] hover:bg-[var(--th-bg-700)]"
            onclick={() => { showUploadForm = false; showPublishDropdown = false; }}
          >
            {m.nexus_cancel_button()}
          </button>
        </div>
      </div>
    {:else}
      <!-- ── Mod info card ── -->
      <div class="p-3 shrink-0">
        <!-- Thumbnail -->
        {#if nexusStore.modThumbnailUrl}
          <img
            src={nexusStore.modThumbnailUrl}
            alt={nexusStore.modName ?? ""}
            class="mb-2 w-full rounded border border-[var(--th-border-700)] object-cover"
            style="max-height: 120px;"
          />
        {/if}

        <!-- Title + ID on same row -->
        <div class="flex items-baseline gap-1.5">
          <span class="text-xs font-semibold text-[var(--th-text-200)] truncate flex-1">
            {nexusStore.modName ?? m.nexus_unknown_mod()}
          </span>
          <span class="text-[10px] text-[var(--th-text-500)] shrink-0">
            #{nexusStore.modId}
          </span>
        </div>

        <!-- Version -->
        {#if modStore.scanResult?.mod_meta?.version}
          <p class="mt-0.5 text-[10px] text-[var(--th-text-400)]">
            {m.nexus_mod_version_label()}: {modStore.scanResult.mod_meta.version}
          </p>
        {/if}

        <!-- Category -->
        {#if nexusStore.modCategoryName}
          <p class="mt-0.5 text-[10px] text-[var(--th-text-500)]">{nexusStore.modCategoryName}</p>
        {/if}

        <!-- Summary (truncated / collapsible) -->
        {#if nexusStore.modSummary}
          <div class="mt-1.5">
            <p
              bind:this={summaryEl}
              class="text-[11px] leading-relaxed text-[var(--th-text-400)] {summaryExpanded ? '' : 'line-clamp-3'}"
            >
              {nexusStore.modSummary}
            </p>
            {#if summaryTruncated || summaryExpanded}
              <button
                type="button"
                class="mt-0.5 text-[10px] text-[var(--th-accent,#0ea5e9)] hover:underline"
                onclick={() => { summaryExpanded = !summaryExpanded; }}
              >
                {summaryExpanded ? m.nexus_show_less() : m.nexus_show_more()}
              </button>
            {/if}
          </div>
        {/if}

        <!-- Tags + badges -->
        {#if nexusStore.modTags.length > 0 || nexusStore.modAdultContent}
          <div class="mt-2 flex flex-wrap gap-1">
            {#if nexusStore.modAdultContent}
              <span class="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-medium text-red-400">
                {m.nexus_adult_content_badge()}
              </span>
            {/if}
            {#each nexusStore.modTags as tag}
              <span class="rounded-full bg-[var(--th-bg-700)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--th-text-400)]">
                {tag}
              </span>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- ── Drawers (ExplorerDrawer pattern – matches Git pane) ── -->
    <div class="nexus-drawer-layout">
      {#each visibleDrawerIds as drawerId, i (drawerId)}
        <div
          class="nexus-drawer-slot"
          class:drawer-collapsed={uiStore.isDrawerCollapsed(drawerId)}
          class:drawer-sized={!uiStore.isDrawerCollapsed(drawerId) && uiStore.explorerDrawers[drawerId]?.height != null}
        >
          {#if drawerId === "nexus-file-history"}
            <ExplorerDrawer id="nexus-file-history" title={m.nexus_file_history_header()} isFirst={i === 0} count={nexusFileCount || undefined} allDrawerIds={allNexusDrawerIds} drawerTitles={nexusDrawerTitles}>
              {#snippet headerActions()}
                <button
                  class="drawer-action-btn"
                  class:active={showUploadForm}
                  title={m.nexus_upload_form_header()}
                  aria-label={m.nexus_upload_form_header()}
                  onclick={(e: MouseEvent) => { e.stopPropagation(); showUploadForm = !showUploadForm; }}
                >
                  <Upload size={14} aria-hidden="true" />
                </button>
              {/snippet}
              {#snippet children()}
                <NexusFileHistory modUuid={nexusStore.modUuid!} fileGroupId={null} bind:fileCount={nexusFileCount} onupdatefile={handleUpdateFile} />
              {/snippet}
            </ExplorerDrawer>
          {:else if drawerId === "nexus-changelog"}
            <ExplorerDrawer id="nexus-changelog" title={m.nexus_changelog_header()} isFirst={i === 0} defaultOpen={false} allDrawerIds={allNexusDrawerIds} drawerTitles={nexusDrawerTitles}>
              {#snippet children()}
                <NexusChangelog modUuid={nexusStore.modUuid!} fileGroupId={nexusStore.selectedFileGroupId} />
              {/snippet}
            </ExplorerDrawer>
          {:else if drawerId === "nexus-dependencies"}
            <ExplorerDrawer id="nexus-dependencies" title={m.nexus_dependencies_header()} count={dependencyStore.dependencies.length || undefined} isFirst={i === 0} defaultHeight={180} allDrawerIds={allNexusDrawerIds} drawerTitles={nexusDrawerTitles}>
              {#snippet headerActions()}
                <button
                  class="drawer-action-btn"
                  class:active={showDepAddForm}
                  title={m.nexus_add_dependency()}
                  aria-label={m.nexus_add_dependency()}
                  onclick={(e: MouseEvent) => { e.stopPropagation(); showDepAddForm = !showDepAddForm; }}
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
              {/snippet}
              {#snippet children()}
                <NexusDependencies modUuid={nexusStore.modUuid!} metaDependencies={modStore.metaDependencies} bind:showAddForm={showDepAddForm} />
              {/snippet}
            </ExplorerDrawer>
          {/if}
        </div>
      {/each}
    </div>

    {#if showUploadModal}
      <UploadProgressModal onclose={handleModalClose} />
    {/if}
  {:else}
    <!-- ── Unlinked state ───────────────────────────────────────── -->
    <div class="flex flex-col gap-3 p-4">
      <div class="text-center">
        <p class="text-sm font-medium text-[var(--th-text-300)]">
          {m.nexus_no_mod_linked()}
        </p>
        <p class="mt-1 text-xs text-[var(--th-text-500)]">
          {m.nexus_link_mod_cta()}
        </p>
      </div>

      <div>
        <label for="nexus-link-input" class="mb-1 block text-[10px] font-medium text-[var(--th-text-500)]">
          {m.nexus_link_mod_input_label()}
        </label>
        <input id="nexus-link-input" type="text" class="w-full rounded border border-[var(--th-border-700)] bg-[var(--th-bg-800)] px-2 py-1.5 text-xs text-[var(--th-text-200)] placeholder:text-[var(--th-text-500)] focus:outline-none focus:ring-1 focus:ring-[var(--th-accent,#0ea5e9)]" placeholder="https://nexusmods.com/… or 1933" bind:value={linkInput} onkeydown={handleInputKeydown} disabled={isLinking} />
      </div>

      <button type="button" class="flex items-center justify-center gap-1.5 rounded bg-[var(--th-accent,#0ea5e9)] px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 disabled:opacity-50" onclick={handleLinkMod} disabled={isLinking || !linkInput.trim()}>
        {#if isLinking}
          <Loader2 size={14} class={getPrefersReducedMotion() ? '' : 'animate-spin'} aria-hidden="true" />
        {/if}
        {m.nexus_link_mod_button()}
      </button>

      {#if linkError}
        <div class="flex items-start gap-1.5 rounded border border-red-800/50 bg-red-950/30 px-2 py-1.5 text-xs text-red-400" role="alert">
          <AlertCircle size={14} class="mt-0.5 shrink-0" />
          <span>{linkError}</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .nexus-drawer-layout {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
    justify-content: flex-end;
    overflow: hidden;
  }

  .nexus-drawer-slot {
    position: relative;
    min-height: 0;
    flex: 1 1 0%;
    overflow: hidden;
  }

  .nexus-drawer-slot.drawer-collapsed,
  .nexus-drawer-slot.drawer-sized {
    flex: 0 0 auto;
  }
</style>
