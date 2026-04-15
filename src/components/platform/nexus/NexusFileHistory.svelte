<!-- NexusFileHistory — File version history drawer. Shows all files (v1) or per-group (v3). -->
<script lang="ts">
  import { m } from "../../../paraglide/messages.js";
  import { nexusStore } from "../../../lib/stores/nexusStore.svelte.js";
  import { nexusGetFileVersions, nexusGetAllModFiles, type NexusFileVersion } from "../../../lib/tauri/nexus.js";
  import { open as shellOpen } from "@tauri-apps/plugin-shell";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Download from "@lucide/svelte/icons/download";
  import FileText from "@lucide/svelte/icons/file-text";
  import Upload from "@lucide/svelte/icons/upload";

  let {
    modUuid,
    fileGroupId,
    fileCount = $bindable(0),
    onupdatefile,
  }: {
    modUuid: string;
    fileGroupId: string | null;
    fileCount?: number;
    onupdatefile?: (file: NexusFileVersion) => void;
  } = $props();

  let versions: NexusFileVersion[] = $state([]);
  let isLoading = $state(false);
  let loadError: string | null = $state(null);
  let collapsedCategories: Record<string, boolean> = $state({ Old: true, Archived: true });
  let expandedDescriptions: Set<string> = $state(new Set());
  let expandedChangelogs: Set<string> = $state(new Set());

  $effect(() => { fileCount = versions.length; });

  /** Canonical category order. Unlisted categories sort after these. */
  const CATEGORY_ORDER = ["Main", "Optional", "Miscellaneous", "Old", "Archived"];

  /** Group versions by category, sorted newest-first within each group. */
  let groupedVersions = $derived.by(() => {
    const groups = new Map<string, NexusFileVersion[]>();
    for (const v of versions) {
      const cat = v.category ?? "Uncategorized";
      let arr = groups.get(cat);
      if (!arr) { arr = []; groups.set(cat, arr); }
      arr.push(v);
    }
    for (const arr of groups.values()) {
      arr.sort((a, b) => {
        if (a.created_at && b.created_at) return b.created_at.localeCompare(a.created_at);
        return b.id.localeCompare(a.id);
      });
    }
    return [...groups.entries()].sort(([a], [b]) => {
      const ia = CATEGORY_ORDER.indexOf(a);
      const ib = CATEGORY_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  });

  function toggleCategory(cat: string) {
    collapsedCategories[cat] = !collapsedCategories[cat];
  }

  function toggleDescription(fileId: string) {
    const next = new Set(expandedDescriptions);
    if (next.has(fileId)) next.delete(fileId);
    else next.add(fileId);
    expandedDescriptions = next;
  }

  function toggleChangelog(fileId: string) {
    const next = new Set(expandedChangelogs);
    if (next.has(fileId)) next.delete(fileId);
    else next.add(fileId);
    expandedChangelogs = next;
  }

  /** Build Nexus download URL. */
  function downloadUrl(fileId: string): string {
    return `https://www.nexusmods.com/${nexusStore.gameDomain}/mods/${nexusStore.modId}?tab=files&file_id=${fileId}`;
  }

  async function openUrl(url: string) {
    try { await shellOpen(url); }
    catch { window.open(url, "_blank", "noopener,noreferrer"); }
  }

  /** The selected file group's metadata (from the already-loaded file groups). */
  let selectedGroup = $derived(
    fileGroupId
      ? nexusStore.fileGroups.find(g => g.id === fileGroupId) ?? null
      : null
  );

  // Fetch file versions: use v1 for all files, v3 for specific group
  $effect(() => {
    const gid = fileGroupId;
    const numericModId = nexusStore.modId ? Number(nexusStore.modId) : null;

    isLoading = true;
    loadError = null;

    const promise = gid
      ? nexusGetFileVersions(gid)
      : numericModId
        ? nexusGetAllModFiles(numericModId)
        : Promise.resolve([]);

    promise
      .then(v => { versions = v; })
      .catch(e => { loadError = e instanceof Error ? e.message : String(e); versions = []; })
      .finally(() => { isLoading = false; });
  });
</script>

<div class="nexus-drawer-content">
  {#if isLoading}
    <div class="px-3 py-4 text-xs text-[var(--th-text-500)]">Loading…</div>
  {:else if loadError}
    <div class="px-3 py-2 text-xs text-red-400">{loadError}</div>
  {:else if versions.length === 0}
    <p class="px-3 py-4 text-xs text-[var(--th-text-500)] italic">
      {m.nexus_file_history_empty()}
    </p>
  {:else}
    <div role="list" class="overflow-y-auto">
      {#each groupedVersions as [category, files] (category)}
        <div class="file-category-group">
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="file-category-header"
            onclick={() => toggleCategory(category)}
            onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCategory(category); } }}
            tabindex="0"
            role="button"
            aria-expanded={!collapsedCategories[category]}
          >
            <span class="file-category-chevron" class:collapsed={collapsedCategories[category]}>
              <ChevronRight size={12} />
            </span>
            <span class="font-medium">{category}</span>
            <span class="file-category-count">{files.length}</span>
          </div>
          {#if !collapsedCategories[category]}
            {#each files as ver (ver.id)}
              <div role="listitem" class="file-entry">
                <div class="file-entry-body">
                  <!-- Left: info -->
                  <div class="flex-1 min-w-0">
                    <span class="font-medium text-[var(--th-text-200)] truncate block text-xs">{ver.name}</span>
                    <!-- Date + size + description toggle on same row -->
                    <div class="file-entry-meta">
                      {#if ver.created_at}
                        <span>{ver.created_at}</span>
                      {/if}
                      {#if ver.size_kb}
                        <span>{ver.size_kb} KB</span>
                      {/if}
                      {#if ver.description}
                        <button
                          type="button"
                          class="file-meta-link"
                          onclick={() => toggleDescription(ver.id)}
                        >
                          {expandedDescriptions.has(ver.id) ? m.nexus_file_hide_description() : m.nexus_file_show_description()}
                        </button>
                      {/if}
                    </div>
                  </div>
                  <!-- Right: version + hover actions -->
                  <div class="file-entry-right">
                    <span class="file-entry-version">v{ver.version}</span>
                    <div class="file-entry-actions">
                      {#if ver.changelog_html}
                        <button
                          type="button"
                          class="file-action-btn"
                          class:file-action-active={expandedChangelogs.has(ver.id)}
                          title={m.nexus_file_changelog()}
                          aria-label={m.nexus_file_changelog()}
                          onclick={() => toggleChangelog(ver.id)}
                        >
                          <FileText size={12} />
                        </button>
                      {/if}
                      <button
                        type="button"
                        class="file-action-btn"
                        title={m.nexus_file_download()}
                        aria-label={m.nexus_file_download()}
                        onclick={() => openUrl(downloadUrl(ver.id))}
                      >
                        <Download size={12} />
                      </button>
                      {#if onupdatefile}
                        <button
                          type="button"
                          class="file-action-btn"
                          title={m.nexus_file_update()}
                          aria-label={m.nexus_file_update()}
                          onclick={() => onupdatefile?.(ver)}
                        >
                          <Upload size={12} />
                        </button>
                      {/if}
                    </div>
                  </div>
                </div>
                <!-- Expanded description -->
                {#if expandedDescriptions.has(ver.id) && ver.description}
                  <p class="file-entry-expand">{ver.description}</p>
                {/if}
                <!-- Expanded changelog -->
                {#if expandedChangelogs.has(ver.id) && ver.changelog_html}
                  <div class="file-entry-expand file-entry-changelog">{@html ver.changelog_html}</div>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .file-category-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    font-size: 11px;
    color: var(--th-text-300);
    background: var(--th-bg-800);
    border-bottom: 1px solid var(--th-border-700);
    cursor: pointer;
    user-select: none;
  }
  .file-category-header:hover {
    background: var(--th-bg-700);
  }
  .file-category-chevron {
    display: inline-flex;
    transition: transform 0.15s ease;
    transform: rotate(90deg);
  }
  .file-category-chevron.collapsed {
    transform: rotate(0deg);
  }
  .file-category-count {
    margin-left: auto;
    font-size: 10px;
    color: var(--th-text-500);
  }

  /* ── File entry ── */
  .file-entry {
    border-bottom: 1px solid var(--th-border-700);
    padding: 6px 12px;
    font-size: 12px;
  }
  .file-entry:last-child {
    border-bottom: 0;
  }
  .file-entry-body {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  /* Meta row: date + size + description toggle */
  .file-entry-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 2px;
    font-size: 10px;
    color: var(--th-text-500);
  }
  .file-meta-link {
    padding: 0;
    border: none;
    background: none;
    color: var(--th-accent, #0ea5e9);
    font-size: 10px;
    cursor: pointer;
  }
  .file-meta-link:hover {
    text-decoration: underline;
  }

  /* Right column: version visible by default, actions on hover */
  .file-entry-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex-shrink: 0;
  }
  .file-entry-version {
    font-size: 10px;
    color: var(--th-text-500);
  }
  .file-entry-actions {
    display: none;
    gap: 2px;
  }
  .file-entry:hover .file-entry-actions {
    display: flex;
  }
  .file-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--th-text-500);
    cursor: pointer;
    padding: 0;
  }
  .file-action-btn:hover {
    background: var(--th-bg-600);
    color: var(--th-text-200);
  }
  .file-action-active {
    color: var(--th-accent, #0ea5e9);
  }

  /* Expanded content (description & changelog) */
  .file-entry-expand {
    margin-top: 4px;
    padding: 4px 0;
    font-size: 11px;
    line-height: 1.4;
    color: var(--th-text-400);
    white-space: pre-wrap;
    word-break: break-word;
  }
  .file-entry-changelog {
    white-space: normal;
    border-top: 1px solid var(--th-border-700);
    padding-top: 6px;
  }
  /* Sanitize changelog HTML styles */
  .file-entry-changelog :global(ul) {
    padding-left: 16px;
    margin: 2px 0;
    list-style: disc;
  }
  .file-entry-changelog :global(ol) {
    padding-left: 16px;
    margin: 2px 0;
  }
  .file-entry-changelog :global(p) {
    margin: 2px 0;
  }
  .file-entry-changelog :global(a) {
    color: var(--th-accent, #0ea5e9);
  }
</style>
