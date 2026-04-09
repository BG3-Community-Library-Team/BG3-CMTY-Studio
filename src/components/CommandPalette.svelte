<!--
  PF-034: Command Palette with Tree Navigation, Fuzzy Search + Entry Search.
  Activated by Ctrl+Shift+P / Ctrl+K.  Provides instant access to every
  application action, setting, and navigation target.

  Uses a VS Code-style tree navigation model:
  - Root level shows: Scan & Load (if no mod), Recent (if mod loaded),
    then navigable category entries (Actions >, Loaded Data >, Settings >, Help >)
  - Selecting a category drills down to show its commands, with a
    "← Back" entry at the top
  - # prefix filters by section: "ShadarKai #Races" or "#Progressions Wizard"
  - Search results appear inline beneath matching commands when typing
  - Search filters entries by ALL fields (uuid, display_name, field values in changes)

  The dropdown connects directly to the titlebar trigger (no gap, no top rounding).
  In Balance theme, the active palette always uses dark mode styling.

  Disabled commands are hidden — never shown even in search.
-->
<script lang="ts">
  import { commandRegistry, PALETTE_CATEGORIES, CATEGORY_LABELS, type Command, type CommandCategory } from "../lib/utils/commandRegistry.svelte.js";
  import { fuzzyScore, type FuzzyResult } from "../lib/utils/fuzzyScore.js";
  import { m } from "../paraglide/messages.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import { APP_NAME } from "../lib/version.js";
  import Search from "@lucide/svelte/icons/search";
  import X from "@lucide/svelte/icons/x";
  import Clock from "@lucide/svelte/icons/clock";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import FilePlus2 from "@lucide/svelte/icons/file-plus-2";
  import MapPin from "@lucide/svelte/icons/map-pin";
  import { focusTrap } from "../lib/utils/focusTrap.js";

  let { open = $bindable(false) }: { open?: boolean } = $props();

  let query = $state("");
  let activeIndex = $state(0);
  let inputEl: HTMLInputElement | undefined = $state(undefined);

  /** Current category drill-down (null = root) */
  let activeCategory: CommandCategory | null = $state(null);

  /** Whether a mod is currently loaded */
  let hasModLoaded = $derived(!!modStore.scanResult);

  interface ScoredCommand {
    command: Command;
    fuzzy: FuzzyResult;
  }

  // Parse plugin prefix filter: ">git:" filters commands by id prefix "git:"
  let pluginPrefix = $derived.by(() => {
    const match = query.match(/^>(\S+)/);
    return match ? match[1] : "";
  });

  // Parse section filter: "#SectionName" anywhere in query
  let sectionFilter = $derived.by(() => {
    const match = query.match(/#(\S+)/);
    return match ? match[1].toLowerCase() : "";
  });

  // Search text is query without the #section or >prefix portions
  let searchText = $derived(query.replace(/#\S*/g, "").replace(/^>\S*\s*/, "").trim());

  // Debounced search text for expensive entry search (120ms delay)
  let debouncedSearchText = $state("");
  let _searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    const text = searchText;
    if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer);
    if (!text) {
      debouncedSearchText = "";
      return;
    }
    _searchDebounceTimer = setTimeout(() => { debouncedSearchText = text; }, 120);
    return () => { if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer); };
  });

  // Available sections from scan result for filter pills
  let availableSections = $derived.by((): string[] => {
    if (!modStore.scanResult) return [];
    return modStore.scanResult.sections
      .filter(s => s.entries.length > 0)
      .map(s => s.section);
  });

  // Entry search results (appear when typing, regardless of #)
  // Searches ALL fields: display_name, uuid, and change field values
  interface EntrySearchResult {
    section: string;
    uuid: string;
    displayName: string;
  }
  let entryResults = $derived.by((): EntrySearchResult[] => {
    if (!debouncedSearchText || !modStore.scanResult) return [];
    const q = debouncedSearchText.toLowerCase();
    const sf = sectionFilter;
    const results: EntrySearchResult[] = [];
    const MAX_RESULTS = 20;
    for (const sec of modStore.scanResult.sections) {
      if (sf && !sec.section.toLowerCase().includes(sf)) continue;
      for (const entry of sec.entries) {
        if (results.length >= MAX_RESULTS) break;
        const dn = entry.display_name ?? entry.uuid;
        // Check display name and UUID
        let matches = dn.toLowerCase().includes(q) || entry.uuid.toLowerCase().includes(q);
        // Also search within change field values (new_value, old_value, field name)
        if (!matches && entry.changes) {
          for (const change of entry.changes) {
            if (change.field?.toLowerCase().includes(q) ||
                change.mod_value?.toLowerCase().includes(q) ||
                change.vanilla_value?.toLowerCase().includes(q)) {
              matches = true;
              break;
            }
          }
        }
        // Also search raw_attributes if present
        if (!matches && entry.raw_attributes) {
          for (const [_key, val] of Object.entries(entry.raw_attributes)) {
            if (typeof val === "string" && val.toLowerCase().includes(q)) {
              matches = true;
              break;
            }
          }
        }
        if (matches) {
          results.push({ section: sec.section, uuid: entry.uuid, displayName: dn });
        }
      }
      if (results.length >= MAX_RESULTS) break;
    }
    return results;
  });

  // Recent commands (only enabled) — hidden when no mod loaded
  let recentCommands = $derived(hasModLoaded ? commandRegistry.getRecent() : []);

  // All enabled commands (disabled commands are never shown)
  let enabledCommands = $derived(commandRegistry.getEnabled());

  // Filtered command results — only when searching
  let commandResults = $derived.by((): ScoredCommand[] => {
    if (!searchText && !pluginPrefix) return [];
    let commands = enabledCommands;

    // If plugin prefix is active, filter by command id prefix
    if (pluginPrefix) {
      commands = commands.filter(c => c.id.startsWith(pluginPrefix));
    }

    // If in a category, only show that category's commands
    if (activeCategory) {
      commands = commands.filter(c => c.category === activeCategory);
    }

    if (!searchText) {
      // No text search, just return all matching plugin-prefix commands
      return commands.map(cmd => ({ command: cmd, fuzzy: { score: 0, matches: [] } }));
    }

    const scored: ScoredCommand[] = [];
    for (const cmd of commands) {
      const result = fuzzyScore(searchText, cmd.label);
      if (result) scored.push({ command: cmd, fuzzy: result });
    }
    scored.sort((a, b) => b.fuzzy.score - a.fuzzy.score);
    return scored;
  });

  // Commands for current category drill-down (when browsing, not searching)
  let categoryCommands = $derived.by((): Command[] => {
    if (!activeCategory || searchText) return [];
    return commandRegistry.getEnabledByCategory(activeCategory);
  });

  // Determine if search-all-entries action should appear
  let showSearchAllAction = $derived(!!searchText && !!modStore.scanResult && !pluginPrefix);

  // Build the flat navigable items list for keyboard navigation
  interface NavItem {
    type: "search-all" | "command" | "scored-command" | "category" | "back" | "entry-result" | "recent" | "scan-prompt" | "form-nav";
    command?: Command;
    scored?: ScoredCommand;
    category?: CommandCategory;
    entry?: EntrySearchResult;
    formSection?: { id: string; label: string };
  }
  let navItems = $derived.by((): NavItem[] => {
    const items: NavItem[] = [];

    // Plugin prefix mode: show only matching commands (no categories/recent)
    if (pluginPrefix) {
      for (const sc of commandResults) {
        items.push({ type: searchText ? "scored-command" : "command", scored: searchText ? sc : undefined, command: sc.command });
      }
      return items;
    }

    if (searchText) {
      // Searching mode: show search-all, matching commands, then entry results
      if (showSearchAllAction) {
        items.push({ type: "search-all" });
      }
      for (const sc of commandResults) {
        items.push({ type: "scored-command", scored: sc, command: sc.command });
      }
      // Also search form sections
      for (const sec of uiStore.formNavSections) {
        const result = fuzzyScore(searchText, sec.label);
        if (result) {
          items.push({ type: "form-nav", formSection: sec });
        }
      }
      for (const entry of entryResults) {
        items.push({ type: "entry-result", entry });
      }
    } else if (activeCategory) {
      // Drilled into a category: show back + category commands
      items.push({ type: "back" });
      for (const cmd of categoryCommands) {
        items.push({ type: "command", command: cmd });
      }
    } else {
      // Root browsing

      // If no mod loaded, show Open Project & Create New Project prominently
      if (!hasModLoaded) {
        const scanCmd = enabledCommands.find(c => c.id === "action.openAndScan");
        if (scanCmd) {
          items.push({ type: "scan-prompt", command: scanCmd });
        }
        const createCmd = enabledCommands.find(c => c.id === "action.createNewMod");
        if (createCmd) {
          items.push({ type: "scan-prompt", command: createCmd });
        }
      } else {
        // Mod is loaded: show search-all-entries action first
        const searchAllCmd = enabledCommands.find(c => c.id === "action.searchEntries");
        if (searchAllCmd) {
          items.push({ type: "command", command: searchAllCmd });
        }
      }

      // Form navigation sections (when a manual entry form is open)
      for (const sec of uiStore.formNavSections) {
        items.push({ type: "form-nav", formSection: sec });
      }

      // Categories (shown before recent commands)
      for (const cat of PALETTE_CATEGORIES) {
        // Only show categories that have at least one enabled command
        const catCmds = commandRegistry.getEnabledByCategory(cat);
        if (catCmds.length > 0) {
          items.push({ type: "category", category: cat });
        }
      }

      // Recent commands (after categories, only when mod loaded)
      for (const cmd of recentCommands) {
        items.push({ type: "recent", command: cmd });
      }
    }
    return items;
  });

  let totalNavigableItems = $derived(navItems.length);

  function closePalette() {
    open = false;
    query = "";
    activeCategory = null;
  }

  function execute(cmd: Command) {
    if (!cmd.enabled()) return;
    commandRegistry.recordRecent(cmd.id);
    closePalette();
    cmd.execute();
  }

  function selectEntry(result: EntrySearchResult) {
    modStore.setGlobalFilter(result.uuid);
    closePalette();
  }

  function searchAllEntries() {
    modStore.setGlobalFilter(searchText);
    closePalette();
  }

  function scrollToFormSection(sectionId: string) {
    closePalette();
    requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function drillIntoCategory(cat: CommandCategory) {
    activeCategory = cat;
    query = "";
    activeIndex = 0;
  }

  function goBack() {
    activeCategory = null;
    query = "";
    activeIndex = 0;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, totalNavigableItems - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      // If user typed something and hits enter without selection, do search-all
      if (searchText && navItems.length > 0) {
        activateItem(navItems[activeIndex]);
      } else if (!searchText && navItems.length > 0) {
        activateItem(navItems[activeIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (activeCategory) {
        goBack();
      } else if (query) {
        query = "";
        activeIndex = 0;
      } else {
        closePalette();
      }
    }
  }

  function activateItem(item: NavItem) {
    switch (item.type) {
      case "search-all":
        searchAllEntries();
        break;
      case "command":
      case "recent":
      case "scan-prompt":
        if (item.command) execute(item.command);
        break;
      case "scored-command":
        if (item.command) execute(item.command);
        break;
      case "category":
        if (item.category) drillIntoCategory(item.category);
        break;
      case "back":
        goBack();
        break;
      case "entry-result":
        if (item.entry) selectEntry(item.entry);
        break;
      case "form-nav":
        if (item.formSection) scrollToFormSection(item.formSection.id);
        break;
    }
  }

  // Reset activeIndex when results change
  $effect(() => {
    if (navItems.length > 0) activeIndex = 0;
  });

  // Auto-focus input when opened
  $effect(() => {
    if (open) {
      query = uiStore.commandPaletteInitialQuery || "";
      activeIndex = 0;
      activeCategory = null;
      requestAnimationFrame(() => inputEl?.focus());
    } else {
      // Clear initial query when palette closes
      uiStore.commandPaletteInitialQuery = "";
    }
  });

  // Global keyboard shortcut
  function handleGlobalKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey && e.shiftKey && e.key === "P") || (e.ctrlKey && e.key === "k")) {
      e.preventDefault();
      open = !open;
    }
    if (e.ctrlKey && e.shiftKey && e.key === "F") {
      e.preventDefault();
      open = true;
      // Focus will enter search mode naturally
    }
  }

  /** Render label with highlighted matched characters */
  function highlightLabel(label: string, matches: number[]): string {
    if (!matches.length) return label.replace(/</g, "&lt;");
    const matchSet = new Set(matches);
    let result = "";
    for (let i = 0; i < label.length; i++) {
      const ch = label[i].replace(/</g, "&lt;");
      if (matchSet.has(i)) {
        result += `<mark class="bg-transparent font-bold text-[var(--th-text-sky-300)]">${ch}</mark>`;
      } else {
        result += ch;
      }
    }
    return result;
  }

  /** Build display string for the command palette input area.
   *  Shows "ModName | " only when a mod is loaded AND there's no search text. */
  let inputDisplayPrefix = $derived.by(() => {
    if (searchText) return "";  // Hide mod name when searching
    const modName = modStore.scanResult?.mod_meta?.name;
    if (modName) {
      return modName;
    }
    return "";
  });

  let placeholderText = $derived.by(() => {
    if (activeCategory) return m.command_palette_search_category({ category: CATEGORY_LABELS[activeCategory]() });
    if (!hasModLoaded) return m.command_palette_open_project();
    return m.command_palette_placeholder();
  });

  function toggleSectionFilter(sec: string) {
    const tag = `#${sec}`;
    if (sectionFilter === sec.toLowerCase()) {
      // Remove the filter tag
      query = query.replace(/#\S*/g, "").trim();
    } else {
      // Replace or add the filter tag
      const cleaned = query.replace(/#\S*/g, "").trim();
      query = cleaned ? `${cleaned} ${tag}` : tag;
    }
    inputEl?.focus();
  }
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<!-- Unified button snippet for command palette items.
     Captures the shared button wrapper (class, handlers, ARIA) and
     dispatches icon/label/trailing content based on item.type. -->
{#snippet cpItem(item: NavItem, active: boolean, idx: number)}
  {@const isScan = item.type === "scan-prompt"}
  <button
    id="cp-item-{idx}"
    class="cp-item w-full flex items-center gap-2 px-3 {isScan ? 'py-2.5' : 'py-1.5'} text-left
           {active
             ? (isScan ? 'bg-sky-600/30' : 'bg-[var(--th-bg-sky-700-60)]') + ' text-[var(--th-text-100)]'
             : (isScan ? 'text-sky-400' : 'text-[var(--th-text-200)]') + ' hover:bg-[var(--th-bg-800)]'}
           cursor-pointer{item.type === 'back' || isScan ? ' border-b border-[var(--th-border-700)]/50' : ''}"
    onclick={() => activateItem(item)}
    onmouseenter={() => activeIndex = idx}
    role="option"
    aria-selected={active}
    type="button"
  >
    <!-- Icon -->
    {#if item.type === "search-all"}
      <span class="shrink-0"><Search size={14} strokeWidth={2} /></span>
    {:else if isScan && item.command?.id === 'action.createNewMod'}
      <span class="shrink-0"><FilePlus2 size={16} strokeWidth={2} /></span>
    {:else if isScan}
      <span class="shrink-0"><FolderOpen size={16} strokeWidth={2} /></span>
    {:else if item.type === "back"}
      <span class="shrink-0"><ArrowLeft size={14} /></span>
    {:else if item.type === "category"}
      <span class="text-xs shrink-0">{commandRegistry.getCategoryIcon(item.category!)}</span>
    {:else if item.type === "entry-result"}
      <span class="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[var(--th-bg-700)] text-[var(--th-text-400)] shrink-0">{item.entry!.section}</span>
    {:else if item.type === "form-nav"}
      <span class="shrink-0 text-[var(--th-text-sky-400)]"><MapPin size={14} strokeWidth={2} /></span>
    {:else}
      <span class="text-xs shrink-0">{item.command!.icon}</span>
    {/if}

    <!-- Label -->
    {#if item.type === "search-all"}
      <span class="flex-1 text-xs truncate">{m.command_palette_search_all({ query: searchText })}</span>
    {:else if isScan}
      <span class="flex-1 text-xs font-medium">{item.command!.label}</span>
    {:else if item.type === "back"}
      <span class="flex-1 text-xs">{m.common_back()}</span>
    {:else if item.type === "category"}
      <span class="flex-1 text-xs font-medium">{CATEGORY_LABELS[item.category!]()}</span>
    {:else if item.type === "scored-command"}
      <span class="flex-1 text-xs truncate">
        {@html highlightLabel(item.command!.label, item.scored?.fuzzy.matches ?? [])}
      </span>
    {:else if item.type === "entry-result"}
      <span class="flex-1 text-xs truncate">{item.entry!.displayName}</span>
    {:else if item.type === "form-nav"}
      <span class="flex-1 text-xs truncate">Jump to: {item.formSection!.label}</span>
    {:else}
      <span class="flex-1 text-xs truncate">{item.command!.label}</span>
    {/if}

    <!-- Trailing badge / chevron -->
    {#if item.type === "search-all"}
      <span class="cp-hint-badge inline-flex items-center text-[11px] font-mono leading-none rounded px-1.5 py-0.5 shrink-0
                   bg-sky-600/80 text-white">{m.command_palette_enter()}</span>
    {:else if item.type === "category"}
      <span class="text-xs text-[var(--th-text-500)]">›</span>
    {:else if item.type === "entry-result"}
      <span class="text-[11px] text-[var(--th-text-500)] font-mono truncate max-w-[120px]">{item.entry!.uuid}</span>
    {:else if item.command?.shortcut}
      <span class="cp-hint-badge inline-flex items-center text-[11px] font-mono leading-none rounded px-1.5 py-0.5 shrink-0
                   bg-[var(--th-bg-700)] text-[var(--th-text-400)] border border-[var(--th-border-700)]">
        {item.command.shortcut}
      </span>
    {/if}
  </button>
{/snippet}

{#if open}
  <!-- Fixed backdrop for click-to-dismiss -->
  <div
    class="fixed inset-0 bg-[var(--th-modal-backdrop,rgba(0,0,0,.35))] z-[99]"
    role="presentation"
    onclick={closePalette}
    onkeydown={(e) => e.key === "Escape" && closePalette()}
  ></div>

  <!-- Inline input — Balance theme forces dark mode styling via cp-dark-mode class -->
  <div
    class="cp-dark-mode absolute inset-0 z-[100] flex items-center gap-2 px-3
           bg-[var(--th-bg-800)] border border-[var(--th-text-sky-400,#38bdf8)]/70
           border-b-0 rounded-t-md outline-none"
    role="dialog"
    aria-modal="true"
    aria-label={m.command_palette_aria()}
    tabindex="-1"
    use:focusTrap
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <Search size={12} strokeWidth={2.5} class="text-[var(--th-text-400)] shrink-0" />
    <input
      bind:this={inputEl}
      type="text"
      class="flex-1 bg-transparent text-xs text-[var(--th-text-100)] placeholder-[var(--th-text-500)]
             border-none min-w-0 p-0 m-0"
      placeholder={placeholderText}
      bind:value={query}
      onkeydown={handleKeydown}
      aria-label={m.command_palette_search_aria()}
      role="combobox"
      aria-expanded="true"
      aria-controls="command-list"
      aria-activedescendant={activeIndex >= 0 ? `cp-item-${activeIndex}` : undefined}
    />
    {#if searchText}
      <!-- Clear search button — inside the palette, aligned right -->
      <button
        class="inline-flex items-center justify-center w-5 h-5 rounded
               bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-400)] hover:text-[var(--th-text-100)]
               border border-[var(--th-border-600)] cursor-pointer transition-colors shrink-0"
        onclick={() => { query = ""; inputEl?.focus(); }}
        title={m.command_palette_clear_title()}
        aria-label={m.command_palette_clear_title()}
        type="button"
      >
        <X size={10} strokeWidth={3} />
      </button>
    {/if}
    {#if activeCategory}
      <span class="text-[11px] px-1.5 py-0.5 rounded bg-[var(--th-bg-sky-700-60)] text-[var(--th-text-100)] font-medium shrink-0">
        {CATEGORY_LABELS[activeCategory]()}
      </span>
    {/if}
    <span class="cp-hint-badge text-[11px] font-mono font-bold shrink-0 px-1.5 py-0.5 rounded
                 bg-[var(--th-bg-700)] text-[var(--th-text-400)] border border-[var(--th-border-700)]">
      {m.command_palette_esc()}
    </span>
  </div>

  <!-- Results dropdown — Balance dark mode scoped; connects directly to input -->
  <div
    class="cp-dark-mode absolute top-full left-0 right-0 z-[100]
           bg-[var(--th-bg-900)] border border-[var(--th-text-sky-400,#38bdf8)]/70 border-t-[var(--th-border-700)]
           rounded-b-lg shadow-2xl overflow-hidden"
    role="presentation"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <div id="command-list" class="max-h-[60vh] overflow-y-auto scrollbar-thin" role="listbox">
      {#if availableSections.length > 0 && (searchText || sectionFilter)}
        <div class="flex flex-wrap gap-1 px-3 py-1.5 border-b border-[var(--th-border-700)]/50">
          {#each availableSections as sec}
            <button
              type="button"
              class="text-[10px] px-1.5 py-0.5 rounded transition-colors cursor-pointer
                     {sectionFilter === sec.toLowerCase()
                       ? 'bg-sky-600 text-white'
                       : 'bg-[var(--th-bg-700)] text-[var(--th-text-400)] hover:bg-[var(--th-bg-600)] hover:text-[var(--th-text-200)]'}"
              onclick={() => toggleSectionFilter(sec)}
            >{sec}</button>
          {/each}
        </div>
      {/if}
      {#if navItems.length === 0}
        <div class="px-4 py-4 text-center text-xs text-[var(--th-text-500)]">
          {searchText ? m.command_palette_no_matching() : m.command_palette_no_commands()}
        </div>
      {:else}
        {#each navItems as item, i (item.type === "entry-result" ? `entry-${item.entry?.section}-${item.entry?.uuid}-${i}` : item.type === "form-nav" ? `form-nav-${item.formSection?.id}` : item.type === "category" ? `cat-${item.category}` : item.type === "back" ? "back" : item.type === "search-all" ? "search-all" : item.type === "scan-prompt" ? `scan-${item.command?.id}` : `cmd-${item.command?.id}-${i}`)}
          {@const isActive = i === activeIndex}
          {#if item.type === "form-nav" && (i === 0 || navItems[i - 1]?.type !== "form-nav")}
            <div class="px-3 pt-2 pb-0.5 text-[11px] uppercase tracking-wider font-semibold text-[var(--th-text-500)]">
              <MapPin size={12} strokeWidth={2} class="inline -mt-0.5" /> Form Sections
            </div>
          {/if}
          {#if item.type === "recent" && (i === 0 || navItems[i - 1]?.type !== "recent")}
            <div class="px-3 pt-2 pb-0.5 text-[11px] uppercase tracking-wider font-semibold text-[var(--th-text-500)]">
              <Clock size={12} strokeWidth={2} class="inline -mt-0.5" /> {m.command_palette_recent()}
            </div>
          {/if}
          {@render cpItem(item, isActive, i)}
        {/each}
        {#if searchText && entryResults.length >= 20}
          <div class="px-3 py-1.5 text-center text-[11px] text-[var(--th-text-500)]">
            {m.command_palette_showing_first_20()}
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}
