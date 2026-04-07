<script lang="ts">
  import type { DiffEntry } from "../lib/types/index.js";
  import { projectStore, sectionToTable } from "../lib/stores/projectStore.svelte.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { changesToManualFields } from "../lib/utils/preview.js";
  import { validateEntry } from "../lib/utils/validation.js";
  import { SECTION_CAPS } from "../lib/data/sectionCaps.js";
  import { FIELD_PREFIX, simpleKey } from "../lib/data/fieldKeys.js";
  import EntryDiff from "./EntryDiff.svelte";
  import UnifiedForm from "./UnifiedForm.svelte";
  import TagBadge from "./TagBadge.svelte";
  import Button from "./Button.svelte";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plus from "@lucide/svelte/icons/plus";
  import ShieldBan from "@lucide/svelte/icons/shield-ban";
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import MessageSquareOff from "@lucide/svelte/icons/message-square-off";
  import FolderTree from "@lucide/svelte/icons/folder-tree";
  import FileText from "@lucide/svelte/icons/file-text";
  import PanelRightOpen from "@lucide/svelte/icons/panel-right-open";
  import { tooltip } from "../lib/actions/tooltip.js";
  import { m } from "../paraglide/messages.js";

  let { entry, section, table: tableOverride = undefined, depth = 0, hasChildren = false, childCount = 0, oncontextmenu: onCtxMenu, onaddsubrace, ontogglechildren }: {
    entry: DiffEntry;
    section: string;
    table?: string;
    depth?: number;
    hasChildren?: boolean;
    childCount?: number;
    oncontextmenu?: (e: MouseEvent, entry: DiffEntry) => void;
    onaddsubrace?: (parentEntry: DiffEntry) => void;
    ontogglechildren?: () => void;
  } = $props();

  let isVanilla = $derived(entry.entry_kind === 'Vanilla');

  /** Staging DB table name for this section */
  let table = $derived(tableOverride ?? sectionToTable(section));

  /** Ensure section data is loaded in projectStore (lazy) */
  $effect(() => {
    const t = table;
    if (!projectStore.isSectionLoaded(t)) {
      projectStore.loadSection(t).catch(err => {
        console.warn(`[EntryRow] Failed to load table ${t}:`, err);
      });
    }
  });

  /** Look up the corresponding staging DB entry for derived state */
  let stagingEntry = $derived(projectStore.getEntries(table).find(e => e._pk === entry.uuid));

  /** Section capability flags — derived from SECTION_CAPS */
  const capabilities = $derived.by(() => {
    const caps = SECTION_CAPS[section as keyof typeof SECTION_CAPS] as any;
    const boolKeys: string[] = caps?.booleanKeys ?? [];
    return {
      hasBlacklist: !!caps?.hasBlacklist,
      supportsHidden: boolKeys.includes("Hidden") || boolKeys.includes("IsHidden"),
    };
  });

  /** Whether this entry currently has a Blacklist override */
  let isBlacklisted = $derived.by(() => {
    if (!stagingEntry?._is_modified) return false;
    return String(stagingEntry?.["Blacklist"] ?? "") === "true";
  });

  /** Toggle the Blacklist flag via staging DB update */
  function toggleBlacklist(): void {
    if (isBlacklisted) {
      // Remove blacklist
      projectStore.updateEntry(table, entry.uuid, { Blacklist: "" });
    } else {
      // Add blacklist
      projectStore.updateEntry(table, entry.uuid, {
        UUID: entry.uuid,
        Blacklist: "true",
      });
    }
  }

  let showDiff = $state(false);
  let diffContainer: HTMLDivElement | undefined = $state(undefined);
  let editing = $state(false);
  let openWithSummary = $state(false);

  function startEdit(withSummary = false) {
    editing = true;
    editCollapsed = false;
    showDiff = false;
    openWithSummary = withSummary;
  }

  $effect(() => {
    if (showDiff && diffContainer) diffContainer.scrollTop = 0;
  });

  // Listen for external edit trigger (from context menu or SectionPanel)
  $effect(() => {
    function onStartEdit(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.section === section && detail?.uuid === entry.uuid) {
        startEdit();
      }
    }
    window.addEventListener('entry-start-edit', onStartEdit);
    return () => window.removeEventListener('entry-start-edit', onStartEdit);
  });

  /** IX-01B: Whether the edit form is temporarily collapsed (preserves form state) */
  let editCollapsed = $state(false);

  /** Computed data state — entry status derived from stores and entry data */
  const dataState = $derived.by(() => ({
    enabled: stagingEntry ? !stagingEntry._is_deleted : true,
    hasOverride: stagingEntry?._is_modified ?? false,
    isEntirelyNew: entry.changes.length === 1 && entry.changes[0].change_type === "EntireEntryNew",
  }));

  /** Detect if this entry has Hidden or IsHidden set to true (from staging row or raw attributes). */
  let isHidden = $derived.by(() => {
    if (stagingEntry?._is_modified) {
      const h = String(stagingEntry["Boolean:Hidden"] ?? "");
      const ih = String(stagingEntry["Boolean:IsHidden"] ?? "");
      if (h === "true" || ih === "true") return true;
      if (h === "false" || ih === "false") return false;
    }
    const attrs = entry.raw_attributes;
    if (attrs?.Hidden === "true" || attrs?.IsHidden === "true") return true;
    return false;
  });

  /** The key name to use when toggling hidden state. */
  let hiddenKey = $derived.by((): string => {
    const attrs = entry.raw_attributes;
    if (attrs?.IsHidden !== undefined) return "IsHidden";
    return "Hidden";
  });

  /**
   * Resolve display name — for Backgrounds/Origins the display_name may be a
   * localization handle (h12345...) that needs resolution via localizationMap.
   */
  let resolvedDisplayName = $derived.by(() => {
    const raw = entry.display_name;
    if (!raw) return entry.uuid;
    // Check if it looks like a localization handle (starts with 'h' followed by hex chars)
    if (/^h[0-9a-f]{8,}g/i.test(raw)) {
      const localized = modStore.lookupLocalizedString(raw);
      return localized || raw;
    }
    return raw;
  });

  /** Validation state — warnings and errors for this entry */
  const validation = $derived.by(() => {
    if (!dataState.enabled) return { valid: true, issues: [] as { level: string; message: string }[] };
    const asSelected = {
      section: section as any,
      uuid: entry.uuid,
      display_name: entry.display_name,
      changes: entry.changes,
      raw_attributes: entry.raw_attributes,
      manual: false,
    };
    const result = validateEntry(asSelected);
    const errors = result.issues.filter(i => i.level === "error");
    const warnings = result.issues.filter(i => i.level === "warning");
    return {
      valid: result.valid,
      issues: result.issues,
      status: result.valid ? "ok" as const : "warning" as const,
      hasError: errors.length > 0,
      hasWarning: warnings.length > 0,
      errorTooltip: errors.map(i => i.message).join("\n"),
      warningTooltip: warnings.map(i => i.message).join("\n"),
    };
  });

  function toggle(): void {
    projectStore.toggleEntry(table, entry.uuid);
  }

  let summary = $derived.by((): string => {
    if (entry.changes.length === 1 && entry.changes[0].change_type === "EntireEntryNew") {
      return "";
    }
    const n = entry.changes.length;
    if (n === 0) return "";
    if (n === 1) return m.entry_row_changes_one({ field: entry.changes[0].field });
    return m.entry_row_changes({ count: n });
  });

  /** Convert the auto entry's changes into a prefill-compatible Record.
   *  If the staging entry is modified, use its column data as override; otherwise derive from diff changes. */
  let prefillFields = $derived.by(() => {
    if (stagingEntry?._is_modified) {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(stagingEntry)) {
        if (!k.startsWith("_") && v != null) fields[k] = String(v);
      }
      return fields;
    }
    return changesToManualFields(
      {
        section: section as any,
        uuid: entry.uuid,
        display_name: entry.display_name,
        changes: entry.changes,
        manual: false,
      },
      entry.raw_attributes,
      entry.raw_children,
    );
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="entry-row flex flex-col rounded border transition-colors
         {isVanilla && !editing ? 'border-zinc-700/30 bg-zinc-800/30' : validation.hasError && dataState.enabled ? 'border-red-500/60 bg-red-950/20' : validation.status === 'warning' && dataState.enabled ? 'border-amber-500/60 border-dashed bg-amber-950/20' : dataState.enabled ? 'border-violet-700/40 bg-violet-950/20' : 'border-zinc-700/50 bg-zinc-800/50'}
         {isVanilla && !editing ? 'opacity-60' : dataState.enabled ? '' : 'opacity-60'}"
  style={depth > 0 ? `margin-left: ${depth * 1.25}rem` : ''}
  data-entry-id="{section}:{entry.uuid}"
  title={isVanilla && !editing ? m.entry_row_vanilla_tooltip() : dataState.enabled ? undefined : m.entry_row_disabled_tooltip()}
  oncontextmenu={(e) => { if (onCtxMenu) { e.preventDefault(); onCtxMenu(e, entry); } }}
>
  {#if isVanilla && !editing}
    <!-- Vanilla entry row with Edit / Add Subrace buttons -->
    <div class="flex items-center gap-2 px-3 py-1">
      <span class="w-3.5 h-3.5 shrink-0"></span>
      <TagBadge tag="BASE" />
      {#if hasChildren}
        <button
          type="button"
          class="shrink-0 cursor-pointer text-[var(--th-text-500)] hover:text-[var(--th-text-200)] transition-colors"
          onclick={(e) => { e.stopPropagation(); ontogglechildren?.(); }}
        >
          <FolderTree size={14} />
        </button>
      {:else if depth > 0}
        <FileText size={14} class="shrink-0 text-[var(--th-text-500)]" />
      {/if}
      <span class="flex-1 text-sm font-medium truncate text-[var(--th-text-500)]">
        {resolvedDisplayName}
      </span>
      {#if hasChildren && childCount > 0}
        <span class="text-[10px] bg-[var(--th-bg-600)] text-[var(--th-text-400)] px-1.5 py-0.5 rounded-full">{childCount}</span>
      {/if}
      <span class="entry-actions shrink-0 flex items-center gap-1">
        <button
          type="button"
          class="p-1 rounded text-[var(--th-text-500)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-600)] transition-colors"
          use:tooltip={m.entry_row_edit_tooltip()}
          aria-label={m.entry_row_edit_aria({ name: resolvedDisplayName })}
          onclick={(e) => { e.stopPropagation(); startEdit(); }}
        >
          <Pencil size={12} />
        </button>
        {#if section === 'Races' && onaddsubrace}
          <button
            type="button"
            class="p-1 rounded text-[var(--th-text-500)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-600)] transition-colors"
            use:tooltip={m.entry_row_add_sub_race_tooltip()}
            aria-label={m.entry_row_add_sub_race_aria({ name: resolvedDisplayName })}
            onclick={(e) => { e.stopPropagation(); onaddsubrace(entry); }}
          >
            <Plus size={12} />
          </button>
        {/if}
      </span>
    </div>
  {:else if editing}
    <!-- Persistent header (chevron to collapse/expand edit form, preserving state) -->
    <div class="flex items-center gap-2 px-3 py-1 border-b border-zinc-700/50">
      <!-- Chevron — only this triggers collapse/expand -->
      <Button
        variant="ghost"
        size="icon"
        class="shrink-0"
        onclick={() => editCollapsed = !editCollapsed}
        aria-label={editCollapsed ? m.entry_row_expand_aria({ name: resolvedDisplayName }) : m.entry_row_collapse_aria({ name: resolvedDisplayName })}
      >
        {#if editCollapsed}
          <ChevronDown class="w-3.5 h-3.5 text-zinc-500" />
        {:else}
          <ChevronUp class="w-3.5 h-3.5 text-zinc-500" />
        {/if}
      </Button>

      {#if dataState.isEntirelyNew}
        <TagBadge tag="NEW" />
      {:else if entry.entry_kind === "Modified"}
        <TagBadge tag="OVRD" />
      {/if}
      {#if dataState.hasOverride}
        <TagBadge tag="MOD" />
      {/if}
      {#if validation.hasError && dataState.enabled}
        <span use:tooltip={validation.errorTooltip}><TagBadge tag="ERR" /></span>
      {/if}
      {#if validation.hasWarning && dataState.enabled}
        <span use:tooltip={validation.warningTooltip}><TagBadge tag="WARN" /></span>
      {/if}
      {#if hasChildren}
        <button
          type="button"
          class="shrink-0 cursor-pointer text-[var(--th-text-500)] hover:text-[var(--th-text-200)] transition-colors"
          onclick={(e) => { e.stopPropagation(); ontogglechildren?.(); }}
        >
          <FolderTree size={14} />
        </button>
      {:else if depth > 0}
        <FileText size={14} class="shrink-0 text-[var(--th-text-500)]" />
      {/if}
      <span class="flex-1 text-sm font-medium truncate">
        {resolvedDisplayName}
      </span>
      {#if hasChildren && childCount > 0}
        <span class="text-[10px] bg-[var(--th-bg-600)] text-[var(--th-text-400)] px-1.5 py-0.5 rounded-full">{childCount}</span>
      {/if}
      <span class="text-xs text-zinc-400">{summary}</span>

      <!-- Hidden/IsHidden eye icon toggle (visible even in edit mode) -->
      {#if capabilities.supportsHidden}
        {#if isHidden}
          <button
            type="button"
            class="shrink-0 p-1.5 rounded hover:bg-zinc-700/40 transition-colors cursor-pointer text-amber-400 hover:text-amber-300"
            use:tooltip={m.entry_row_hidden_tooltip()}
            aria-label={m.entry_row_unhide_aria()}
            onclick={(e) => {
              e.stopPropagation();
              projectStore.updateEntry(table, entry.uuid, { [simpleKey(FIELD_PREFIX.Boolean, hiddenKey)]: "false" });
            }}
          >
            <EyeOff class="w-3.5 h-3.5" />
          </button>
        {:else}
          <button
            type="button"
            class="shrink-0 p-1.5 rounded hover:bg-zinc-700/40 transition-colors cursor-pointer text-[var(--th-text-500)] hover:text-amber-400"
            use:tooltip={m.entry_row_visible_tooltip()}
            aria-label={m.entry_row_hide_aria()}
            onclick={(e) => {
              e.stopPropagation();
              projectStore.updateEntry(table, entry.uuid, { [simpleKey(FIELD_PREFIX.Boolean, hiddenKey)]: "true" });
            }}
          >
            <Eye class="w-3.5 h-3.5" />
          </button>
        {/if}
      {/if}

      <!-- Diff toggle -->
      {#if entry.changes.length > 0 && !dataState.isEntirelyNew}
        <button
          class="text-xs text-sky-400 hover:text-sky-300 transition-colors shrink-0"
          onclick={() => showDiff = !showDiff}
        >
          {showDiff ? m.entry_row_hide_diff() : m.entry_row_show_diff()}
        </button>
      {/if}

    </div>

    <!-- Expandable diff (visible even in editing mode) -->
    {#if showDiff}
      <div class="px-3 pb-2" bind:this={diffContainer}>
        <EntryDiff {entry} />
      </div>
    {/if}

    {#if !editCollapsed}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="p-2" oncontextmenu={(e) => e.stopPropagation()}>
        <UnifiedForm
          {section}
          {table}
          prefill={prefillFields}
          editIndex={-1}
          autoEntryId={entry.uuid}
          rawAttributes={entry.raw_attributes}
          rawChildren={entry.raw_children}
          sourceFile={entry.source_file}
          nodeId={entry.node_id}
          initialShowSummary={openWithSummary}
          onclose={() => { editing = false; editCollapsed = false; openWithSummary = false; }}
        />
      </div>
    {/if}
  {:else}
    <!-- Row header -->
    <div class="flex items-center gap-2 px-3 py-1">
      <!-- Chevron — only this triggers expand/edit -->
      <Button
        variant="ghost"
        size="icon"
        class="shrink-0"
        onclick={() => startEdit()}
        aria-label={m.entry_row_expand_aria({ name: resolvedDisplayName })}
      >
        <ChevronDown class="w-3.5 h-3.5 text-zinc-600" />
      </Button>

      {#if dataState.isEntirelyNew}
        <TagBadge tag="NEW" />
      {:else if entry.entry_kind === "Modified"}
        <TagBadge tag="OVRD" />
      {/if}

      {#if dataState.hasOverride}
        <TagBadge tag="MOD" />
      {/if}

      {#if validation.hasError && dataState.enabled}
        <span use:tooltip={validation.errorTooltip}><TagBadge tag="ERR" /></span>
      {/if}
      {#if validation.hasWarning && dataState.enabled}
        <span use:tooltip={validation.warningTooltip}><TagBadge tag="WARN" /></span>
      {/if}

      {#if hasChildren}
        <button
          type="button"
          class="shrink-0 cursor-pointer text-[var(--th-text-500)] hover:text-[var(--th-text-200)] transition-colors"
          onclick={(e) => { e.stopPropagation(); ontogglechildren?.(); }}
        >
          <FolderTree size={14} />
        </button>
      {:else if depth > 0}
        <FileText size={14} class="shrink-0 text-[var(--th-text-500)]" />
      {/if}

      <!-- Entry name / id (not clickable for expand) -->
      <span class="flex-1 text-sm font-medium truncate {dataState.enabled ? '' : 'line-through text-zinc-500'}">
        {resolvedDisplayName}
      </span>
      {#if hasChildren && childCount > 0}
        <span class="text-[10px] bg-[var(--th-bg-600)] text-[var(--th-text-400)] px-1.5 py-0.5 rounded-full">{childCount}</span>
      {/if}
      {#if !dataState.enabled}
        <span class="shrink-0 text-zinc-500" use:tooltip={m.entry_row_disabled_tooltip()}><MessageSquareOff class="w-3.5 h-3.5" /></span>
      {/if}

      <!-- Hidden/IsHidden eye icon toggle -->
      {#if capabilities.supportsHidden}
        {#if isHidden}
          <button
            type="button"
            class="shrink-0 p-1.5 rounded hover:bg-zinc-700/40 transition-colors cursor-pointer text-amber-400 hover:text-amber-300"
            use:tooltip={m.entry_row_hidden_tooltip()}
            aria-label={m.entry_row_unhide_aria()}
            onclick={(e) => {
              e.stopPropagation();
              projectStore.updateEntry(table, entry.uuid, { [simpleKey(FIELD_PREFIX.Boolean, hiddenKey)]: "false" });
            }}
          >
            <EyeOff class="w-3.5 h-3.5" />
          </button>
        {:else}
          <button
            type="button"
            class="shrink-0 p-1.5 rounded hover:bg-zinc-700/40 transition-colors cursor-pointer text-[var(--th-text-500)] hover:text-amber-400"
            use:tooltip={m.entry_row_visible_tooltip()}
            aria-label={m.entry_row_hide_aria()}
            onclick={(e) => {
              e.stopPropagation();
              projectStore.updateEntry(table, entry.uuid, { [simpleKey(FIELD_PREFIX.Boolean, hiddenKey)]: "true" });
            }}
          >
            <Eye class="w-3.5 h-3.5" />
          </button>
        {/if}
      {/if}

      <!-- Change count -->
      <span class="text-xs text-zinc-400">{summary}</span>

      <!-- Diff toggle -->
      {#if entry.changes.length > 0 && !dataState.isEntirelyNew}
        <button
          class="text-xs text-sky-400 hover:text-sky-300 transition-colors shrink-0"
          onclick={() => showDiff = !showDiff}
        >
          {showDiff ? m.entry_row_hide_diff() : m.entry_row_show_diff()}
        </button>
      {/if}

      <!-- Edit + Summary + Add Subrace actions -->
      <span class="entry-actions shrink-0 flex items-center gap-1">
        <button
          type="button"
          class="p-1 rounded text-[var(--th-text-500)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-600)] transition-colors"
          use:tooltip={m.entry_row_edit_tooltip()}
          aria-label={m.entry_row_edit_aria({ name: resolvedDisplayName })}
          onclick={(e) => { e.stopPropagation(); startEdit(); }}
        >
          <Pencil size={12} />
        </button>
        <button
          type="button"
          class="p-1 rounded text-[var(--th-text-500)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-600)] transition-colors"
          use:tooltip={"Toggle summary panel"}
          aria-label="Toggle summary panel"
          onclick={(e) => { e.stopPropagation(); startEdit(true); }}
        >
          <PanelRightOpen size={12} />
        </button>
        {#if section === 'Races' && onaddsubrace}
          <button
            type="button"
            class="p-1 rounded text-[var(--th-text-500)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-600)] transition-colors"
            use:tooltip={m.entry_row_add_sub_race_tooltip()}
            aria-label={m.entry_row_add_sub_race_aria({ name: resolvedDisplayName })}
            onclick={(e) => { e.stopPropagation(); onaddsubrace(entry); }}
          >
            <Plus size={12} />
          </button>
        {/if}
      </span>

    </div>

    <!-- Expandable diff -->
    {#if showDiff}
      <div class="px-3 pb-2" bind:this={diffContainer}>
        <EntryDiff {entry} />
      </div>
    {/if}
  {/if}
</div>

<style>
  .entry-row:hover {
    background: color-mix(in srgb, var(--th-bg-700, #3f3f46) 40%, transparent);
  }
  .entry-actions {
    opacity: 0;
    transition: opacity 150ms;
  }
  .entry-row:hover .entry-actions {
    opacity: 1;
  }
</style>
