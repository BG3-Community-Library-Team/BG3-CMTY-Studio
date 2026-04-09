<!--
  PF-034: Command Palette with Flat Navigation, Fuzzy Search + Entry Search.
  Shortcuts: Ctrl+P (Quick Open), Ctrl+Shift+P (Command Mode),
  Ctrl+G (Go to Row), Ctrl+Shift+O (Go to Field), ? (Help / mode discovery).

  VS Code–style floating palette: fixed top-center, ~50vw wide, with a
  single input field and a scrollable results list.

  Uses a flat navigation model:
  - All commands are shown in a single alphabetically sorted list
  - Each command label includes its category prefix (e.g. "Actions: Open Project")
  - # prefix filters by section: "ShadarKai #Races" or "#Progressions Wizard"
  - >PREFIX: filters commands by plugin namespace (e.g. ">git:")
  - Search results appear inline beneath matching commands when typing
  - Search filters entries by ALL fields (uuid, display_name, field values in changes)

  In Balance theme, the active palette always uses dark mode styling.
  Disabled commands are hidden — never shown even in search.
-->
<script lang="ts">
  import { commandRegistry, type Command } from "../lib/utils/commandRegistry.svelte.js";
  import { fuzzyScore, type FuzzyResult } from "../lib/utils/fuzzyScore.js";
  import { m } from "../paraglide/messages.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import Search from "@lucide/svelte/icons/search";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import FilePlus2 from "@lucide/svelte/icons/file-plus-2";
  import MapPin from "@lucide/svelte/icons/map-pin";
  import { focusTrap } from "../lib/utils/focusTrap.js";

  let { open = $bindable(false) }: { open?: boolean } = $props();

  let query = $state("");
  let activeIndex = $state(0);
  let inputEl: HTMLInputElement | undefined = $state(undefined);

  /** Whether a mod is currently loaded */
  let hasModLoaded = $derived(!!modStore.scanResult);

  interface ScoredCommand {
    command: Command;
    fuzzy: FuzzyResult;
  }

  // Parse plugin prefix filter: ">git:" filters commands by id prefix "git:" (colon required)
  let pluginPrefix = $derived.by(() => {
    const match = query.match(/^>(\S+:)/);
    return match ? match[1].toLowerCase() : "";
  });

  // Parse section filter: "#SectionName" anywhere in query
  let sectionFilter = $derived.by(() => {
    const match = query.match(/#(\S+)/);
    return match ? match[1].toLowerCase() : "";
  });

  // Search text: in command mode strip only ">" (and plugin prefix), otherwise strip #section
  let searchText = $derived.by(() => {
    const q = query.trimStart();
    if (q.startsWith(">")) {
      // Plugin prefix mode: strip ">prefix: "
      if (pluginPrefix) {
        return q.replace(/^>\S+\s*/, "").trim();
      }
      // Command mode: strip only ">"
      return q.slice(1).trim();
    }
    return query.replace(/#\S*/g, "").trim();
  });

  // Detect palette mode from first character
  type PaletteMode = "command" | "entry" | "goto-row" | "goto-field" | "section-filter" | "help";
  let paletteMode = $derived.by((): PaletteMode => {
    const q = query.trimStart();
    if (q.startsWith("?")) return "help";
    if (q.startsWith(">")) return "command";
    if (q.startsWith(":")) return "goto-row";
    if (q.startsWith("@")) return "goto-field";
    if (q.startsWith("#")) return "section-filter";
    return "entry";
  });

  // Mode-specific search text (strip the prefix character)
  let modeSearchText = $derived.by(() => {
    const q = query.trimStart();
    if (q.startsWith(">") || q.startsWith(":") || q.startsWith("@") || q.startsWith("#")) {
      return q.slice(1).trim();
    }
    return q.trim();
  });

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

  // All enabled commands (disabled commands are never shown)
  let enabledCommands = $derived(commandRegistry.getEnabled());

  // Recently used enabled commands
  let recentCommands = $derived(hasModLoaded ? commandRegistry.getRecent() : []);

  // Filtered command results — only when searching
  let commandResults = $derived.by((): ScoredCommand[] => {
    if (!searchText && !pluginPrefix) return [];
    let commands = enabledCommands;

    // If plugin prefix is active, filter by command id prefix
    if (pluginPrefix) {
      commands = commands.filter(c => c.id.startsWith(pluginPrefix));
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

  // Determine if search-all-entries action should appear
  let showSearchAllAction = $derived(!!searchText && !!modStore.scanResult && !pluginPrefix);

  // Build the flat navigable items list for keyboard navigation
  interface NavItem {
    type: "search-all" | "command" | "scored-command" | "entry-result" | "scan-prompt" | "form-nav" | "recent" | "help-mode";
    command?: Command;
    scored?: ScoredCommand;
    entry?: EntrySearchResult;
    formSection?: { id: string; label: string };
    helpPrefix?: string;
    helpLabel?: string;
    helpDescription?: string;
    helpShortcut?: string;
  }
  // Goto-row mode: entries in the active section (: prefix)
  let gotoRowResults = $derived.by((): NavItem[] => {
    if (paletteMode !== "goto-row" || !modStore.scanResult) return [];
    const activeTab = uiStore.openTabs.find(t => t.id === uiStore.activeTabId);
    if (!activeTab || (activeTab.type !== "section" && activeTab.type !== "filteredSection")) return [];
    const sectionName = activeTab.category;
    if (!sectionName) return [];

    const section = modStore.scanResult.sections.find(s => s.section === sectionName);
    if (!section) return [];

    const rowNum = parseInt(modeSearchText, 10);
    const items: NavItem[] = [];

    for (let idx = 0; idx < section.entries.length && items.length < 20; idx++) {
      const entry = section.entries[idx];
      const dn = entry.display_name ?? entry.uuid;
      if (modeSearchText && !isNaN(rowNum)) {
        if (idx + 1 === rowNum) {
          items.push({ type: "entry-result", entry: { section: sectionName, uuid: entry.uuid, displayName: `${idx + 1}. ${dn}` } });
        }
      } else if (modeSearchText) {
        if (dn.toLowerCase().includes(modeSearchText.toLowerCase())) {
          items.push({ type: "entry-result", entry: { section: sectionName, uuid: entry.uuid, displayName: `${idx + 1}. ${dn}` } });
        }
      } else {
        items.push({ type: "entry-result", entry: { section: sectionName, uuid: entry.uuid, displayName: `${idx + 1}. ${dn}` } });
      }
    }
    return items;
  });

  // Goto-field mode: form sections and fields (@ prefix)
  let gotoFieldResults = $derived.by((): NavItem[] => {
    if (paletteMode !== "goto-field") return [];
    const items: NavItem[] = [];
    for (const sec of uiStore.formNavSections) {
      const label = sec.label;
      if (!modeSearchText || label.toLowerCase().includes(modeSearchText.toLowerCase())) {
        items.push({ type: "form-nav", formSection: sec });
      }
      if (sec.children) {
        for (const child of sec.children) {
          if (!modeSearchText || child.label.toLowerCase().includes(modeSearchText.toLowerCase())) {
            items.push({ type: "form-nav", formSection: child });
          }
        }
      }
    }
    return items;
  });

  let navItems = $derived.by((): NavItem[] => {
    const items: NavItem[] = [];

    // Help mode (? prefix) — static list of available modes
    if (paletteMode === "help") {
      items.push({ type: "help-mode", helpPrefix: ">", helpLabel: m.command_palette_help_commands_label(), helpDescription: m.command_palette_help_commands_desc(), helpShortcut: "Ctrl+Shift+P" });
      items.push({ type: "help-mode", helpPrefix: ":", helpLabel: m.command_palette_help_goto_row_label(), helpDescription: m.command_palette_help_goto_row_desc(), helpShortcut: "Ctrl+G" });
      items.push({ type: "help-mode", helpPrefix: "@", helpLabel: m.command_palette_help_goto_field_label(), helpDescription: m.command_palette_help_goto_field_desc(), helpShortcut: "Ctrl+Shift+O" });
      items.push({ type: "help-mode", helpPrefix: "#", helpLabel: m.command_palette_help_section_filter_label(), helpDescription: m.command_palette_help_section_filter_desc() });
      items.push({ type: "help-mode", helpPrefix: "", helpLabel: m.command_palette_help_search_label(), helpDescription: m.command_palette_help_search_desc(), helpShortcut: "Ctrl+P" });
      return items;
    }

    // Goto-row mode (: prefix)
    if (paletteMode === "goto-row") {
      return gotoRowResults;
    }

    // Goto-field mode (@ prefix)
    if (paletteMode === "goto-field") {
      return gotoFieldResults;
    }

    // Command mode with search: ONLY show matching commands (no entries/form-nav)
    if (paletteMode === "command" && searchText && !pluginPrefix) {
      for (const sc of commandResults) {
        items.push({ type: "scored-command", scored: sc, command: sc.command });
      }
      return items;
    }

    // Command mode root: ONLY show commands (recent + all, no entries/form-nav/scan-prompts)
    if (paletteMode === "command" && !searchText && !pluginPrefix) {
      const recentIds = new Set(recentCommands.map(c => c.id));
      if (recentCommands.length > 0) {
        for (const cmd of recentCommands) items.push({ type: "recent", command: cmd });
      }
      const otherCommands = [...enabledCommands]
        .filter(c => !recentIds.has(c.id))
        .sort((a, b) => a.label.localeCompare(b.label));
      for (const cmd of otherCommands) items.push({ type: "command", command: cmd });
      return items;
    }

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
    } else {
      // Root browsing (flat list)

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

      // Recently used commands (when mod is loaded)
      const recentIds = new Set(recentCommands.map(c => c.id));
      if (recentCommands.length > 0) {
        for (const cmd of recentCommands) {
          items.push({ type: "recent", command: cmd });
        }
      }

      // Other commands (all enabled except recent, sorted alphabetically)
      const otherCommands = [...enabledCommands]
        .filter(c => !recentIds.has(c.id))
        .sort((a, b) => a.label.localeCompare(b.label));
      for (const cmd of otherCommands) {
        items.push({ type: "command", command: cmd });
      }
    }
    return items;
  });

  let totalNavigableItems = $derived(navItems.length);

  function closePalette() {
    open = false;
    query = "";
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

  const PAGE_SIZE = 10;

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, totalNavigableItems - 1);
      requestAnimationFrame(() => {
        document.getElementById(`cp-item-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      requestAnimationFrame(() => {
        document.getElementById(`cp-item-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
      });
    } else if (e.key === "PageDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + PAGE_SIZE, totalNavigableItems - 1);
      requestAnimationFrame(() => {
        document.getElementById(`cp-item-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
      });
    } else if (e.key === "PageUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - PAGE_SIZE, 0);
      requestAnimationFrame(() => {
        document.getElementById(`cp-item-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
      });
    } else if (e.key === "Home") {
      e.preventDefault();
      activeIndex = 0;
      requestAnimationFrame(() => {
        document.getElementById(`cp-item-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
      });
    } else if (e.key === "End") {
      e.preventDefault();
      activeIndex = totalNavigableItems - 1;
      requestAnimationFrame(() => {
        document.getElementById(`cp-item-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (navItems.length > 0) {
        activateItem(navItems[activeIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePalette();
    }
  }

  function activateItem(item: NavItem) {
    switch (item.type) {
      case "search-all":
        searchAllEntries();
        break;
      case "command":
      case "scan-prompt":
      case "recent":
        if (item.command) execute(item.command);
        break;
      case "scored-command":
        if (item.command) execute(item.command);
        break;
      case "entry-result":
        if (item.entry) selectEntry(item.entry);
        break;
      case "form-nav":
        if (item.formSection) scrollToFormSection(item.formSection.id);
        break;
      case "help-mode":
        query = item.helpPrefix ?? "";
        requestAnimationFrame(() => inputEl?.focus());
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
      requestAnimationFrame(() => inputEl?.focus());
    } else {
      // Clear initial query when palette closes
      uiStore.commandPaletteInitialQuery = "";
    }
  });

  // Global keyboard shortcuts
  function handleGlobalKeydown(e: KeyboardEvent) {
    // Ctrl+Shift+P — Command mode (> prefix)
    if (e.ctrlKey && e.shiftKey && e.key === "P") {
      e.preventDefault();
      if (open && query.trimStart().startsWith(">")) { closePalette(); return; }
      query = ">";
      uiStore.commandPaletteInitialQuery = ">";
      open = true;
      return;
    }
    // Ctrl+P — Quick Open (entry search, no prefix)
    if (e.ctrlKey && !e.shiftKey && e.key === "p") {
      e.preventDefault();
      if (open && !query.trimStart().startsWith(">") && !query.trimStart().startsWith(":") && !query.trimStart().startsWith("@") && !query.trimStart().startsWith("#") && !query.trimStart().startsWith("?")) { closePalette(); return; }
      query = "";
      uiStore.commandPaletteInitialQuery = "";
      open = true;
      return;
    }
    // Ctrl+G — Go to Row (: prefix)
    if (e.ctrlKey && !e.shiftKey && e.key === "g") {
      e.preventDefault();
      if (open && query.trimStart().startsWith(":")) { closePalette(); return; }
      query = ":";
      uiStore.commandPaletteInitialQuery = ":";
      open = true;
      return;
    }
    // Ctrl+Shift+O — Go to Field (@ prefix)
    if (e.ctrlKey && e.shiftKey && e.key === "O") {
      e.preventDefault();
      if (open && query.trimStart().startsWith("@")) { closePalette(); return; }
      query = "@";
      uiStore.commandPaletteInitialQuery = "@";
      open = true;
      return;
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

  /** Split a shortcut string like "Ctrl+Shift+P" into individual key parts */
  function parseShortcut(shortcut: string): string[] {
    return shortcut.split("+").map(k => k.trim()).filter(Boolean);
  }

  /** Highlight the first occurrence of a substring in text (case-insensitive) */
  function highlightSubstring(text: string, query: string): string {
    if (!query) return text.replace(/</g, "&lt;");
    const escaped = text.replace(/</g, "&lt;");
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx === -1) return escaped;
    const before = text.slice(0, idx).replace(/</g, "&lt;");
    const match = text.slice(idx, idx + query.length).replace(/</g, "&lt;");
    const after = text.slice(idx + query.length).replace(/</g, "&lt;");
    return `${before}<mark class="bg-transparent font-bold text-[var(--th-text-sky-300)]">${match}</mark>${after}`;
  }

  let placeholderText = $derived.by(() => {
    if (paletteMode === "help") return m.command_palette_help_placeholder();
    if (paletteMode === "command") return m.command_palette_command_placeholder();
    if (paletteMode === "section-filter") return m.command_palette_section_filter_placeholder();
    if (paletteMode === "goto-row") return m.command_palette_goto_row_placeholder();
    if (paletteMode === "goto-field") return m.command_palette_goto_field_placeholder();
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
    class="cp-item w-full flex items-center gap-2.5 px-3 py-[5px] text-left text-[13px] leading-snug
           {active
             ? 'bg-[var(--th-focus-ring,#38bdf8)]/20 text-[var(--th-text-100)]'
             : 'text-[var(--th-text-300)] hover:bg-[var(--th-bg-700)]/40'}
           cursor-pointer transition-colors duration-75"
    onclick={() => activateItem(item)}
    onmouseenter={() => activeIndex = idx}
    role="option"
    aria-selected={active}
    type="button"
  >
    <!-- Icon -->
    {#if item.type === "search-all"}
      <span class="shrink-0 w-4 text-center"><Search size={14} strokeWidth={2} /></span>
    {:else if isScan && item.command?.id === 'action.createNewMod'}
      <span class="shrink-0 w-4 text-center"><FilePlus2 size={14} strokeWidth={2} /></span>
    {:else if isScan}
      <span class="shrink-0 w-4 text-center"><FolderOpen size={14} strokeWidth={2} /></span>
    {:else if item.type === "entry-result"}
      <span class="text-[10px] font-mono px-1 py-0.5 rounded bg-[var(--th-bg-700)] text-[var(--th-text-500)] shrink-0">{item.entry!.section}</span>
    {:else if item.type === "form-nav"}
      <span class="shrink-0 w-4 text-center text-[var(--th-text-sky-400)]"><MapPin size={14} strokeWidth={2} /></span>
    {:else if item.type === "help-mode"}
      <span class="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[var(--th-bg-700)] text-[var(--th-text-sky-400)] shrink-0 min-w-[24px] text-center">{item.helpPrefix || "⌕"}</span>
    {:else}
      <span class="shrink-0 w-4"></span>
    {/if}

    <!-- Label -->
    {#if item.type === "search-all"}
      <span class="flex-1 truncate">{m.command_palette_search_all({ query: searchText })}</span>
    {:else if isScan}
      <span class="flex-1 font-medium">{item.command!.label}</span>
    {:else if item.type === "scored-command"}
      <span class="flex-1 truncate">
        {@html highlightLabel(item.command!.label, item.scored?.fuzzy.matches ?? [])}
      </span>
    {:else if item.type === "entry-result"}
      <span class="flex-1 truncate">
        {@html highlightSubstring(item.entry!.displayName, searchText)}
      </span>
    {:else if item.type === "form-nav"}
      <span class="flex-1 truncate">
        {#if searchText}
          Jump to: {@html highlightSubstring(item.formSection!.label, searchText)}
        {:else}
          Jump to: {item.formSection!.label}
        {/if}
      </span>
    {:else if item.type === "help-mode"}
      <span class="flex-1 truncate">
        <span class="font-medium">{item.helpLabel}</span>
        <span class="ml-1.5 text-[12px] text-[var(--th-text-500)]">{item.helpDescription}</span>
      </span>
    {:else}
      <span class="flex-1 truncate">{item.command!.label}</span>
    {/if}

    <!-- Trailing badge / chevron -->
    {#if item.type === "search-all"}
      <span class="cp-keys">
        <kbd class="cp-key">{m.command_palette_enter()}</kbd>
      </span>
    {:else if item.type === "entry-result"}
      <span class="text-[11px] text-[var(--th-text-600)] font-mono truncate max-w-[120px]">{item.entry!.uuid}</span>
    {:else if item.command?.shortcut}
      <span class="cp-keys">
        {#each parseShortcut(item.command.shortcut) as key}
          <kbd class="cp-key">{key}</kbd>
        {/each}
      </span>
    {:else if item.type === "help-mode" && item.helpShortcut}
      <span class="cp-keys">
        {#each parseShortcut(item.helpShortcut) as key}
          <kbd class="cp-key">{key}</kbd>
        {/each}
      </span>
    {/if}
  </button>
{/snippet}

{#if open}
  <!-- Backdrop — click to dismiss (transparent, like VS Code) -->
  <div
    class="fixed inset-0 z-[99] cp-animate-backdrop"
    role="presentation"
    onclick={closePalette}
    onkeydown={(e) => e.key === "Escape" && closePalette()}
  ></div>

  <!-- Input overlay — sits exactly on top of the trigger button -->
  <div
    class="cp-dark-mode cp-animate-input absolute inset-0 z-[100] flex items-center shadow-[0_0_8px_2px_rgba(0,0,0,.36)] rounded-md bg-[var(--th-bg-800)] border border-[var(--th-focus-ring,#38bdf8)]"
    role="dialog"
    aria-modal="true"
    aria-label={m.command_palette_aria()}
    tabindex="-1"
    use:focusTrap
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <input
      bind:this={inputEl}
      type="text"
      class="cp-input w-full h-full bg-transparent text-sm text-[var(--th-text-100)] placeholder-[var(--th-text-500)] rounded-md px-3.5 min-w-0 m-0"
      placeholder={placeholderText}
      bind:value={query}
      onkeydown={handleKeydown}
      aria-label={m.command_palette_search_aria()}
      role="combobox"
      aria-expanded="true"
      aria-controls="command-list"
      aria-activedescendant={activeIndex >= 0 ? `cp-item-${activeIndex}` : undefined}
    />
  </div>

  <!-- Results dropdown — anchored below the trigger area -->
  <div
    class="cp-dark-mode cp-animate-results absolute top-full left-0 right-0 z-[100] mt-px
           bg-[var(--th-bg-800)] border-t border-[var(--th-border-700)]
           rounded-b-md shadow-[0_0_8px_2px_rgba(0,0,0,.36)] overflow-hidden"
    role="presentation"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <div id="command-list" class="max-h-[min(60vh,400px)] overflow-y-auto" role="listbox">
      <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {navItems.length === 0 ? m.command_palette_no_results_aria() : m.command_palette_results_count_aria({ count: navItems.length })}
      </div>
      {#if availableSections.length > 0 && (searchText || sectionFilter)}
        <div class="flex flex-wrap gap-1 px-2.5 py-1.5 border-b border-[var(--th-border-700)]/50">
          {#each availableSections as sec}
            <button
              type="button"
              class="text-[10px] px-1.5 py-0.5 rounded transition-colors cursor-pointer
                     {sectionFilter === sec.toLowerCase()
                       ? 'bg-[var(--th-focus-ring,#38bdf8)] text-white'
                       : 'bg-[var(--th-bg-700)] text-[var(--th-text-400)] hover:bg-[var(--th-bg-600)] hover:text-[var(--th-text-200)]'}"
              onclick={() => toggleSectionFilter(sec)}
            >{sec}</button>
          {/each}
        </div>
      {/if}
      {#if navItems.length === 0}
        <div class="px-4 py-6 text-center text-[13px] text-[var(--th-text-500)]">
          <div>{searchText ? m.command_palette_no_matching() : m.command_palette_no_commands()}</div>
          <button
            type="button"
            class="mt-2 text-[12px] text-[var(--th-text-sky-400)] hover:text-[var(--th-text-sky-300)] cursor-pointer transition-colors"
            onclick={() => { query = "?"; }}
          >
            {m.command_palette_no_result_hint()}
          </button>
        </div>
      {:else}
        {#each navItems as item, i (item.type === "help-mode" ? `help-${item.helpPrefix}` : item.type === "entry-result" ? `entry-${item.entry?.section}-${item.entry?.uuid}-${i}` : item.type === "form-nav" ? `form-nav-${item.formSection?.id}` : item.type === "search-all" ? "search-all" : item.type === "scan-prompt" ? `scan-${item.command?.id}` : `cmd-${item.command?.id}-${i}`)}
          {@const isActive = i === activeIndex}
          {#if item.type === "form-nav" && (i === 0 || navItems[i - 1]?.type !== "form-nav")}
            <div class="cp-group-header">
              <MapPin size={11} strokeWidth={2} class="inline -mt-0.5" /> Form Sections
            </div>
          {/if}
          {#if item.type === "recent" && (i === 0 || navItems[i - 1]?.type !== "recent")}
            <div class="cp-group-header">
              {m.command_palette_recently_used()}
            </div>
          {/if}
          {#if !searchText && item.type === "command" && i > 0 && navItems[i - 1]?.type === "recent"}
            <div class="cp-group-header">
              {m.command_palette_other_commands()}
            </div>
          {/if}
          {@render cpItem(item, isActive, i)}
        {/each}
        {#if searchText && entryResults.length >= 20}
          <div class="px-3 py-1.5 text-center text-[11px] text-[var(--th-text-500)]">
            {m.command_palette_showing_first_20()}
          </div>
        {/if}
        {#if searchText && navItems.length > 0}
          <div class="px-3 py-1 text-center text-[11px] text-[var(--th-text-600)] border-t border-[var(--th-border-700)]/30">
            {entryResults.length >= 20 ? m.command_palette_result_count_capped({ count: navItems.length }) : m.command_palette_result_count({ count: navItems.length })}
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Suppress global :focus-visible outline — input has its own border transition */
  .cp-input:focus-visible {
    outline: none;
  }
  /* Key badge container — flex row of individual key pills */
  :global(.cp-keys) {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }
  /* Individual key pill */
  :global(.cp-key) {
    font-size: 11px;
    font-family: var(--font-mono, ui-monospace, monospace);
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--th-bg-700);
    color: var(--th-text-400);
    border: 1px solid var(--th-border-600, rgba(255,255,255,0.1));
    line-height: 1.4;
    white-space: nowrap;
    flex-shrink: 0;
  }
  /* Group header (recently used, form sections) */
  :global(.cp-group-header) {
    padding: 6px 12px 2px;
    font-size: 11px;
    text-transform: lowercase;
    letter-spacing: normal;
    font-weight: 400;
    color: var(--th-text-500);
    border-top: 1px solid var(--th-border-700);
  }
  :global(.cp-group-header:first-child) {
    border-top: none;
  }
  /* Suppress focus outlines on items — keyboard nav uses background highlight */
  :global(.cp-item:focus-visible) {
    outline: none;
  }
  /* Open animations — respect reduced motion preference */
  @media (prefers-reduced-motion: no-preference) {
    .cp-animate-results {
      animation: cp-enter 120ms ease-out;
    }
    .cp-animate-input {
      animation: cp-fade-in 100ms ease-out;
    }
    .cp-animate-backdrop {
      animation: cp-fade-in 100ms ease-out;
    }
  }
  @keyframes cp-enter {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes cp-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
