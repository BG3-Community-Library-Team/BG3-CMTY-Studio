<!--
  Search Panel — Provides advanced search across all mod entries.
  Shows recent searches and search results. More powerful than the command palette search.
-->
<script lang="ts">
  import { m } from "../paraglide/messages.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import { readModFile } from "../lib/utils/tauri.js";
  import Search from "@lucide/svelte/icons/search";
  import X from "@lucide/svelte/icons/x";
  import Clock from "@lucide/svelte/icons/clock";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import FileText from "@lucide/svelte/icons/file-text";

  let query = $state("");
  let inputEl: HTMLInputElement | undefined = $state(undefined);
  let caseSensitive = $state(false);
  let matchWholeWord = $state(false);
  let sectionFilter = $state("");
  let filesInclude = $state(uiStore.searchFilesInclude || "");

  // Watch for external changes (from Find in Folder)
  $effect(() => {
    if (uiStore.searchFilesInclude) {
      filesInclude = uiStore.searchFilesInclude;
      uiStore.searchFilesInclude = "";
    }
  });

  /** Recent search terms (persisted in memory for session) */
  let recentSearches: string[] = $state([]);
  const MAX_RECENT = 10;

  interface SearchResult {
    section: string;
    uuid: string;
    displayName: string;
    matchField: string;
    matchValue: string;
  }

  let results = $derived.by((): SearchResult[] => {
    if (!query.trim() || !modStore.scanResult) return [];
    const q = caseSensitive ? query.trim() : query.trim().toLowerCase();
    const sf = sectionFilter;
    const items: SearchResult[] = [];
    const MAX_RESULTS = 100;

    for (const sec of modStore.scanResult.sections) {
      if (sf && sec.section !== sf) continue;
      for (const entry of sec.entries) {
        if (items.length >= MAX_RESULTS) break;
        const dn = entry.display_name ?? entry.uuid;
        const dnCmp = caseSensitive ? dn : dn.toLowerCase();
        const uuidCmp = caseSensitive ? entry.uuid : entry.uuid.toLowerCase();

        const wordMatch = (haystack: string, needle: string) =>
          matchWholeWord
            ? new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, caseSensitive ? '' : 'i').test(haystack)
            : haystack.includes(needle);

        // Check display name
        if (wordMatch(dnCmp, q)) {
          items.push({ section: sec.section, uuid: entry.uuid, displayName: dn, matchField: "Name", matchValue: dn });
          continue;
        }
        // Check UUID
        if (wordMatch(uuidCmp, q)) {
          items.push({ section: sec.section, uuid: entry.uuid, displayName: dn, matchField: "UUID", matchValue: entry.uuid });
          continue;
        }
        // Check changes
        if (entry.changes) {
          let found = false;
          for (const change of entry.changes) {
            const fld = caseSensitive ? (change.field ?? "") : (change.field ?? "").toLowerCase();
            const mv = caseSensitive ? (change.mod_value ?? "") : (change.mod_value ?? "").toLowerCase();
            const vv = caseSensitive ? (change.vanilla_value ?? "") : (change.vanilla_value ?? "").toLowerCase();
            if (wordMatch(fld, q) || wordMatch(mv, q) || wordMatch(vv, q)) {
              items.push({ section: sec.section, uuid: entry.uuid, displayName: dn, matchField: change.field ?? "field", matchValue: change.mod_value ?? "" });
              found = true;
              break;
            }
          }
          if (found) continue;
        }
        // Check raw_attributes
        if (entry.raw_attributes) {
          for (const [key, val] of Object.entries(entry.raw_attributes)) {
            const valCmp = caseSensitive ? val : (typeof val === "string" ? val.toLowerCase() : "");
            if (wordMatch(valCmp, q)) {
              items.push({ section: sec.section, uuid: entry.uuid, displayName: dn, matchField: key, matchValue: typeof val === "string" ? val : "" });
              break;
            }
          }
        }
      }
      if (items.length >= MAX_RESULTS) break;
    }
    return items;
  });

  /** Group results by section for display */
  let groupedResults = $derived.by(() => {
    const groups = new Map<string, SearchResult[]>();
    for (const r of results) {
      const arr = groups.get(r.section) ?? [];
      arr.push(r);
      groups.set(r.section, arr);
    }
    return groups;
  });

  /** Available sections for filter dropdown */
  let availableSections = $derived(
    modStore.scanResult?.sections.map(s => s.section) ?? []
  );

  function doSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;
    // Add to recent (deduplicate, most recent first)
    recentSearches = [trimmed, ...recentSearches.filter(s => s !== trimmed)].slice(0, MAX_RECENT);
  }

  function applyRecent(term: string) {
    query = term;
    doSearch();
  }

  function removeRecent(term: string) {
    recentSearches = recentSearches.filter(s => s !== term);
  }

  function clearRecent() {
    recentSearches = [];
  }

  function navigateToResult(result: SearchResult) {
    // Open the entry in the editor via tab navigation
    uiStore.activeView = "explorer";
    // The entry can be found in the section panel; for now just switch to explorer view
    // Future: open the specific entry in EditorTabs
  }

  // ── File content search ──
  interface FileSearchResult {
    filePath: string;
    fileName: string;
    lineNumber: number;
    lineText: string;
    extension: string;
  }

  let fileResults: FileSearchResult[] = $state([]);
  let isSearchingFiles = $state(false);
  let fileSearchVersion = 0;

  function navigateToFileResult(result: FileSearchResult) {
    uiStore.openTab({
      id: `file:${result.filePath}`,
      label: result.fileName,
      type: "file-preview",
      filePath: result.filePath,
      icon: "📄",
      preview: false,
    });
    uiStore.activeView = "explorer";
  }

  // Search file contents when query changes (async, debounced)
  $effect(() => {
    const q = query.trim();
    const cs = caseSensitive;
    const ww = matchWholeWord;
    const modPath = modStore.selectedModPath;
    const files = modStore.modFiles;
    const includeFilter = filesInclude;

    if (!q || !modPath || files.length === 0) {
      fileResults = [];
      return;
    }

    const version = ++fileSearchVersion;
    isSearchingFiles = true;

    // Search files with a small delay to avoid spamming during typing
    const timer = setTimeout(async () => {
      const found: FileSearchResult[] = [];
      const MAX_FILE_RESULTS = 50;

      for (const file of files) {
        if (found.length >= MAX_FILE_RESULTS) break;
        if (includeFilter && !file.rel_path.startsWith(includeFilter)) continue;
        try {
          const content = await readModFile(modPath, file.rel_path);
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (found.length >= MAX_FILE_RESULTS) break;
            const line = lines[i];
            const haystack = cs ? line : line.toLowerCase();
            const needle = cs ? q : q.toLowerCase();
            const matched = ww
              ? new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, cs ? '' : 'i').test(line)
              : haystack.includes(needle);
            if (matched) {
              found.push({
                filePath: file.rel_path,
                fileName: file.rel_path.split("/").pop() ?? file.rel_path,
                lineNumber: i + 1,
                lineText: line.trim().substring(0, 120),
                extension: file.extension,
              });
            }
          }
        } catch {
          // Skip unreadable files
        }
      }

      if (version === fileSearchVersion) {
        fileResults = found;
        isSearchingFiles = false;
      }
    }, 300);

    return () => clearTimeout(timer);
  });

  $effect(() => {
    if (inputEl) {
      inputEl.focus();
    }
  });
