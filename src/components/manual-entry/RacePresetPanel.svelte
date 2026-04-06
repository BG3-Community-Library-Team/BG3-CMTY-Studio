<script lang="ts">
  import { projectStore, sectionToTable } from "../../lib/stores/projectStore.svelte.js";
  import type { EntryRow } from "../../lib/types/entryRow.js";
  import { generatePresets, generateDreamGuardianEntries, type PresetGeneratorInput, type GeneratedEntry } from "../../lib/utils/racePresetGenerator.js";
  import { tooltip } from "../../lib/actions/tooltip.js";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  let {
    raceUuid,
    raceName,
  }: {
    raceUuid: string;
    raceName: string;
  } = $props();

  type CameraBase = "HUM" | "ELF" | "HUM_MB" | "DRG";

  // Body matrix: which shape×type combos to generate
  let bodyMatrix: { shape: number; type: number; enabled: boolean }[] = $state([
    { shape: 0, type: 0, enabled: true },
    { shape: 0, type: 1, enabled: true },
    { shape: 1, type: 0, enabled: true },
    { shape: 1, type: 1, enabled: true },
  ]);

  let cameraBase: CameraBase = $state("HUM");

  /** Check if an EntryRow references a particular race UUID. */
  function matchesRace(e: EntryRow, uuid: string): boolean {
    return (
      String(e.RaceUUID ?? '') === uuid ||
      String(e.Race ?? '') === uuid ||
      String(e.ParentGuid ?? '') === uuid ||
      String(e.SubRaceUUID ?? '') === uuid
    );
  }

  // Auto-detect sub-races: other Race entries with ParentGuid === this race's UUID
  let detectedSubRaces = $derived.by(() => {
    if (!raceUuid) return [];
    const results: { uuid: string; name: string; enabled: boolean }[] = [];
    const raceEntries = projectStore.getEntries(sectionToTable("Races"));
    for (const e of raceEntries) {
      if (String(e.ParentGuid ?? '') === raceUuid) {
        results.push({
          uuid: String(e.UUID ?? ''),
          name: String(e.Name ?? e.UUID ?? 'Sub-Race'),
          enabled: true,
        });
      }
    }
    return results;
  });

  let subRaceSelections = $state<Record<string, boolean>>({});

  // Sync sub-race selections when detected list changes
  $effect(() => {
    for (const sr of detectedSubRaces) {
      if (!(sr.uuid in subRaceSelections)) {
        subRaceSelections[sr.uuid] = true;
      }
    }
  });

  let selectedBodyCombos = $derived(
    bodyMatrix.filter((b) => b.enabled).map((b) => ({ shape: b.shape, type: b.type }))
  );

  let selectedSubRaces = $derived(
    detectedSubRaces
      .filter((sr) => subRaceSelections[sr.uuid] !== false)
      .map((sr) => ({ uuid: sr.uuid, name: sr.name }))
  );

  let presetCount = $derived.by(() => {
    const targets = selectedSubRaces.length > 0 ? selectedSubRaces.length : 1;
    return selectedBodyCombos.length * targets;
  });

  let dgCount = $derived(selectedBodyCombos.length * 2); // RT + Preset per body combo

  // Existing presets for this race
  let existingPresets = $derived.by((): EntryRow[] => {
    if (!raceUuid) return [];
    const entries = projectStore.getEntries(sectionToTable("CharacterCreationPresets"));
    return entries.filter(e => matchesRace(e, raceUuid));
  });

  // Existing DG entries for this race
  let existingDGEntries = $derived.by((): EntryRow[] => {
    if (!raceUuid) return [];
    const entries = [
      ...projectStore.getEntries(sectionToTable("CharacterCreationPresets")),
      ...projectStore.getEntries(sectionToTable("RootTemplates")),
    ];
    return entries.filter(e => matchesRace(e, raceUuid) && String(e.Name ?? '').includes("_Daisy"));
  });

  // Existing root templates for this race
  let existingTemplates = $derived.by((): EntryRow[] => {
    if (!raceUuid) return [];
    const entries = projectStore.getEntries(sectionToTable("RootTemplates"));
    return entries.filter(e => matchesRace(e, raceUuid));
  });

  let hasExistingPresets = $derived(existingPresets.length > 0);
  let hasDG = $derived(existingDGEntries.length > 0);

  // Expanded template editing state
  let expandedPresets = $state<Set<string>>(new Set());

  function toggleExpand(uuid: string) {
    if (expandedPresets.has(uuid)) {
      expandedPresets.delete(uuid);
    } else {
      expandedPresets.add(uuid);
    }
    expandedPresets = new Set(expandedPresets); // trigger reactivity
  }

  function bodyLabel(shape: number, type: number): string {
    const sex = type === 0 ? "Male" : "Female";
    const build = shape === 0 ? "Regular" : "Strong";
    return `${sex} ${build}`;
  }

  async function handleGenerate() {
    if (selectedBodyCombos.length === 0) return;

    const presetEntries = generatePresets({
      raceUuid,
      raceName,
      subRaces: selectedSubRaces,
      bodyMatrix: selectedBodyCombos,
      cameraBase,
    });

    // Check for existing DG data — skip DG generation if already present
    let dgEntries: GeneratedEntry[] = [];
    if (!hasDG) {
      dgEntries = generateDreamGuardianEntries({
        raceUuid,
        raceName,
        bodyMatrix: selectedBodyCombos,
        cameraBase,
      });
    }

    const allEntries = [...presetEntries, ...dgEntries];
    const label = `Generate ${presetEntries.length / 2} presets + ${presetEntries.length / 2} templates${dgEntries.length > 0 ? ` + ${dgEntries.length / 2} DG entries` : ""}`;
    await projectStore.snapshot(label);
    for (const entry of allEntries) {
      await projectStore.addEntry(sectionToTable(entry.section), entry.fields);
    }
  }

  /** Find the linked RootTemplate entry for a given CC Preset */
  function findLinkedTemplate(preset: EntryRow): EntryRow | undefined {
    const rtUuid = String(preset.RootTemplate ?? '');
    if (!rtUuid) return undefined;
    const templates = projectStore.getEntries(sectionToTable("RootTemplates"));
    return templates.find(e =>
      String(e.MapKey ?? '') === rtUuid || String(e.UUID ?? '') === rtUuid
    );
  }

  /** Save a single template field inline */
  async function saveTemplateField(templateMapKey: string, field: string, value: string) {
    const templates = projectStore.getEntries(sectionToTable("RootTemplates"));
    const tmpl = templates.find(e =>
      String(e.MapKey ?? '') === templateMapKey || String(e.UUID ?? '') === templateMapKey
    );
    if (tmpl) {
      await projectStore.updateEntry(sectionToTable("RootTemplates"), tmpl._pk, { [field]: value });
    }
  }
