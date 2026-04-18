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
    <div role="list" class="overflow-y-auto px-3 pb-3 pt-1">
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
            <div class="flex flex-col gap-1 pt-1">
              {#each files as ver (ver.id)}
                <div
                  role="listitem"
                  class="rounded border border-[var(--th-border-700)] bg-[var(--th-bg-800)] px-2 py-1.5 text-[10px]"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex min-w-0 flex-col gap-0.5">
                      <div class="flex items-center gap-1.5">
                        <span class="truncate font-medium text-[var(--th-text-200)]">{ver.name}</span>
                        <span class="shrink-0 text-[var(--th-text-500)]">v{ver.version}</span>
                      </div>
                      <span class="truncate text-[var(--th-text-500)]">
                        {#if ver.size_kb}{ver.size_kb} KB{/if}
                        {#if ver.size_kb && ver.created_at} · {/if}
                        {#if ver.created_at}{ver.created_at}{/if}
                      </span>
                    </div>

                    <div class="flex shrink-0 items-center gap-0.5">
                      {#if ver.description}
                        <button
                          onclick={() => toggleDescription(ver.id)}
                          aria-label={expandedDescriptions.has(ver.id) ? m.nexus_file_hide_description() : m.nexus_file_show_description()}
                          class="rounded p-0.5 text-[var(--th-text-500)] hover:bg-[var(--th-bg-700)] hover:text-[var(--th-text-200)]"
                          class:text-[var(--th-accent,#0ea5e9)]={expandedDescriptions.has(ver.id)}
                        >
                          <FileText size={11} />
                        </button>
                      {/if}
                      {#if ver.changelog_html}
                        <button
                          onclick={() => toggleChangelog(ver.id)}
                          aria-label={m.nexus_file_changelog()}
                          class="rounded p-0.5 text-[var(--th-text-500)] hover:bg-[var(--th-bg-700)] hover:text-[var(--th-text-200)]"
                          class:text-[var(--th-accent,#0ea5e9)]={expandedChangelogs.has(ver.id)}
                        >
                          <FileText size={11} />
                        </button>
                      {/if}
                      <button
                        onclick={() => openUrl(downloadUrl(ver.id))}
                        aria-label={m.nexus_file_download()}
                        class="rounded p-0.5 text-[var(--th-text-500)] hover:bg-[var(--th-bg-700)] hover:text-[var(--th-text-200)]"
                      >
                        <Download size={11} />
                      </button>
                      {#if onupdatefile}
                        <button
                          onclick={() => onupdatefile?.(ver)}
                          aria-label={m.nexus_file_update()}
                          class="rounded p-0.5 text-[var(--th-text-500)] hover:bg-[var(--th-bg-700)] hover:text-[var(--th-text-200)]"
                        >
                          <Upload size={11} />
                        </button>
                      {/if}
                    </div>
                  </div>

                  {#if expandedDescriptions.has(ver.id) && ver.description}
                    <div class="mt-1 rounded bg-[var(--th-bg-700)] px-2 py-1 text-[9px] text-[var(--th-text-300)] whitespace-pre-wrap">
                      {ver.description}
                    </div>
                  {/if}

                  {#if expandedChangelogs.has(ver.id) && ver.changelog_html}
                    <div class="file-entry-changelog mt-1 rounded bg-[var(--th-bg-700)] px-2 py-1 text-[9px] text-[var(--th-text-300)]">
                      {@html ver.changelog_html}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
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
    padding: 4px 0;
    font-size: 11px;
    color: var(--th-text-300);
    cursor: pointer;
    user-select: none;
  }
  .file-category-header:hover {
    color: var(--th-text-200);
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