</script>

<div class="flex flex-col h-full text-[var(--th-text-200)]">
  <!-- Search form -->
  <div class="p-3 space-y-2 border-b border-[var(--th-border-800,var(--th-bg-700))]">
    <div class="relative">
      <input
        bind:this={inputEl}
        type="text"
        bind:value={query}
        placeholder={m.search_entries_placeholder()}
        class="w-full bg-[var(--th-bg-800)] border border-[var(--th-border-600)] rounded
               px-3 py-1.5 pl-8 text-sm text-[var(--th-text-100)] placeholder-[var(--th-text-500)]
               focus:border-[var(--th-accent-500,#0ea5e9)]"
        onkeydown={(e) => {
          if (e.key === "Enter") doSearch();
          if (e.key === "Escape") { query = ""; }
        }}
        aria-label={m.search_entries_aria()}
      />
      <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--th-text-500)] pointer-events-none" strokeWidth={2.5} />
      {#if query}
        <button
          class="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--th-text-500)] hover:text-[var(--th-text-200)] p-1.5"
          onclick={() => query = ""}
          aria-label={m.search_clear_aria()}
        ><X size={12} /></button>
      {/if}
    </div>

    <!-- Search options row -->
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--th-text-400)]">
      <label class="flex items-center gap-1 cursor-pointer select-none whitespace-nowrap">
        <input type="checkbox" bind:checked={caseSensitive} class="w-3 h-3 rounded" />
        {m.search_match_case()}
      </label>
      <label class="flex items-center gap-1 cursor-pointer select-none whitespace-nowrap">
        <input type="checkbox" bind:checked={matchWholeWord} class="w-3 h-3 rounded" />
        {m.search_whole_word()}
      </label>
      {#if availableSections.length > 0}
        <select
          bind:value={sectionFilter}
          class="bg-[var(--th-bg-800)] border border-[var(--th-border-600)] rounded px-1 py-0.5 text-[10px] text-[var(--th-text-300)] min-w-0 max-w-full"
        >
          <option value="">{m.search_all_sections()}</option>
          {#each availableSections as sec}
            <option value={sec}>{sec}</option>
          {/each}
        </select>
      {/if}
    </div>

    <!-- Files to include filter -->
    <div class="search-filter-row">
      <label class="search-filter-label" for="files-include">Files to include</label>
      <input
        id="files-include"
        type="text"
        class="search-filter-input"
        bind:value={filesInclude}
        placeholder="e.g. Mods/MyMod/ScriptExtender/"
      />
    </div>
  </div>

  <!-- Content area -->
  <div class="flex-1 overflow-y-auto scrollbar-thin">
    {#if query.trim() && (results.length > 0 || fileResults.length > 0 || isSearchingFiles)}
      <!-- Search results -->
      <div class="p-2 space-y-1">
        {#if results.length > 0}
          <div class="text-[10px] text-[var(--th-text-500)] px-1 mb-1">{results.length !== 1 ? m.search_results_count({ count: results.length.toString() }) : m.search_results_one()}{results.length >= 100 ? '+' : ''}</div>
          {#each [...groupedResults] as [section, sectionResults]}
            <div class="mb-2">
              <div class="text-[10px] font-semibold text-[var(--th-text-400)] uppercase tracking-wider px-1 py-0.5">{section}</div>
              {#each sectionResults as result}
                <button
                  class="w-full text-left px-2 py-1 rounded text-xs hover:bg-[var(--th-bg-700)] flex items-center gap-1.5 group"
                  onclick={() => navigateToResult(result)}
                >
                  <ChevronRight size={10} class="text-[var(--th-text-600)] shrink-0" />
                  <span class="truncate text-[var(--th-text-200)]">{result.displayName}</span>
                  <span class="text-[9px] text-[var(--th-text-500)] shrink-0 ml-auto">{result.matchField}</span>
                </button>
              {/each}
            </div>
          {/each}
        {/if}

        {#if fileResults.length > 0}
          <div class="mt-3 pt-2 border-t border-[var(--th-border-700)]">
            <div class="text-[10px] text-[var(--th-text-500)] px-1 mb-1">{fileResults.length !== 1 ? m.search_file_matches({ count: fileResults.length.toString() }) : m.search_file_match_one()}{fileResults.length >= 50 ? '+' : ''}</div>
            {#each fileResults as fResult}
              <button
                class="w-full text-left px-2 py-1 rounded text-xs hover:bg-[var(--th-bg-700)] flex flex-col gap-0.5"
                onclick={() => navigateToFileResult(fResult)}
              >
                <div class="flex items-center gap-1.5">
                  <FileText size={10} class="text-[var(--th-text-500)] shrink-0" />
                  <span class="truncate text-[var(--th-text-200)]">{fResult.fileName}</span>
                  <span class="text-[9px] text-[var(--th-text-600)] shrink-0 ml-auto">L{fResult.lineNumber}</span>
                </div>
                <div class="text-[10px] text-[var(--th-text-500)] truncate pl-4">{fResult.lineText}</div>
              </button>
            {/each}
          </div>
        {/if}

        {#if isSearchingFiles && fileResults.length === 0}
          <div class="text-[10px] text-[var(--th-text-500)] px-1 mt-2">{m.search_searching_files()}</div>
        {/if}
      </div>
    {:else if query.trim() && modStore.scanResult}
      <div class="p-4 text-xs text-[var(--th-text-500)] text-center">{m.search_no_results()}</div>
    {:else if !modStore.scanResult}
      <div class="p-4 text-xs text-[var(--th-text-500)] text-center">{m.search_load_mod()}</div>
    {:else}
      <!-- Recent searches (shown when no active query) -->
      {#if recentSearches.length > 0}
        <div class="p-2">
          <div class="flex items-center justify-between px-1 mb-1">
            <span class="text-[10px] font-semibold text-[var(--th-text-400)] uppercase tracking-wider">{m.search_recent_header()}</span>
            <button
              class="text-[10px] text-[var(--th-text-500)] hover:text-[var(--th-text-200)]"
              onclick={clearRecent}
            >{m.search_clear_recent()}</button>
          </div>
          {#each recentSearches as term}
            <div class="flex items-center gap-1 group">
              <button
                class="flex-1 text-left px-2 py-1 rounded text-xs hover:bg-[var(--th-bg-700)] flex items-center gap-1.5"
                onclick={() => applyRecent(term)}
              >
                <Clock size={10} class="text-[var(--th-text-600)] shrink-0" />
                <span class="truncate text-[var(--th-text-300)]">{term}</span>
              </button>
              <button
                class="text-[var(--th-text-600)] hover:text-[var(--th-text-300)] p-1.5 opacity-0 group-hover:opacity-100"
                onclick={() => removeRecent(term)}
                aria-label={m.search_remove_recent_aria()}
              ><X size={10} /></button>
            </div>
          {/each}
        </div>
      {:else}
        <div class="p-4 text-xs text-[var(--th-text-500)] text-center">{m.search_type_hint()}</div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .search-filter-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 8px;
  }
  .search-filter-label {
    font-size: 10px;
    color: var(--th-text-500);
    text-transform: uppercase;
  }
  .search-filter-input {
    background: var(--th-bg-700);
    border: 1px solid var(--th-border-700);
    border-radius: 3px;
    color: var(--th-text-200);
    font-size: 11px;
    padding: 3px 6px;
  }
</style>