</script>

<div class="preset-panel space-y-3">
  <!-- Body Matrix -->
  <div class="space-y-1.5">
    <span class="text-xs font-medium text-[var(--th-text-400)]">Body Matrix</span>
    <div class="grid grid-cols-2 gap-1.5">
      {#each bodyMatrix as body, i}
        <label class="flex items-center gap-2 text-xs cursor-pointer px-2 py-1 rounded hover:bg-[var(--th-bg-800)]">
          <input type="checkbox" bind:checked={bodyMatrix[i].enabled} class="accent-sky-500" />
          <span class={body.enabled ? "text-[var(--th-text-200)]" : "text-[var(--th-text-500)]"}>
            {bodyLabel(body.shape, body.type)}
          </span>
        </label>
      {/each}
    </div>
  </div>

  <!-- Camera Base -->
  <div class="space-y-1">
    <label class="text-xs font-medium text-[var(--th-text-400)]" for="preset-camera-base">Camera Base</label>
    <select id="preset-camera-base" class="form-input w-full text-xs" bind:value={cameraBase}>
      <option value="HUM">Human (HUM)</option>
      <option value="ELF">Elf (ELF)</option>
      <option value="DRG">Dragonborn (DRG)</option>
      <option value="HUM_MB">Human MB (HUM_MB)</option>
    </select>
  </div>

  <!-- Sub-races (auto-detected) -->
  {#if detectedSubRaces.length > 0}
    <div class="space-y-1.5">
      <span class="text-xs font-medium text-[var(--th-text-400)]">Sub-Races</span>
      <div class="flex flex-wrap gap-2">
        {#each detectedSubRaces as sr}
          <label class="flex items-center gap-2 text-xs cursor-pointer px-2 py-1 rounded hover:bg-[var(--th-bg-800)]">
            <input type="checkbox" bind:checked={subRaceSelections[sr.uuid]} class="accent-sky-500" />
            <span class={subRaceSelections[sr.uuid] !== false ? "text-[var(--th-text-200)]" : "text-[var(--th-text-500)]"}>
              {sr.name}
            </span>
          </label>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Summary + Generate -->
  <div class="flex items-center gap-3 pt-1">
    <span class="text-xs text-[var(--th-text-400)]">
      Will generate <strong class="text-[var(--th-text-200)]">{presetCount}</strong> preset{presetCount !== 1 ? "s" : ""}
      + <strong class="text-[var(--th-text-200)]">{presetCount}</strong> root template{presetCount !== 1 ? "s" : ""}
      {#if !hasDG}
        + <strong class="text-[var(--th-text-200)]">{dgCount}</strong> DG entr{dgCount !== 1 ? "ies" : "y"}
      {/if}
    </span>
    <button
      type="button"
      class="ml-auto px-3 py-1.5 text-xs font-medium text-sky-300 bg-sky-900/40 border border-sky-700/50 rounded hover:bg-sky-800/50 transition-colors inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
      onclick={handleGenerate}
      disabled={selectedBodyCombos.length === 0 || !raceUuid}
      use:tooltip={hasExistingPresets ? "Presets already exist — generating will add more" : "Generate CC Presets, RootTemplates, and Dream Guardian entries"}
    >
      <Plus size={12} />
      {hasExistingPresets ? "Generate More" : "Generate Presets"}
    </button>
  </div>

  <!-- Existing CC Presets -->
  {#if existingPresets.length > 0}
    <details class="form-subsection" open>
      <summary class="layout-subsection-summary text-xs font-semibold text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] select-none flex items-center gap-1.5">
        <ChevronRight size={12} class="layout-chevron shrink-0 transition-transform" />
        Existing Presets ({existingPresets.length})
      </summary>
      <div class="space-y-1 mt-2">
        {#each existingPresets as preset (String(preset.UUID))}
          {@const linked = findLinkedTemplate(preset)}
          <div class="border border-[var(--th-border-700)] rounded">
            <button
              type="button"
              class="w-full text-left px-2.5 py-1.5 text-xs flex items-center gap-2 hover:bg-[var(--th-bg-800)] transition-colors"
              onclick={() => toggleExpand(String(preset.UUID))}
              aria-expanded={expandedPresets.has(String(preset.UUID))}
            >
              <ChevronRight size={10} class="shrink-0 transition-transform {expandedPresets.has(String(preset.UUID)) ? 'rotate-90' : ''}" />
              <span class="text-[var(--th-text-200)]">
                {bodyLabel(Number(preset.BodyShape), Number(preset.BodyType))}
              </span>
              {#if preset.SubRaceUUID && String(preset.SubRaceUUID) !== raceUuid && String(preset.SubRaceUUID) !== "00000000-0000-0000-0000-000000000000"}
                <span class="text-[var(--th-text-500)] text-[10px]">Sub: {String(preset.SubRaceUUID)}</span>
              {/if}
              {#if linked}
                <span class="ml-auto font-mono text-[10px] text-[var(--th-text-500)] truncate max-w-40">RT: {String(linked.MapKey ?? linked.UUID ?? '')}</span>
              {/if}
            </button>

            {#if expandedPresets.has(String(preset.UUID)) && linked}
              <div class="px-3 py-2 border-t border-[var(--th-border-700)] bg-[var(--th-bg-900)] space-y-2">
                <div class="text-[10px] text-[var(--th-text-500)] mb-1">
                  Edit linked RootTemplate — <span class="font-mono select-all">{String(linked.MapKey ?? linked.UUID ?? '')}</span>
                </div>
                {#each ["ParentTemplateId", "CharacterVisualResourceID", "AnimationSetResourceID", "Icon", "Equipment", "SpellSet"] as field}
                  {@const rtKey = String(linked.MapKey ?? linked.UUID ?? '')}
                  <div class="flex flex-col gap-0.5 text-xs">
                    <label class="text-[var(--th-text-400)]" for="rt-{rtKey}-{field}">{field}</label>
                    <input
                      id="rt-{rtKey}-{field}"
                      type="text"
                      class="form-input w-full"
                      value={String(linked[field] ?? '')}
                      onblur={(e) => saveTemplateField(rtKey, field, (e.target as HTMLInputElement).value)}
                      placeholder={field === "ParentTemplateId" ? "UUID of parent template" : ""}
                    />
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </details>
  {/if}

  <!-- Existing DG entries -->
  {#if existingDGEntries.length > 0}
    <details class="form-subsection">
      <summary class="layout-subsection-summary text-xs font-semibold text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] select-none flex items-center gap-1.5">
        <ChevronRight size={12} class="layout-chevron shrink-0 transition-transform" />
        Dream Guardian Entries ({existingDGEntries.length})
      </summary>
      <div class="space-y-1 mt-2">
        {#each existingDGEntries as dg (String(dg.UUID))}
          <div class="flex items-center gap-2 text-xs px-2.5 py-1.5 border border-[var(--th-border-700)] rounded">
            <span class="text-[var(--th-text-200)]">{String(dg.Name ?? '') || "DG Entry"}</span>
            {#if dg.ParentTemplateId}
              <span class="ml-auto text-[10px] text-[var(--th-text-500)] font-mono truncate max-w-48">
                Parent: {String(dg.ParentTemplateId)}
              </span>
            {/if}
          </div>
        {/each}
      </div>
    </details>
  {/if}

  <!-- Empty state -->
  {#if existingPresets.length === 0 && existingTemplates.length === 0}
    <div class="flex flex-col items-center justify-center py-3 border border-dashed border-[var(--th-border-700)] rounded">
      <p class="text-xs text-[var(--th-text-500)]">No presets generated for this race yet.</p>
    </div>
  {/if}
</div>
