<!-- ModioPanel — Sidebar pane for mod.io mod management. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { m } from "../../../paraglide/messages.js";
  import { modioStore } from "../../../lib/stores/modioStore.svelte.js";
  import { platformUploadStore } from "../../../lib/stores/platformUploadStore.svelte.js";
  import { toastStore } from "../../../lib/stores/toastStore.svelte.js";
  import { open as shellOpen } from "@tauri-apps/plugin-shell";
  import { getPrefersReducedMotion } from "../../../lib/stores/motion.svelte.js";
  import { modioPackageAndUpload, modioEditMod } from "../../../lib/tauri/modio.js";
  import type { ModioImage } from "../../../lib/tauri/modio.js";
  import { modStore } from "../../../lib/stores/modStore.svelte.js";
  import { localizeError, type AppError } from "../../../lib/errorLocalization.js";
  import { uiStore } from "../../../lib/stores/uiStore.svelte.js";

  // Icons
  import Globe from "@lucide/svelte/icons/globe";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Upload from "@lucide/svelte/icons/upload";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import Plus from "@lucide/svelte/icons/plus";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Check from "@lucide/svelte/icons/check";
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import Download from "@lucide/svelte/icons/download";
  import Users from "@lucide/svelte/icons/users";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import LogOut from "@lucide/svelte/icons/log-out";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import LinkIcon from "@lucide/svelte/icons/link";
  import Unlink from "@lucide/svelte/icons/unlink";
  import X from "@lucide/svelte/icons/x";

  // Section components
  import ModioFileVersions from "./ModioFileVersions.svelte";
  import ModioChangelog from "./ModioChangelog.svelte";
  import ModioMediaSection from "./ModioMediaSection.svelte";
  import ModioTagSection from "./ModioTagSection.svelte";
  import ModioDependencies from "./ModioDependencies.svelte";

  import CreateModDialog from "./CreateModDialog.svelte";
  import UploadProgressModal from "../UploadProgressModal.svelte";
  import ExplorerDrawer from "../../ExplorerDrawer.svelte";

  // ── Upload form state ──
  let uploadVersion = $state("");
  let uploadChangelog = $state("");
  let uploadActive = $state(true);
  let showUploadForm = $state(false);

  // Pre-fill version from meta.lsx when upload form opens
  $effect(() => {
    if (showUploadForm && !uploadVersion) {
      uploadVersion = modStore.scanResult?.mod_meta?.version ?? "";
    }
  });

  // ── UI state ──
  let showCreateDialog = $state(false);
  let showUploadModal = $state(false);
  let focusedModIndex = $state(-1);
  let isRefreshing = $state(false);
  let lastRefreshAt = 0;
  const REFRESH_COOLDOWN_MS = 30_000;

  // ── Mod info card state ──
  let summaryExpanded = $state(false);
  let summaryEl: HTMLParagraphElement | null = $state(null);
  let summaryTruncated = $state(false);

  // ── Inline description editing state ──
  let isEditingDescription = $state(false);
  let editDescriptionValue = $state("");
  let isSavingDescription = $state(false);

  // ── Media section ref for header browse button ──
  let mediaSectionRef: ModioMediaSection | null = $state(null);

  // ── Dependencies add form state ──
  let showDepAddForm = $state(false);

  // ── Resizable info/drawer split ──
  let infoHeight: number | null = $state(null);
  let isResizing = $state(false);
  let infoSectionRef: HTMLDivElement | null = $state(null);

  function handleResizeStart(e: MouseEvent) {
    e.preventDefault();
    isResizing = true;
    const startY = e.clientY;
    const startHeight = infoHeight ?? infoSectionRef?.getBoundingClientRect().height ?? 200;
    // Get the parent container height to cap the info section
    const parentHeight = infoSectionRef?.parentElement?.getBoundingClientRect().height ?? 600;

    function onMove(ev: MouseEvent) {
      const delta = ev.clientY - startY;
      // Clamp between 80px and 80% of parent
      infoHeight = Math.max(80, Math.min(parentHeight * 0.8, startHeight + delta));
    }
    function onUp() {
      isResizing = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // ── Link-by-URL state (mirrors Nexus pattern) ──
  let linkInput = $state("");
  let isLinking = $state(false);
  let linkError: string | null = $state(null);

  // ── Connection popover state ──
  let showConnectionPopover = $state(false);
  let connectionTokenInput = $state("");
  let connectionUserIdInput = $state("");
  let connectionPopoverEl: HTMLDivElement | null = $state(null);
  let connectionBtnEl: HTMLButtonElement | null = $state(null);
  let popoverPos = $state({ top: 0, right: 0 });
  let isSavingToken = $state(false);

  let connectionDotColor = $derived(
    modioStore.isAuthenticating ? "var(--th-warning, #f59e0b)" :
    modioStore.isAuthenticated && !modioStore.tokenExpired ? "var(--th-success, #10b981)" :
    modioStore.isAuthenticated && modioStore.tokenExpired ? "var(--th-error, #ef4444)" :
    "var(--th-text-600, #6b7280)"
  );

  // ── Drawer visibility & pinning (matches Nexus/Git pane pattern) ──
  const allModioDrawerIds = ["modio-file-versions", "modio-changelog", "modio-media", "modio-dependencies"];
  const modioDrawerTitles: Record<string, string> = $derived({
    "modio-file-versions": "File History",
    "modio-changelog": "Changelog",
    "modio-media": m.modio_media_header(),
    "modio-dependencies": m.modio_dependencies_header(),
  });
  let visibleDrawerIds = $derived.by(() => {
    const visible = allModioDrawerIds.filter(id => !uiStore.isDrawerHidden(id));
    const pinned = visible.filter(id => uiStore.isDrawerPinned(id));
    const unpinned = visible.filter(id => !uiStore.isDrawerPinned(id));
    return [...pinned, ...unpinned];
  });

  /** True when every visible drawer is collapsed — hides the resize handle */
  let allDrawersCollapsed = $derived(visibleDrawerIds.length === 0 || visibleDrawerIds.every(id => uiStore.isDrawerCollapsed(id)));

  // Detect if summary text is actually truncated by line-clamp
  $effect(() => {
    if (summaryEl && !summaryExpanded) {
      summaryTruncated = summaryEl.scrollHeight > summaryEl.clientHeight;
    }
  });

  // File count for drawer header badge
  let fileCount = $state(0);

  // ── Derived ──
  let canUpload = $derived(
    modioStore.isAuthenticated &&
    modioStore.selectedModId != null &&
    uploadVersion.trim() !== "" &&
    !platformUploadStore.isUploading
  );

  // Name-based suggestion matching for unlinked state
  let suggestedMods = $derived.by(() => {
    const localName = modStore.modName.toLowerCase().trim();
    if (!localName || modioStore.userMods.length === 0) return [];
    return modioStore.userMods.filter(mod => {
      const remoteName = mod.name.toLowerCase();
      return remoteName.includes(localName) || localName.includes(remoteName);
    });
  });

  let unsuggestedMods = $derived.by(() => {
    if (suggestedMods.length === 0) return modioStore.userMods;
    const ids = new Set(suggestedMods.map(mod => mod.id));
    return modioStore.userMods.filter(mod => !ids.has(mod.id));
  });

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

  function toggleConnectionPopover() {
    showConnectionPopover = !showConnectionPopover;
    if (showConnectionPopover) {
      connectionTokenInput = "";
      connectionUserIdInput = "";
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

  async function popoverSaveToken() {
    const raw = connectionTokenInput.trim();
    const rawUserId = connectionUserIdInput.trim();
    if (!raw || !rawUserId || isSavingToken) return;
    const userId = parseInt(rawUserId, 10);
    if (isNaN(userId) || userId <= 0) {
      toastStore.error(m.modio_auth_error_title(), m.modio_user_id_invalid());
      return;
    }
    isSavingToken = true;
    try {
      await modioStore.saveToken(raw, userId);
      connectionTokenInput = "";
      connectionUserIdInput = "";
      showConnectionPopover = false;
      // Load user mods once after successful authentication
      modioStore.loadUserMods();
    } catch {
      toastStore.error(m.modio_auth_error_title(), modioStore.connectionError ?? m.modio_error_invalid_token());
    } finally {
      isSavingToken = false;
    }
  }

  async function popoverDisconnect() {
    await modioStore.disconnect();
    showConnectionPopover = false;
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

  // ── Inline description editing ──
  function startEditDescription() {
    editDescriptionValue = selectedModData?.summary ?? "";
    isEditingDescription = true;
  }

  async function saveDescription() {
    if (!modioStore.selectedModId || isSavingDescription) return;
    isSavingDescription = true;
    try {
      await modioEditMod({
        mod_id: modioStore.selectedModId,
        summary: editDescriptionValue.trim(),
      });
      isEditingDescription = false;
      await modioStore.loadUserMods();
    } catch {
      toastStore.error(m.modio_error_save_failed());
    } finally {
      isSavingDescription = false;
    }
  }

  function cancelEditDescription() {
    isEditingDescription = false;
  }

  // Find the selected mod in the user mods list for stats display
  let selectedModData = $derived.by(() => {
    if (!modioStore.selectedModId) return null;
    return modioStore.userMods.find(mod => mod.id === modioStore.selectedModId) ?? null;
  });

  // Media images for drawer count badge
  let mediaImages = $derived(selectedModData?.media_images ?? []);

  onMount(async () => {
    if (modioStore.isAuthenticated) {
      if (modioStore.isStale()) {
        await modioStore.loadUserMods();
        // Update cached fields from fresh data
        if (modioStore.selectedModId) {
          const fresh = modioStore.userMods.find(mod => mod.id === modioStore.selectedModId);
          if (fresh) {
            modioStore.modLogoUrl = fresh.logo_url || null;
            modioStore.lastFetchedAt = Date.now();
            modioStore.saveProjectConfig();
          }
        }
      } else {
        // Still load user mods for the mod list but skip if already populated
        if (modioStore.userMods.length === 0) {
          await modioStore.loadUserMods();
        }
      }
    }
  });

  async function handleLinkMod() {
    const raw = linkInput.trim();
    if (!raw || isLinking) return;
    // Accept numeric ID or mod.io URL
    if (!/^(\d+|https?:\/\/.+|.*mod\.io\/.+)$/i.test(raw)) {
      linkError = m.modio_error_invalid_input();
      return;
    }
    isLinking = true;
    linkError = null;
    try {
      await modioStore.resolveMod(raw);
      linkInput = "";
    } catch (e) {
      linkError = e instanceof Error ? e.message : String(e);
    } finally {
      isLinking = false;
    }
  }

  function handleLinkInputKeydown(e: KeyboardEvent) {
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

      <!-- Upload toggle button (only when connected, like Nexus) -->
      {#if modioStore.isAuthenticated}
        <button
          type="button"
          class="rounded p-1 text-[var(--th-text-500)] hover:bg-[var(--th-bg-800)] hover:text-[var(--th-text-200)]"
          class:text-[var(--th-accent,#0ea5e9)]={showUploadForm}
          onclick={() => { showUploadForm = !showUploadForm; }}
          aria-label={showUploadForm ? m.common_cancel() : m.modio_upload_button()}
          title={showUploadForm ? m.common_cancel() : m.modio_upload_button()}
        >
          {#if showUploadForm}
            <X size={14} />
          {:else}
            <Upload size={14} />
          {/if}
        </button>
      {/if}

      <!-- Unlink mod button -->
      <button
        type="button"
        class="rounded p-1 text-[var(--th-text-500)] hover:bg-[var(--th-bg-800)] hover:text-red-400"
        onclick={handleUnlink}
        aria-label="Unlink mod"
        title="Unlink mod"
      >
        <Unlink size={14} />
      </button>
    {/if}

    <!-- Connection indicator button — always visible -->
    <div class="relative" bind:this={connectionPopoverEl}>
      <button
        type="button"
        class="relative rounded p-1 text-[var(--th-text-500)] hover:bg-[var(--th-bg-800)] hover:text-[var(--th-text-200)]"
        bind:this={connectionBtnEl}
        onclick={toggleConnectionPopover}
        aria-label={m.modio_connection_label()}
        aria-haspopup="true"
        aria-expanded={showConnectionPopover}
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
          aria-label={m.modio_connection_label()}
        >
          {#if modioStore.isAuthenticated}
            <!-- Connected state -->
            <div class="flex items-center gap-2 border-b border-[var(--th-border-700)] px-3 py-2.5">
              {#if modioStore.avatarUrl}
                <img
                  src={modioStore.avatarUrl}
                  alt={modioStore.userName ?? "User"}
                  class="h-7 w-7 shrink-0 rounded-full object-cover"
                />
              {:else}
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--th-accent,#0ea5e9)] text-[11px] font-bold text-white">
                  {(modioStore.userName ?? "U").charAt(0).toUpperCase()}
                </span>
              {/if}
              <div class="flex flex-col min-w-0">
                <span class="text-xs font-semibold text-[var(--th-text-200)] truncate">
                  {modioStore.userName ?? m.modio_status_connected()}
                </span>
                <span class="text-[10px] text-[var(--th-text-500)]">mod.io</span>
              </div>
            </div>
            {#if modioStore.tokenExpired || (modioStore.tokenExpiry && modioStore.daysUntilExpiry <= 30)}
              <div
                class="flex items-center gap-1.5 rounded-md mx-2 my-1.5 px-2 py-1.5 text-[10px]"
                style="
                  color: {modioStore.tokenExpired ? 'var(--th-error, #ef4444)' : 'var(--th-warning, #f59e0b)'};
                  background: {modioStore.tokenExpired ? 'color-mix(in srgb, var(--th-error, #ef4444) 10%, transparent)' : 'color-mix(in srgb, var(--th-warning, #f59e0b) 10%, transparent)'};
                  border: 1px solid {modioStore.tokenExpired ? 'color-mix(in srgb, var(--th-error, #ef4444) 25%, transparent)' : 'color-mix(in srgb, var(--th-warning, #f59e0b) 25%, transparent)'};
                "
              >
                <AlertTriangle size={10} aria-hidden="true" />
                {#if modioStore.tokenExpired}
                  {m.modio_token_expired()}
                {:else}
                  {m.modio_token_expiry_warning({ days: String(modioStore.daysUntilExpiry) })}
                {/if}
              </div>
            {/if}
            <div class="px-2 py-1.5">
              <button
                type="button"
                class="flex w-full items-center gap-1.5 rounded px-2 py-1 text-xs text-red-400 hover:bg-red-950/30"
                onclick={popoverDisconnect}
              >
                <LogOut size={12} aria-hidden="true" />
                {m.modio_disconnect_button()}
              </button>
            </div>
          {:else}
            <!-- Disconnected state -->
            <div class="border-b border-[var(--th-border-700)] px-3 py-2">
              <span class="text-xs text-[var(--th-text-300)]">
                {#if isSavingToken}
                  {m.modio_connect_btn()}…
                {:else}
                  {m.modio_not_connected()}
                {/if}
              </span>
            </div>
            <div class="flex flex-col gap-1.5 px-3 py-2">
              <input
                type="text"
                inputmode="numeric"
                class="w-full rounded border border-[var(--th-border-700)] bg-[var(--th-bg-900)] px-2 py-1 text-[10px] text-[var(--th-text-200)] placeholder:text-[var(--th-text-500)] focus:outline-none focus:ring-1 focus:ring-[var(--th-accent,#0ea5e9)]"
                placeholder={m.modio_user_id_placeholder()}
                bind:value={connectionUserIdInput}
                autocomplete="off"
              />
              <input
                type="password"
                class="w-full rounded border border-[var(--th-border-700)] bg-[var(--th-bg-900)] px-2 py-1 text-[10px] text-[var(--th-text-200)] placeholder:text-[var(--th-text-500)] focus:outline-none focus:ring-1 focus:ring-[var(--th-accent,#0ea5e9)]"
                placeholder={m.modio_token_placeholder()}
                bind:value={connectionTokenInput}
                onkeydown={(e) => { if (e.key === "Enter") popoverSaveToken(); }}
                autocomplete="off"
              />
              <button
                type="button"
                class="rounded bg-[var(--th-accent,#0ea5e9)] px-2 py-1 text-[10px] font-medium text-white hover:brightness-110 disabled:opacity-50"
                onclick={popoverSaveToken}
                disabled={!connectionTokenInput.trim() || !connectionUserIdInput.trim() || isSavingToken}
              >
                {#if isSavingToken}
                  <Loader2 size={10} class="animate-spin" />
                {:else}
                  {m.modio_connect_btn()}
                {/if}
              </button>
              <a
                href="https://mod.io/me/access"
                target="_blank"
                rel="noopener noreferrer"
                class="text-[10px] text-[var(--th-accent,#0ea5e9)] hover:underline"
              >
                {m.modio_get_token_link()}
              </a>
            </div>
          {/if}
        </div>
      {/if}
    </div>
    <!-- External link to mod page (after connection, like Nexus) -->
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
  </div>

  {#if modioStore.selectedModId}
    <!-- ── Linked state ─────────────────────────────────────────── -->

    {#if showUploadForm}
      <!-- Upload form (replaces mod info card when active, like Nexus) -->
      <div class="flex flex-col gap-2 border-b border-[var(--th-border-700)] px-3 py-2">
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

        <!-- Upload + Cancel buttons -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="flex flex-1 items-center justify-center gap-1.5 rounded bg-[var(--th-accent,#0ea5e9)] px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 disabled:opacity-50"
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
          <button
            type="button"
            class="rounded border border-[var(--th-border-600)] px-3 py-1.5 text-xs text-[var(--th-text-400)] hover:bg-[var(--th-bg-700)]"
            onclick={() => { showUploadForm = false; }}
          >
            {m.common_cancel()}
          </button>
        </div>
      </div>
    {:else}
      <!-- Mod info card (shown when upload form is hidden, like Nexus) -->
      <div class="modio-info-section" bind:this={infoSectionRef} style={allDrawersCollapsed ? 'flex: 1' : infoHeight != null ? `height: ${infoHeight}px` : ''}>
        <div class="p-3">
        <!-- Thumbnail -->
        {#if selectedModData?.logo_url || modioStore.modLogoUrl}
          <img
            src={selectedModData?.logo_url ?? modioStore.modLogoUrl ?? ""}
            alt={modioStore.selectedModName ?? ""}
            class="mb-2 w-full rounded border border-[var(--th-border-700)] object-cover"
            style="max-height: 120px;"
          />
        {/if}

        <!-- Title + ID on same row -->
        <div class="flex items-baseline gap-1.5">
          <span class="text-xs font-semibold text-[var(--th-text-200)] truncate flex-1">
            {modioStore.selectedModName ?? "Unknown Mod"}
          </span>
          <span class="text-[10px] text-[var(--th-text-500)] shrink-0">
            #{modioStore.selectedModId}
          </span>
        </div>

        <!-- Version + badges -->
        <div class="mt-0.5 flex items-center gap-1.5">
          {#if modStore.scanResult?.mod_meta?.version}
            <span class="text-[10px] text-[var(--th-text-400)]">
              {m.modio_mod_version_label()}: {modStore.scanResult.mod_meta.version}
            </span>
          {/if}
          {#if selectedModData}
            <div class="ml-auto flex items-center gap-1">
              {#if selectedModData.status === 1}
                <span
                  class="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                  style="background: color-mix(in srgb, var(--th-success, #10b981) 15%, transparent); color: var(--th-success, #10b981);"
                >
                  <Check size={9} aria-hidden="true" />
                  {m.modio_mod_status_accepted()}
                </span>
              {:else}
                <span
                  class="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                  style="background: color-mix(in srgb, var(--th-warning, #f59e0b) 15%, transparent); color: var(--th-warning, #f59e0b);"
                >
                  <Loader2 size={9} aria-hidden="true" />
                  {m.modio_mod_status_pending()}
                </span>
              {/if}
              {#if selectedModData.visibility === 1}
                <span class="inline-flex items-center gap-0.5 rounded-full bg-[var(--th-bg-700)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--th-text-400)]">
                  <Eye size={9} aria-hidden="true" />
                  {m.modio_mod_visibility_public()}
                </span>
              {:else}
                <span class="inline-flex items-center gap-0.5 rounded-full bg-[var(--th-bg-700)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--th-text-500)]">
                  <EyeOff size={9} aria-hidden="true" />
                  {m.modio_mod_visibility_hidden()}
                </span>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Description (inline editable) -->
        {#if isEditingDescription}
          <div class="mt-1.5">
            <textarea
              class="w-full resize-none rounded border border-[var(--th-accent,#0ea5e9)] bg-[var(--th-bg-800)] px-2 py-1.5 text-[11px] leading-relaxed text-[var(--th-text-300)] focus:outline-none"
              maxlength={250}
              rows={4}
              bind:value={editDescriptionValue}
              onkeydown={(e) => { if (e.key === "Escape") { cancelEditDescription(); } }}
            ></textarea>
            <div class="flex items-center justify-between mt-1">
              <span class="text-[9px] text-[var(--th-text-500)]" class:text-[var(--th-error,#ef4444)]={editDescriptionValue.length > 250}>
                {editDescriptionValue.length}/250
              </span>
              <div class="flex items-center gap-1.5">
                {#if isSavingDescription}
                  <Loader2 size={10} class="animate-spin text-[var(--th-text-500)]" />
                {/if}
                <button
                  type="button"
                  class="rounded px-2 py-0.5 text-[10px] text-[var(--th-text-400)] hover:bg-[var(--th-bg-700)] transition-colors"
                  onclick={cancelEditDescription}
                >
                  {m.common_cancel()}
                </button>
                <button
                  type="button"
                  class="rounded bg-[var(--th-accent,#0ea5e9)] px-2 py-0.5 text-[10px] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  disabled={isSavingDescription}
                  onclick={saveDescription}
                >
                  {m.common_save()}
                </button>
              </div>
            </div>
          </div>
        {:else}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="modio-description-block mt-1.5" onclick={startEditDescription}>
            {#if selectedModData?.summary}
              <p
                bind:this={summaryEl}
                class="text-[11px] leading-relaxed text-[var(--th-text-400)] {summaryExpanded ? '' : 'line-clamp-3'}"
              >
                {selectedModData.summary}
              </p>
              {#if summaryTruncated || summaryExpanded}
                <button
                  type="button"
                  class="mt-0.5 text-[10px] text-[var(--th-accent,#0ea5e9)] hover:underline"
                  onclick={(e) => { e.stopPropagation(); summaryExpanded = !summaryExpanded; }}
                >
                  {summaryExpanded ? m.modio_show_less() : m.modio_show_more()}
                </button>
              {/if}
            {:else}
              <span class="inline-flex items-center gap-1 text-[11px] italic text-[var(--th-text-500)]">
                <Pencil size={10} />
                Click to add a description…
              </span>
            {/if}
          </div>
        {/if}



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

        <!-- Tags (mod's own tags + inline add, replaces Tags drawer) -->
        <div class="mt-2">
          <ModioTagSection modId={modioStore.selectedModId!} gameId={modioStore.GAME_ID} tags={selectedModData?.tags ?? []} />
        </div>
      </div>
      </div>
    {/if}

    <!-- Resize handle between info and drawers (hidden when all drawers collapsed) -->
    {#if !allDrawersCollapsed}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="modio-resize-handle"
        onmousedown={handleResizeStart}
      ></div>
    {/if}

    <!-- Drawers (ExplorerDrawer pattern – matches Nexus/Git pane) -->
    <div class="modio-drawer-layout" style={allDrawersCollapsed ? 'flex: 0 0 auto' : ''}>
      {#each visibleDrawerIds as drawerId, i (drawerId)}
        <div
          class="modio-drawer-slot"
          class:drawer-collapsed={uiStore.isDrawerCollapsed(drawerId)}
          class:drawer-sized={!uiStore.isDrawerCollapsed(drawerId) && uiStore.explorerDrawers[drawerId]?.height != null}
        >
          {#if drawerId === "modio-file-versions"}
            <ExplorerDrawer id="modio-file-versions" title="File History" isFirst={i === 0} count={fileCount || undefined} allDrawerIds={allModioDrawerIds} drawerTitles={modioDrawerTitles}>
              {#snippet headerActions()}
                <button
                  class="drawer-action-btn"
                  class:active={showUploadForm}
                  title={m.modio_upload_button()}
                  aria-label={m.modio_upload_button()}
                  onclick={(e: MouseEvent) => { e.stopPropagation(); showUploadForm = !showUploadForm; }}
                >
                  <Upload size={14} aria-hidden="true" />
                </button>
              {/snippet}
              {#snippet children()}
                <ModioFileVersions modId={modioStore.selectedModId!} gameId={modioStore.GAME_ID} modUrl={modioStore.selectedModUrl} bind:fileCount={fileCount} />
              {/snippet}
            </ExplorerDrawer>
          {:else if drawerId === "modio-changelog"}
            <ExplorerDrawer id="modio-changelog" title="Changelog" isFirst={i === 0} defaultOpen={false} allDrawerIds={allModioDrawerIds} drawerTitles={modioDrawerTitles}>
              {#snippet children()}
                <ModioChangelog modId={modioStore.selectedModId!} gameId={modioStore.GAME_ID} />
              {/snippet}
            </ExplorerDrawer>
          {:else if drawerId === "modio-media"}
            <ExplorerDrawer id="modio-media" title={m.modio_media_header()} isFirst={i === 0} defaultOpen={false} count={mediaImages.length || undefined} allDrawerIds={allModioDrawerIds} drawerTitles={modioDrawerTitles}>
              {#snippet headerActions()}
                <button
                  class="drawer-action-btn"
                  title={m.modio_refresh()}
                  aria-label={m.modio_refresh()}
                  disabled={isRefreshing}
                  onclick={(e: MouseEvent) => { e.stopPropagation(); handleRefresh(); }}
                >
                  <RefreshCw size={14} class={isRefreshing && !getPrefersReducedMotion() ? "animate-spin" : ""} aria-hidden="true" />
                </button>
                <button
                  class="drawer-action-btn"
                  title={m.modio_add_image()}
                  aria-label={m.modio_add_image()}
                  onclick={(e: MouseEvent) => { e.stopPropagation(); mediaSectionRef?.browseAndAdd(); }}
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
              {/snippet}
              {#snippet children()}
                <ModioMediaSection bind:this={mediaSectionRef} modId={modioStore.selectedModId!} gameId={modioStore.GAME_ID} mediaImages={selectedModData?.media_images ?? []} />
              {/snippet}
            </ExplorerDrawer>
          {:else if drawerId === "modio-dependencies"}
            <ExplorerDrawer id="modio-dependencies" title={m.modio_dependencies_header()} isFirst={i === 0} defaultOpen={false} allDrawerIds={allModioDrawerIds} drawerTitles={modioDrawerTitles}>
              {#snippet headerActions()}
                <button
                  class="drawer-action-btn"
                  class:active={showDepAddForm}
                  title={m.modio_add_dependency()}
                  aria-label={m.modio_add_dependency()}
                  onclick={(e: MouseEvent) => { e.stopPropagation(); showDepAddForm = !showDepAddForm; }}
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
              {/snippet}
              {#snippet children()}
                <ModioDependencies modId={modioStore.selectedModId!} gameId={modioStore.GAME_ID} bind:showAddForm={showDepAddForm} />
              {/snippet}
            </ExplorerDrawer>
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

        <!-- Link by URL/ID (mirrors Nexus pattern) -->
        <div>
          <label for="modio-link-input" class="mb-1 block text-[10px] font-medium text-[var(--th-text-500)]">
            {m.modio_link_mod_input_label()}
          </label>
          <input
            id="modio-link-input"
            type="text"
            class="w-full rounded border border-[var(--th-border-700)] bg-[var(--th-bg-800)] px-2 py-1.5 text-xs text-[var(--th-text-200)] placeholder:text-[var(--th-text-500)] focus:outline-none focus:ring-1 focus:ring-[var(--th-accent,#0ea5e9)]"
            placeholder="https://mod.io/g/baldursgate3/m/… or 12345"
            bind:value={linkInput}
            onkeydown={handleLinkInputKeydown}
            disabled={isLinking}
          />
        </div>

        <button
          type="button"
          class="flex items-center justify-center gap-1.5 rounded bg-[var(--th-accent,#0ea5e9)] px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 disabled:opacity-50"
          onclick={handleLinkMod}
          disabled={isLinking || !linkInput.trim()}
        >
          {#if isLinking}
            <Loader2 size={14} class={getPrefersReducedMotion() ? "" : "animate-spin"} aria-hidden="true" />
          {/if}
          <LinkIcon size={14} aria-hidden="true" />
          {m.modio_link_mod_button()}
        </button>

        {#if linkError}
          <div class="flex items-start gap-1.5 rounded border border-red-800/50 bg-red-950/30 px-2 py-1.5 text-xs text-red-400" role="alert">
            <AlertCircle size={14} class="mt-0.5 shrink-0" />
            <span>{linkError}</span>
          </div>
        {/if}

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
        {#if modioStore.isAuthenticated}
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
            <!-- Suggested matches (name-based) -->
            {#if suggestedMods.length > 0}
              <div>
                <p class="mb-1 text-[10px] font-medium text-[var(--th-accent,#0ea5e9)]">
                  {m.modio_suggested_matches()}
                </p>
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <ul
                  class="flex flex-col gap-0.5"
                  role="listbox"
                  aria-label={m.modio_suggested_matches()}
                  onkeydown={handleModListKeydown}
                >
                  {#each suggestedMods as mod (mod.id)}
                    <li
                      class="group flex items-center justify-between rounded px-2 py-1.5 text-xs cursor-pointer"
                      style="background: color-mix(in srgb, var(--th-accent, #0ea5e9) 8%, transparent); border: 1px solid color-mix(in srgb, var(--th-accent, #0ea5e9) 20%, transparent);"
                      role="option"
                      aria-selected={false}
                      tabindex={0}
                      onclick={() => modioStore.selectMod(mod)}
                      onkeydown={(e: KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          modioStore.selectMod(mod);
                        }
                      }}
                    >
                      <span class="truncate text-[var(--th-text-200)]">{mod.name}</span>
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
              </div>
            {/if}

            <!-- Remaining mods -->
            {#if unsuggestedMods.length > 0}
              {#if suggestedMods.length > 0}
                <p class="mb-1 text-[10px] font-medium text-[var(--th-text-500)]">
                  {m.modio_all_mods()}
                </p>
              {/if}
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <ul
                class="flex flex-col gap-0.5"
                role="listbox"
                aria-label={m.modio_select_mod()}
                onkeydown={handleModListKeydown}
              >
                {#each unsuggestedMods as mod, i (mod.id)}
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
          {/if}
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

<style>
  .modio-drawer-layout {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
    justify-content: flex-end;
    overflow: hidden;
  }

  .modio-drawer-slot {
    position: relative;
    min-height: 0;
    flex: 1 1 0%;
    overflow: hidden;
  }

  .modio-drawer-slot.drawer-collapsed,
  .modio-drawer-slot.drawer-sized {
    flex: 0 0 auto;
  }

  /* Description block */
  .modio-description-block {
    position: relative;
    border-radius: 4px;
    padding: 6px 8px;
    background: var(--th-bg-800, #1e1e2e);
    cursor: pointer;
    transition: background 0.15s;
  }

  .modio-description-block:hover {
    background: var(--th-bg-700, #181825);
  }

  /* Info/drawer resizable split */
  .modio-info-section {
    flex-shrink: 0;
    overflow-y: auto;
    min-height: 80px;
  }

  .modio-resize-handle {
    height: 6px;
    flex-shrink: 0;
    cursor: ns-resize;
    background: var(--th-border-700, #2e2e3e);
    transition: background 0.15s;
    touch-action: none;
  }

  .modio-resize-handle:hover,
  .modio-resize-handle:active {
    background: var(--th-accent, #0ea5e9);
  }

  /* HC adjustments */
  :global(.theme-hcDark) .modio-description-block {
    background: var(--th-bg-900, #000);
    border: 1px solid var(--th-border-600, #6b7280);
  }
  :global(.theme-hcDark) .modio-description-block:hover {
    background: var(--th-bg-800, #1e1e2e);
  }
</style>
