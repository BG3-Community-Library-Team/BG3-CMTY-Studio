<script lang="ts">
  import type { SectionResult } from "../lib/types/index.js";
  import { SECTION_DISPLAY_NAMES, getErrorMessage } from "../lib/types/index.js";
  import type { Section } from "../lib/types/index.js";
  import { configStore } from "../lib/stores/configStore.svelte.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import { undoStore } from "../lib/stores/undoStore.svelte.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import { saveLsx, type LsxPreviewEntry } from "../lib/utils/tauri.js";
  import { diffEntryToLsx, getRegionId } from "../lib/utils/entryToLsx.js";
  import EntryRow from "./EntryRow.svelte";
  import UnifiedForm from "./UnifiedForm.svelte";
  import ManualEntryCard from "./ManualEntryCard.svelte";
  import PaginationControls from "./PaginationControls.svelte";
  import HelpTooltip from "./HelpTooltip.svelte";
  import GroupHeader from "./GroupHeader.svelte";
  import { groupEntries, SECTION_GROUP_MODES, GROUP_LABELS, type GroupCriterion } from "../lib/utils/grouping.js";
  import { SECTION_CAPS } from "../lib/data/sectionCaps.js";
  import { FOLDER_NODE_MAP } from "../lib/data/bg3FolderStructure.js";
  import { isLazyCategory, loadCategory } from "../lib/services/scanService.js";
  import type { VanillaCategory } from "../lib/data/vanillaRegistry.js";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { tooltip } from "../lib/actions/tooltip.js";
  import TagBadge from "./TagBadge.svelte";
  import EntryContextMenu from "./EntryContextMenu.svelte";
  import ProgressionTimeline from "./manual-entry/ProgressionTimeline.svelte";
  import type { DiffEntry } from "../lib/types/index.js";
  import { tick } from "svelte";
  import { m } from "../paraglide/messages.js";

  let {
    sectionResult,
    globalFilter = "",
    displayLabel = "",
    entryFilter = undefined,
    oncontextmenu: onCtxMenu,
  }: {
    sectionResult: SectionResult;
    globalFilter?: string;
    displayLabel?: string;
    entryFilter?: { field: string; value: string };
    oncontextmenu?: (e: MouseEvent) => void;
  } = $props();

  let filter = $state("");
  let showManualForm = $state(false);

  // Entry-level context menu state (Races: Add Sub-Race, Edit)
  let entryCtxMenu: { entry: DiffEntry; x: number; y: number } | null = $state(null);

  function handleEntryContextMenu(e: MouseEvent, entry: DiffEntry): void {
    entryCtxMenu = { entry, x: e.clientX, y: e.clientY };
  }

  /** Open edit form for an entry — dispatches to the EntryRow via a custom event */
  function handleEditEntry(entry: DiffEntry): void {
    entryCtxMenu = null;
    // Dispatch a custom event that EntryRow listens to
    window.dispatchEvent(new CustomEvent('entry-start-edit', { detail: { section: sectionResult.section, uuid: entry.uuid } }));
  }

  function handleAddSubrace(parentEntry: DiffEntry): void {
    // Open manual entry form pre-filled with ParentGuid pointing to the parent race
    showManualForm = true;
    subraceParentUuid = parentEntry.uuid;
  }

  let subraceParentUuid: string | null = $state(null);

  // Listen for "explorer-add-entry" events to open the new entry form
  $effect(() => {
    const section = sectionResult.section;
    function onExplorerAdd(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.section === section) {
        showManualForm = true;
        uiStore.pinTab(uiStore.activeTabId);
      }
    }
    window.addEventListener("explorer-add-entry", onExplorerAdd);
    return () => window.removeEventListener("explorer-add-entry", onExplorerAdd);
  });

  // Close manual form when section or entryFilter changes (e.g., navigating via explorer)
  let prevSection: string | undefined;
  let prevFilterValue: string | undefined;
  $effect(() => {
    const current = sectionResult.section;
    const currentFilter = entryFilter?.value;
    if (prevSection !== undefined && (current !== prevSection || currentFilter !== prevFilterValue)) {
      showManualForm = false;
    }
    prevSection = current;
    prevFilterValue = currentFilter;
  });

  // Lazy-load Tier D vanilla data when panel opens for a lazy category
  $effect(() => {
    const sec = sectionResult.section as VanillaCategory;
    if (isLazyCategory(sec)) {
      loadCategory(sec);
    }
  });

  // Whether this section has hardcoded SECTION_CAPS (uses ManualEntryForm) or schema-driven (uses UnifiedForm)
  let hasCaps = $derived(sectionResult.section in SECTION_CAPS);

  // Reset confirmation modal state
  let showResetModal = $state(false);
  let resetTriggerEl: HTMLElement | null = $state(null);

  function closeResetModal() {
    showResetModal = false;
    tick().then(() => resetTriggerEl?.focus());
  }

  // PF-032: Entry grouping state
  let groupingMode: GroupCriterion = $state("flat" as GroupCriterion);
  let groupExpandState: Map<string, boolean> = $state(new Map());
  let availableGroupModes = $derived(
    SECTION_GROUP_MODES[sectionResult.section as keyof typeof SECTION_GROUP_MODES] ?? ["flat", "status", "alphabetical"]
  );

  function toggleGroupExpand(key: string) {
    const newState = new Map(groupExpandState);
    newState.set(key, !(newState.get(key) ?? true));
    groupExpandState = newState;
  }

  function toggleGroupAll(entries: import("../lib/types/index.js").DiffEntry[]) {
    const section = sectionResult.section;
    const allEnabled = entries.every(e => configStore.isEnabled(section, e.uuid));
    for (const e of entries) {
      if (allEnabled) {
        if (configStore.isEnabled(section, e.uuid)) configStore.toggleEntry(section, e.uuid);
      } else {
        if (!configStore.isEnabled(section, e.uuid)) configStore.toggleEntry(section, e.uuid);
      }
    }
  }

  let displayName = $derived(
    displayLabel
    || SECTION_DISPLAY_NAMES[sectionResult.section]
    || FOLDER_NODE_MAP[sectionResult.section]?.label
    || sectionResult.section
  );

  let filteredEntries = $derived.by(() => {
    let entries = sectionResult.entries;

    const gq = globalFilter.trim().toLowerCase();
    const lq = filter.trim().toLowerCase();

    // Single-pass: skip if neither filter is active
    if (!gq && !lq) return entries;

    return entries.filter(e => {
      const uid = e.uuid.toLowerCase();
      const dn = e.display_name?.toLowerCase() ?? "";
      const ek = e.entry_kind.toLowerCase();

      if (gq && !(uid.includes(gq) || dn.includes(gq) || ek.includes(gq))) return false;
      if (lq && !(uid.includes(lq) || dn.includes(lq) || ek.includes(lq))) return false;
      return true;
    });
  });

  /**
   * Merge ancestor vanilla entries into the Races list for tree context.
   * Only includes vanilla entries that are ancestors of mod entries (demand-driven).
   * Returns entries sorted in tree order (pre-order traversal by depth).
   */
  let mergedEntries = $derived.by(() => {
    if (sectionResult.section !== 'Races') return filteredEntries;

    const vanillaRaces = modStore.vanilla.Races ?? [];
    if (vanillaRaces.length === 0) return filteredEntries;

    // Build vanilla lookup by UUID for parent chain walking
    const vanillaByUuid = new Map(vanillaRaces.map(v => [v.uuid, v]));
    const existingUuids = new Set(filteredEntries.map(e => e.uuid));

    // Collect ancestor UUIDs needed: walk ParentGuid chain from each mod entry
    const neededAncestors = new Set<string>();
    for (const entry of filteredEntries) {
      let parentId = entry.raw_attributes?.ParentGuid;
      while (parentId && !existingUuids.has(parentId) && !neededAncestors.has(parentId)) {
        if (vanillaByUuid.has(parentId)) {
          neededAncestors.add(parentId);
          parentId = vanillaByUuid.get(parentId)!.parent_guid ?? '';
        } else {
          break;
        }
      }
    }

    if (neededAncestors.size === 0) return filteredEntries;

    // Create stub DiffEntry objects only for needed ancestors
    const vanillaStubs: DiffEntry[] = [...neededAncestors].map(uuid => {
      const v = vanillaByUuid.get(uuid)!;
      return {
        uuid: v.uuid,
        display_name: v.display_name,
        source_file: '',
        entry_kind: 'Vanilla' as const,
        changes: [],
        node_id: v.node_id,
        raw_attributes: v.parent_guid ? { ParentGuid: v.parent_guid } : {} as Record<string, string>,
        raw_attribute_types: {},
        raw_children: {},
      };
    });

    const allEntries = [...filteredEntries, ...vanillaStubs];

    // Build tree-ordered list with depth for indented rendering
    const byParent = new Map<string, DiffEntry[]>();
    const roots: DiffEntry[] = [];
    for (const e of allEntries) {
      const pid = e.raw_attributes?.ParentGuid;
      if (pid && allEntries.some(p => p.uuid === pid)) {
        const arr = byParent.get(pid) ?? [];
        arr.push(e);
        byParent.set(pid, arr);
      } else {
        roots.push(e);
      }
    }

    // Pre-order traversal to assign depth
    const ordered: DiffEntry[] = [];
    function walk(entries: DiffEntry[], depth: number) {
      for (const e of entries.sort((a, b) => (a.display_name ?? '').localeCompare(b.display_name ?? ''))) {
        entryDepthMap.set(e.uuid, depth);
        ordered.push(e);
        const children = byParent.get(e.uuid);
        if (children) walk(children, depth + 1);
      }
    }
    walk(roots, 0);
    return ordered;
  });

  /** For Progressions: merge manual entries (as DiffEntry stubs) into the timeline view */
  let timelineEntries = $derived.by((): DiffEntry[] => {
    if (sectionResult.section !== 'Progressions') return mergedEntries;

    const manuals = configStore.getManualEntriesForSection(sectionResult.section);
    if (manuals.length === 0) return mergedEntries;

    // Filter manual entries by entryFilter if present (e.g. ProgressionType === "0" for Class)
    // encodeFormState stores fields with "Field:" prefix, so prefix the filter key
    const filtered = entryFilter
      ? manuals.filter(m => m.entry.fields[`Field:${entryFilter!.field}`] === entryFilter!.value)
      : manuals;
    if (filtered.length === 0) return mergedEntries;

    // Convert ManualEntry → DiffEntry stub
    // Strip "Field:" prefix from encoded keys so raw_attributes matches backend format
    const stubs: DiffEntry[] = filtered.map(({ entry }) => {
      const rawAttrs: Record<string, string> = {};
      for (const [k, v] of Object.entries(entry.fields)) {
        if (k.startsWith("Field:")) rawAttrs[k.slice(6)] = v;
        else if (!k.includes(":") && !k.startsWith("_")) rawAttrs[k] = v;
      }
      return {
        uuid: entry.fields.UUID ?? entry.fields.EntryName ?? `manual-${Math.random().toString(36).slice(2, 10)}`,
        display_name: rawAttrs.Name ?? entry.fields._entryLabel ?? entry.fields.UUID ?? 'New Entry',
        source_file: '',
        entry_kind: 'New' as const,
        changes: [],
        node_id: 'Progression',
        raw_attributes: rawAttrs,
        raw_attribute_types: {},
        raw_children: {},
      };
    });

    // Avoid duplicates: don't add stubs whose UUID already exists in mergedEntries
    const existingUuids = new Set(mergedEntries.map(e => e.uuid));
    const newStubs = stubs.filter(s => !existingUuids.has(s.uuid));

    return newStubs.length > 0 ? [...mergedEntries, ...newStubs] : mergedEntries;
  });

  /** Depth map for race tree indentation — populated by mergedEntries */
  let entryDepthMap: Map<string, number> = $state(new Map());

  /** Whether each entry has children in the race tree */
  let hasChildrenMap = $derived.by(() => {
    const map = new Map<string, boolean>();
    for (const e of mergedEntries) {
      const pid = e.raw_attributes?.ParentGuid;
      if (pid) {
        map.set(pid, true);
      }
    }
    return map;
  });

  /** Direct child count for each parent in the race tree */
  let childCountMap = $derived.by(() => {
    const map = new Map<string, number>();
    for (const e of mergedEntries) {
      const pid = e.raw_attributes?.ParentGuid;
      if (pid) {
        map.set(pid, (map.get(pid) ?? 0) + 1);
      }
    }
    return map;
  });

  /** Collapse state for race tree parent nodes */
  let raceTreeCollapsed: Map<string, boolean> = $state(new Map());

  function toggleRaceCollapsed(uuid: string) {
    const newMap = new Map(raceTreeCollapsed);
    newMap.set(uuid, !(newMap.get(uuid) ?? false));
    raceTreeCollapsed = newMap;
  }

  /** Visible entries after filtering out collapsed subtrees */
  let visibleMergedEntries = $derived.by(() => {
    if (sectionResult.section !== 'Races' || raceTreeCollapsed.size === 0) return mergedEntries;

    const collapsedSet = new Set<string>();
    for (const [uuid, collapsed] of raceTreeCollapsed) {
      if (collapsed) collapsedSet.add(uuid);
    }
    if (collapsedSet.size === 0) return mergedEntries;

    const result: DiffEntry[] = [];
    let hideBelow = Infinity;

    for (const entry of mergedEntries) {
      const depth = entryDepthMap.get(entry.uuid) ?? 0;
      if (depth <= hideBelow) {
        hideBelow = Infinity;
      }
      if (depth > hideBelow) continue;
      result.push(entry);
      if (collapsedSet.has(entry.uuid)) {
        hideBelow = depth;
      }
    }

    return result;
  });

  // PF-032: Group entries (after mergedEntries is available)
  let groupedEntries = $derived(
    groupEntries(visibleMergedEntries, groupingMode, sectionResult.section, (s, u) => configStore.isEnabled(s, u))
  );

  // ---- Combined entry list: auto-detected + manual entries for unified pagination ----
  interface CombinedEntry {
    type: "auto" | "manual";
    autoEntry?: import("../lib/types/index.js").DiffEntry;
    manualEntry?: { entry: import("../lib/stores/configStore.svelte.js").ManualEntry; globalIndex: number };
  }

  let combinedEntries = $derived.by((): CombinedEntry[] => {
    const entries: CombinedEntry[] = [];
    for (const e of visibleMergedEntries) {
      entries.push({ type: "auto", autoEntry: e });
    }
    for (const me of manualEntries) {
      entries.push({ type: "manual", manualEntry: me });
    }
    return entries;
  });

  // ---- Pagination state (default 15) ----
  let pageSize = $state(15);
  let currentPage = $state(0);
  let totalPages = $derived(Math.max(1, Math.ceil(combinedEntries.length / pageSize)));
  let paginatedCombined = $derived(combinedEntries.slice(currentPage * pageSize, (currentPage + 1) * pageSize));
  // Reset page when filter changes or entries change significantly
  $effect(() => {
    const _len = combinedEntries.length;
    if (currentPage >= Math.ceil(_len / pageSize)) {
      currentPage = Math.max(0, Math.ceil(_len / pageSize) - 1);
    }
  });

  // Generate unique keys for entries (handles duplicate UUIDs within a section,
  // e.g. same progression table at different levels in BG3 mods)
  let entryKeys: string[] = $derived.by(() => {
    const counts = new Map<string, number>();
    return visibleMergedEntries.map(entry => {
      const n = counts.get(entry.uuid) ?? 0;
      counts.set(entry.uuid, n + 1);
      return n === 0 ? entry.uuid : `${entry.uuid}#${n}`;
    });
  });

  let manualEntries = $derived(configStore.getManualEntriesForSection(sectionResult.section));

  // Expansion state persists across tab switches via uiStore (defaults to expanded)
  let expanded = $derived(uiStore.expandedSections[sectionResult.section] ?? true);
  function setExpanded(value: boolean) {
    uiStore.expandedSections = { ...uiStore.expandedSections, [sectionResult.section]: value };
  }

  // Watch for expansion commands from the context menu
  $effect(() => {
    const cmd = modStore.sectionExpandCommand;
    if (cmd && cmd.section === sectionResult.section) {
      setExpanded(cmd.expand);
      modStore.sectionExpandCommand = null;
    }
  });

  /** Guard: has the auto-expand already fired once? Prevents re-expanding after user collapses. */
  let didAutoExpand = $state(false);
  $effect(() => {
    if (!didAutoExpand && manualEntries.length > 0 && !expanded && sectionResult.entries.length === 0) {
      setExpanded(true);
      didAutoExpand = true;
    }
  });

  // PF-027: Auto-expand when global filter matches entries in this section
  $effect(() => {
    if (globalFilter.trim() && mergedEntries.length > 0 && !expanded) {
      setExpanded(true);
    }
  });

  let allEnabled = $derived(configStore.isSectionFullyEnabled(sectionResult.section));

  /** Count of auto entries currently active (not disabled) */
  let activeCount = $derived(
    sectionResult.entries.filter(e => configStore.isEnabled(sectionResult.section, e.uuid)).length
  );

  /** Count of auto entries explicitly disabled by the user */
  let disabledCount = $derived(sectionResult.entries.length - activeCount);

  /** Whether section has any user changes (disabled entries or manual entries) */
  let hasChanges = $derived(disabledCount > 0 || manualEntries.length > 0);

  /** Whether section has resettable user-made changes (excludes pristine imported state) */
  let hasResettableChanges = $derived(configStore.hasSectionChanges(sectionResult.section));

  /** Primary mod folder name for self-diff prevention */
  let primaryModFolder = $derived(modStore.selectedModPath?.split(/[\\/]/).pop() ?? "");

  let sectionErrors = $derived(configStore.validationSummary.errors.filter(e => e.section === sectionResult.section));
  let sectionWarnings = $derived(configStore.validationSummary.warnings.filter(w => w.section === sectionResult.section));

  async function scrollToSectionEntry(section: string, uuid: string) {
    setExpanded(true);
    await tick();
    const el = document.querySelector(`[data-entry-id="${CSS.escape(section)}:${CSS.escape(uuid)}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function toggleAll(): void {
    if (allEnabled) {
      configStore.disableSection(sectionResult.section);
    } else {
      configStore.enableSection(sectionResult.section);
    }
  }
</script>

<section class="border border-[var(--th-border-700)] rounded-lg overflow-clip" data-section-panel>
  <!-- Header (sticky within scroll container) -->
  <button
    class="w-full flex items-center gap-3 px-4 py-3 bg-[var(--th-bg-850,#1a1a1e)] hover:bg-[var(--th-bg-850,#1a1a1e)]/80
           text-left transition-colors sticky top-0 z-20 shadow-[0_2px_4px_rgba(0,0,0,.15)]
           rounded-t-lg {expanded ? '' : 'rounded-b-lg'}"
    onclick={() => setExpanded(!expanded)}
    oncontextmenu={(e) => { if (onCtxMenu) { e.preventDefault(); onCtxMenu(e); } }}
    aria-expanded={expanded}
  >
    <ChevronRight size={14} class="text-[var(--th-text-400)] transition-transform {expanded ? 'rotate-90' : ''}" />

    <span class="font-semibold text-[var(--th-text-100)]">{displayName}</span>
    <HelpTooltip helpKey={sectionResult.section} />

    {#if sectionErrors.length > 0}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
      <span
        class="inline-flex items-center gap-0.5 cursor-pointer shrink-0"
        onclick={(e) => { e.stopPropagation(); scrollToSectionEntry(sectionErrors[0].section, sectionErrors[0].uuid); }}
        use:tooltip={`${sectionErrors.length} validation error${sectionErrors.length !== 1 ? 's' : ''}`}
        role="status"
      >
        <TagBadge tag="ERR" />
        <span class="text-xs text-red-300">{sectionErrors.length}</span>
      </span>
    {/if}
    {#if sectionWarnings.length > 0}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
      <span
        class="inline-flex items-center gap-0.5 cursor-pointer shrink-0"
        onclick={(e) => { e.stopPropagation(); scrollToSectionEntry(sectionWarnings[0].section, sectionWarnings[0].uuid); }}
        use:tooltip={`${sectionWarnings.length} validation warning${sectionWarnings.length !== 1 ? 's' : ''}`}
        role="status"
      >
        <TagBadge tag="WARN" />
        <span class="text-xs text-amber-300">{sectionWarnings.length}</span>
      </span>
    {/if}

    <span class="ml-auto text-xs text-[var(--th-text-400)]">
      {#if disabledCount > 0}
        <span class="text-zinc-400">{disabledCount} disabled</span>
        <span class="text-[var(--th-text-500)]">/</span>
      {/if}
      {sectionResult.entries.length + manualEntries.length}
      {(sectionResult.entries.length + manualEntries.length) === 1 ? "entry" : "entries"}
    </span>
  </button>

  {#if expanded}
    <div class="bg-[var(--th-bg-850,#18181b)] border-t border-[var(--th-border-700)] relative">
      <!-- Toolbar -->
      <div class="border-b border-[var(--th-border-700)]/50">
        <!-- Action row: Disable All, Add All, Diff, Manual, Reset -->
        <div class="flex flex-wrap items-center gap-2 px-4 py-2">
          {#if !allEnabled}
            <button
              class="text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors select-none px-2 py-1 rounded border border-sky-400/30 hover:border-sky-300/40"
              onclick={() => { configStore.enableSection(sectionResult.section); toastStore.info(m.section_panel_enabled_toast_title(), m.section_panel_enabled_toast_message({ section: displayName }), { label: "Undo", actionId: "undo" }); }}
              use:tooltip={m.section_panel_enable_all_tooltip()}
              aria-label={m.section_panel_enable_all_aria()}
            >{m.section_panel_enable_all()}</button>
          {/if}
          {#if allEnabled && sectionResult.entries.length > 0}
            <button
              class="text-xs font-medium text-red-400 hover:text-red-300 transition-colors select-none px-2 py-1 rounded border border-red-400/30 hover:border-red-300/40"
              onclick={() => { configStore.disableSection(sectionResult.section); toastStore.info(m.section_panel_disabled_toast_title(), m.section_panel_disabled_toast_message({ section: displayName }), { label: "Undo", actionId: "undo" }); }}
              use:tooltip={m.section_panel_disable_all_tooltip()}
              aria-label={m.section_panel_disable_all_aria()}
            >{m.section_panel_disable_all()}</button>
          {/if}


          <span class="flex-1"></span>

          <button
            class="text-xs font-medium px-3 py-1 rounded border border-sky-500/40 bg-sky-700/20 text-sky-300 hover:bg-sky-700/40 transition-colors whitespace-nowrap"
            onclick={() => { showManualForm = !showManualForm; if (!showManualForm) return; uiStore.pinTab(uiStore.activeTabId); }}
          >
            {m.section_panel_add_entry()}
          </button>

          {#if hasResettableChanges}
            <button
              class="text-xs text-amber-400 hover:text-amber-300 whitespace-nowrap"
              onclick={(e) => { resetTriggerEl = e.currentTarget as HTMLElement; showResetModal = true; }}
              use:tooltip={m.section_panel_reset_tooltip()}
            >
              {m.section_panel_reset()}
            </button>
          {/if}
        </div>

        <!-- Filter + Sort + Pagination row (hidden when fewer than 2 entries) -->
        {#if combinedEntries.length >= 2 || filter}
        <div class="flex items-center gap-2 px-4 py-1.5 bg-[var(--th-bg-900)]/30 border-t border-[var(--th-border-700)]/30">
          <input
            type="text"
            placeholder={m.section_panel_filter_placeholder()}
            class="flex-1 min-w-[120px] bg-[var(--th-input-bg,#27272a)] border border-[var(--th-input-border,#52525b)] rounded px-2 py-1 text-xs
                   text-[var(--th-input-text,#e4e4e7)] placeholder-[var(--th-text-500)] focus:border-sky-500"
            bind:value={filter}
            aria-label={m.section_panel_filter_aria()}
          />

          <!-- PF-032: Grouping/Sort selector -->
          {#if availableGroupModes.length > 1}
            <label for="group-{sectionResult.section}" class="text-xs text-[var(--th-text-500)] shrink-0">{m.section_panel_group_label()}</label>
            <select
              id="group-{sectionResult.section}"
              class="bg-[var(--th-input-bg,#27272a)] border border-[var(--th-input-border,#52525b)] rounded px-1.5 py-1 text-xs
                     text-[var(--th-text-300)] focus:border-sky-500 shrink-0"
              value={groupingMode}
              onchange={(e: Event) => {
                groupingMode = (e.target as HTMLSelectElement).value as GroupCriterion;
                groupExpandState = new Map();
              }}
              use:tooltip={m.section_panel_group_aria()}
              aria-label={m.section_panel_group_aria()}
            >
              {#each availableGroupModes as mode}
                <option value={mode}>{GROUP_LABELS[mode as GroupCriterion]}</option>
              {/each}
            </select>
          {/if}

          {#if totalPages > 1}
            <span class="flex-1"></span>
            <PaginationControls bind:currentPage={currentPage} {totalPages} totalItems={combinedEntries.length} bind:pageSize={pageSize} />
          {/if}
        </div>
        {/if}
      </div>

      <!-- Manual entry form (add mode) -->
      {#if showManualForm}
        <div class="px-4 py-2">
          {#if hasCaps}
            <UnifiedForm
              section={sectionResult.section}
              {entryFilter}
              prefill={subraceParentUuid ? { 'Field:ParentGuid': subraceParentUuid } : null}
              onclose={() => { showManualForm = false; subraceParentUuid = null; }}
              onsave={(result) => {
                showManualForm = false;
                toastStore.success(m.section_panel_entry_added_title(), m.section_panel_entry_added_message({ section: sectionResult.section }));

                // Persist identity fields to LSX file on disk
                const folder = modStore.scanResult?.mod_meta?.folder;
                const modPath = modStore.selectedModPath;
                if (!folder || !modPath) return;
                const uuid = result.UUID ?? result.EntryName ?? "";
                if (!uuid) return;
                const regionId = getRegionId(sectionResult.section as Section);
                const nodeId = result["_nodeType"] ?? regionId.replace(/s$/, "");
                // Extract only LSX-worthy identity attributes
                const lsxAttrs: Record<string, string> = {};
                if (result.UUID) lsxAttrs["UUID"] = result.UUID;
                if (result.Name) lsxAttrs["Name"] = result.Name;
                const newEntry: LsxPreviewEntry = {
                  uuid,
                  node_id: nodeId,
                  raw_attributes: lsxAttrs,
                  raw_attribute_types: {},
                  raw_children: {},
                };
                const existingEntries: LsxPreviewEntry[] = (sectionResult.entries ?? []).map(diffEntryToLsx);
                const allEntries = [...existingEntries, newEntry];
                const outputPath = `${modPath}/Public/${folder}/${regionId}/${regionId}.lsx`;
                saveLsx(allEntries, regionId, outputPath).catch(err => {
                  console.error("Failed to save LSX:", err);
                  toastStore.error(m.section_panel_lsx_save_failed(), getErrorMessage(err));
                });
              }}
            />
          {:else}
            <UnifiedForm
              section={sectionResult.section}
              onclose={() => showManualForm = false}
              onsave={(result) => {
                showManualForm = false;
                toastStore.success(m.section_panel_entry_added_title(), m.section_panel_entry_added_schema_message({ nodeId: result["_nodeType"] ?? sectionResult.section }));

                // Persist identity fields to LSX file on disk
                const folder = modStore.scanResult?.mod_meta?.folder;
                const modPath = modStore.selectedModPath;
                if (!folder || !modPath) return;
                const uuid = result.UUID ?? result.EntryName ?? "";
                if (!uuid) return;
                const regionId = getRegionId(sectionResult.section as Section);
                const nodeId = result["_nodeType"] ?? regionId.replace(/s$/, "");
                const lsxAttrs: Record<string, string> = {};
                if (result.UUID) lsxAttrs["UUID"] = result.UUID;
                if (result.Name) lsxAttrs["Name"] = result.Name;
                const newEntry: LsxPreviewEntry = {
                  uuid,
                  node_id: nodeId,
                  raw_attributes: lsxAttrs,
                  raw_attribute_types: {},
                  raw_children: {},
                };
                const existingEntries: LsxPreviewEntry[] = (sectionResult.entries ?? []).map(diffEntryToLsx);
                const allEntries = [...existingEntries, newEntry];
                const outputPath = `${modPath}/Public/${folder}/${regionId}/${regionId}.lsx`;
                saveLsx(allEntries, regionId, outputPath).catch(err => {
                  console.error("Failed to save LSX:", err);
                  toastStore.error(m.section_panel_lsx_save_failed(), getErrorMessage(err));
                });
              }}
            />
          {/if}
        </div>
      {/if}

      {#if sectionResult.section === 'Progressions'}
        <div class="px-2 pt-2">
          <ProgressionTimeline
            entries={timelineEntries}
            section={sectionResult.section}
          />
        </div>
      {:else}
      <!-- Entries list (skipped for Progressions — timeline handles them) -->
      {#if modStore.vanillaLoadFailures.includes(sectionResult.section)}
        <div class="mx-2 mb-1 px-3 py-1.5 rounded text-xs bg-[var(--th-bg-red-900-50)] text-[var(--th-text-red-300)] border border-[var(--th-border-red-700)]/30">
          {m.section_panel_vanilla_unavailable()}
        </div>
      {/if}
      <div class="space-y-1 p-2">
        <!-- Auto-detected entries (grouped or flat) -->
        {#if groupedEntries.length > 0}
          <!-- PF-032: Grouped rendering -->
          {#each groupedEntries as group (group.key)}
            <GroupHeader
              {group}
              expanded={groupExpandState.get(group.key) ?? true}
              ontoggle={() => toggleGroupExpand(group.key)}
              onselectall={() => toggleGroupAll(group.entries)}
            />
            {#if groupExpandState.get(group.key) ?? true}
              {#each group.entries as entry, gi (group.originalIndices[gi] < entryKeys.length ? entryKeys[group.originalIndices[gi]] : `${group.key}-${gi}`)}
                <EntryRow {entry} section={sectionResult.section} depth={entryDepthMap.get(entry.uuid) ?? 0} hasChildren={hasChildrenMap.get(entry.uuid) ?? false} childCount={childCountMap.get(entry.uuid) ?? 0} ontogglechildren={sectionResult.section === 'Races' ? () => toggleRaceCollapsed(entry.uuid) : undefined} oncontextmenu={handleEntryContextMenu} onaddsubrace={sectionResult.section === 'Races' ? handleAddSubrace : undefined} />
              {/each}
            {/if}
          {/each}
        {:else}
          <!-- Flat rendering with unified pagination (auto + manual entries) -->
          {#each paginatedCombined as item, pi (item.type === "auto" ? (entryKeys[currentPage * pageSize + pi] ?? `auto-${pi}`) : `man-${item.manualEntry?.globalIndex ?? pi}`)}
            {#if item.type === "auto" && item.autoEntry}
              {@const autoEntry = item.autoEntry}
              <EntryRow entry={autoEntry} section={sectionResult.section} depth={entryDepthMap.get(autoEntry.uuid) ?? 0} hasChildren={hasChildrenMap.get(autoEntry.uuid) ?? false} childCount={childCountMap.get(autoEntry.uuid) ?? 0} ontogglechildren={sectionResult.section === 'Races' ? () => toggleRaceCollapsed(autoEntry.uuid) : undefined} oncontextmenu={handleEntryContextMenu} onaddsubrace={sectionResult.section === 'Races' ? handleAddSubrace : undefined} />
            {:else if item.type === "manual" && item.manualEntry}
              <ManualEntryCard entry={item.manualEntry.entry} globalIndex={item.manualEntry.globalIndex} section={sectionResult.section} />
            {/if}
          {/each}

          <!-- Bottom pagination controls -->
          <div class="flex justify-end mt-1">
            <PaginationControls bind:currentPage={currentPage} {totalPages} totalItems={combinedEntries.length} bind:pageSize={pageSize} />
          </div>
        {/if}

        {#if combinedEntries.length === 0}
          <p class="text-xs text-[var(--th-text-500)] px-2 py-4 text-center">
            {filter ? m.section_panel_no_matching() : m.section_panel_no_entries()}
          </p>
        {/if}
      </div>
      {/if}
    </div>
  {/if}
</section>

<!-- Reset confirmation modal -->
{#if showResetModal}
  <div
    class="fixed inset-0 bg-[var(--th-modal-backdrop)] z-[60] flex items-center justify-center p-4"
    onclick={() => closeResetModal()}
    onkeydown={(e) => e.key === "Escape" && closeResetModal()}
    role="presentation"
  >
    <div
      class="bg-[var(--th-bg-800)] border border-[var(--th-border-700)] rounded-lg shadow-2xl max-w-sm w-full"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.key === 'Escape' && closeResetModal()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
      tabindex="-1"
    >
      <div class="px-5 py-4 border-b border-[var(--th-border-700)]">
        <h3 id="reset-modal-title" class="text-sm font-bold text-[var(--th-text-amber-400)] flex items-center gap-2">
          {m.section_panel_reset_modal_title()}
        </h3>
      </div>
      <div class="px-5 py-4">
        <p class="text-sm text-[var(--th-text-300)]">
          {m.section_panel_reset_confirmation({ section: displayName })}
        </p>
        <p class="text-xs text-[var(--th-text-500)] mt-2">{m.section_panel_reset_warning()}</p>
      </div>
      <div class="px-5 py-3 border-t border-[var(--th-border-700)] flex justify-end gap-2">
        <button
          class="px-4 py-1.5 text-xs rounded bg-[var(--th-bg-700)] text-[var(--th-text-300)] hover:opacity-80 transition-colors"
          onclick={() => closeResetModal()}
        >{m.common_cancel()}</button>
        <button
          class="px-4 py-1.5 text-xs rounded bg-amber-600 text-white hover:bg-amber-500 transition-colors"
          onclick={() => { configStore.resetSection(sectionResult.section); closeResetModal(); toastStore.info(m.section_panel_reset_toast_title(), m.section_panel_reset_toast_message({ section: displayName })); }}
        >{m.common_reset()}</button>
      </div>
    </div>
  </div>
{/if}

<!-- Entry-level context menu (Races: Add Sub-Race) -->
{#if entryCtxMenu}
  <EntryContextMenu
    entry={entryCtxMenu.entry}
    section={sectionResult.section}
    x={entryCtxMenu.x}
    y={entryCtxMenu.y}
    isEnabled={configStore.isEnabled(sectionResult.section, entryCtxMenu.entry.uuid)}
    onclose={() => entryCtxMenu = null}
    onedit={handleEditEntry}
    ontoggle={(entry) => { configStore.toggleEntry(sectionResult.section, entry.uuid); entryCtxMenu = null; }}
    onaddsubrace={sectionResult.section === 'Races' ? handleAddSubrace : undefined}
  />
{/if}
