<script lang="ts">
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { projectStore, sectionHasNewEntries, sectionToTable } from "../lib/stores/projectStore.svelte.js";
  import { rediffMod } from "../lib/utils/tauri.js";
  import { SECTIONS_ORDERED, isCoreSection } from "../lib/types/index.js";
  import type { SectionResult, Section } from "../lib/types/index.js";
  import SectionPanel from "./SectionPanel.svelte";
  import SectionContextMenu from "./SectionContextMenu.svelte";
  import GlobalSearchBar from "./GlobalSearchBar.svelte";
  import { m } from "../paraglide/messages.js";
  import Settings from "@lucide/svelte/icons/settings";
  import Menu from "@lucide/svelte/icons/menu";

  let sections = $derived(modStore.scanResult?.sections ?? []);

  /** Generation counter to prevent stale re-diff results from overwriting newer ones. */
  let diffGeneration = 0;

  /**
   * When diffSource changes, re-diff the primary mod against the chosen comparison source.
   * Vanilla → clear the override; mod index → call backend rediff.
   */
  $effect(() => {
    const source = modStore.diffSource;
    const primaryPath = modStore.selectedModPath;
    if (!primaryPath) return;

    if (source === "vanilla") {
      modStore.diffOverrideSections = null;
      return;
    }

    const comparePath = modStore.additionalModPaths[source] ?? "";
    if (!comparePath) {
      modStore.diffOverrideSections = null;
      return;
    }

    const gen = ++diffGeneration;
    modStore.isRediffing = true;
    rediffMod(primaryPath, comparePath)
      .then(sections => {
        if (gen === diffGeneration) {
          modStore.diffOverrideSections = sections;
        }
      })
      .catch(e => {
        console.warn("Re-diff failed:", e);
        if (gen === diffGeneration) {
          modStore.diffOverrideSections = null;
        }
      })
      .finally(() => {
        if (gen === diffGeneration) {
          modStore.isRediffing = false;
        }
      });
  });

  /**
   * For display, merge original sections (for config/selection state) with
   * diff override entries (for visual diff). Map by section key.
   * Also adds stub SectionResult objects for sections that have manual/imported
   * entries but no auto-detected entries (fixes Lists-only import visibility).
   */
  let displaySections = $derived.by(() => {
    const override = modStore.diffOverrideSections;
    let base: SectionResult[] = override
      ? sections.map(s => override.find(o => o.section === s.section) ?? s)
      : sections;

    // Collect sections that have manual entries but no scan entries
    const existingSections = new Set(base.map(s => s.section));
    const stubs: SectionResult[] = [];
    for (const section of SECTIONS_ORDERED) {
      if (!existingSections.has(section) && sectionHasNewEntries(section)) {
        stubs.push({ section, entries: [] });
      }
    }

    return stubs.length > 0 ? [...base, ...stubs] : base;
  });

  /** Split sections into core (CF-eligible + combobox data) and additional data — single-pass partition. */
  let partitioned = $derived.by(() => {
    const core: SectionResult[] = [];
    const additional: SectionResult[] = [];
    for (const s of displaySections) {
      (isCoreSection(s.section as Section) ? core : additional).push(s);
    }
    return { core, additional };
  });

  // ---- Context menu state ----
  let ctxMenu: { x: number; y: number; section: Section } | null = $state(null);

  function openContextMenu(section: Section, e: MouseEvent) {
    ctxMenu = { x: e.clientX, y: e.clientY, section };
  }

  function closeContextMenu() {
    ctxMenu = null;
  }
</script>

<div class="space-y-3">
  {#if modStore.isScanning}
    <div class="text-center text-zinc-400 py-12">
      <div class="inline-block w-6 h-6 border-2 border-zinc-500 border-t-sky-400 rounded-full animate-spin mb-3"></div>
      <p class="text-lg">{m.section_accordion_scanning()}</p>
      <p class="text-sm mt-1 text-zinc-500">{m.section_accordion_parsing()}</p>
    </div>
  {:else}
    <!-- PF-027: Global search bar -->
    <GlobalSearchBar />

    {#if modStore.isRediffing}
      <div class="flex items-center gap-2 text-zinc-400 text-xs px-1 py-1" aria-live="polite">
        <div class="w-3 h-3 border border-zinc-500 border-t-sky-400 rounded-full animate-spin shrink-0" aria-hidden="true"></div>
        <span>{m.section_accordion_comparing()}</span>
      </div>
    {/if}

    <!-- Core sections -->
    {#each partitioned.core as sectionResult (sectionResult.section)}
      <SectionPanel
        {sectionResult}
        globalFilter={modStore.globalFilter}
        oncontextmenu={(e) => openContextMenu(sectionResult.section as Section, e)}
      />
    {/each}

    <!-- Additional Data divider + sections -->
    {#if partitioned.additional.length > 0}
      <div class="flex items-center gap-3 px-2 pt-3 pb-1">
        <div class="flex-1 border-t border-[var(--th-border-700,#3f3f46)]/50"></div>
        <span class="text-xs font-semibold text-[var(--th-text-500)] uppercase tracking-wider whitespace-nowrap">
          {m.section_accordion_additional_data()}
        </span>
        <div class="flex-1 border-t border-[var(--th-border-700,#3f3f46)]/50"></div>
      </div>

      {#each partitioned.additional as sectionResult (sectionResult.section)}
        <SectionPanel
          {sectionResult}
          globalFilter={modStore.globalFilter}
          oncontextmenu={(e) => openContextMenu(sectionResult.section as Section, e)}
        />
      {/each}
    {/if}

    {#if modStore.globalFilter && displaySections.every(s => {
      const q = modStore.globalFilter.toLowerCase();
      return !s.entries.some(e => e.uuid.toLowerCase().includes(q) || (e.display_name?.toLowerCase().includes(q) ?? false) || e.entry_kind.toLowerCase().includes(q));
    })}
      <div class="text-center text-[var(--th-text-500)] py-8 text-sm">
        {m.section_accordion_no_match({ query: modStore.globalFilter })}
      </div>
    {/if}
    {#if sections.length === 0 && !modStore.scanResult}
      <!-- Empty state — no mod scanned yet -->
      <div class="flex flex-col items-center justify-center py-16 px-6 text-center gap-4">
        <div class="opacity-30"><Settings class="w-10 h-10 mx-auto" strokeWidth={1.5} /></div>
        <h2 class="text-sm font-semibold text-[var(--th-text-200)]">{m.section_accordion_no_mod_heading()}</h2>
        <div class="text-xs text-[var(--th-text-500)] max-w-xs space-y-2">
          <p>{m.section_accordion_no_mod_instructions()}</p>
          <ol class="text-left space-y-1.5 list-decimal list-inside">
            <li>{m.section_accordion_step_open_menu()}</li>
            <li>{m.section_accordion_step_browse()}</li>
            <li>{m.section_accordion_step_scan()}</li>
          </ol>
          <p class="pt-2 text-[var(--th-text-600)]">
            {m.section_accordion_supported_formats()}
          </p>
        </div>
        <p class="text-xs text-[var(--th-text-600)] mt-2">{m.section_accordion_command_palette_hint()}</p>
      </div>
    {:else if sections.length === 0}
      <div class="text-center text-zinc-500 py-12">
        <p class="text-lg">{m.section_accordion_no_sections()}</p>
        <p class="text-sm mt-1">{m.section_accordion_no_sections_message()}</p>
      </div>
    {/if}
  {/if}
</div>

<!-- Context menu (portal to body) -->
{#if ctxMenu}
  <SectionContextMenu
    section={ctxMenu.section}
    x={ctxMenu.x}
    y={ctxMenu.y}
    onclose={closeContextMenu}
    onexpand={() => { modStore.sectionExpandCommand = { section: ctxMenu!.section, expand: true }; }}
    oncollapse={() => { modStore.sectionExpandCommand = { section: ctxMenu!.section, expand: false }; }}
    onrefresh={() => { projectStore.refreshSection(sectionToTable(ctxMenu!.section)); }}
  />
{/if}
