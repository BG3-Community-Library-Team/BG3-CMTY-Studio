<script lang="ts">
  import { configStore, type ManualEntry } from "../../lib/stores/configStore.svelte.js";
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

  // Auto-detect sub-races: other Race entries with ParentGuid === this race's UUID
  let detectedSubRaces = $derived.by(() => {
    if (!raceUuid) return [];
    const results: { uuid: string; name: string; enabled: boolean }[] = [];
    for (const e of configStore.manualEntries) {
      if (e.section === "Races" && e.fields.ParentGuid === raceUuid) {
        results.push({
          uuid: e.fields.UUID || "",
          name: e.fields.Name || e.fields.UUID || "Sub-Race",
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
  let existingPresets = $derived.by(() => {
    if (!raceUuid) return [];
    return configStore
      .getManualEntriesForRace(raceUuid)
      .filter((m) => m.entry.section === "CharacterCreationPresets")
      .map((m) => m.entry);
  });

  // Existing DG entries for this race
  let existingDGEntries = $derived.by(() => {
    if (!raceUuid) return [];
    return configStore
      .getManualEntriesForRace(raceUuid)
      .filter((m) => m.entry.fields.Name?.includes("_Daisy"))
      .map((m) => m.entry);
  });

  // Existing root templates for this race
  let existingTemplates = $derived.by(() => {
    if (!raceUuid) return [];
    return configStore
      .getManualEntriesForRace(raceUuid)
      .filter((m) => m.entry.section === "RootTemplates")
      .map((m) => m.entry);
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

  function handleGenerate() {
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
    configStore.addManualEntries(
      allEntries,
      `Generate ${presetEntries.length / 2} presets + ${presetEntries.length / 2} templates${dgEntries.length > 0 ? ` + ${dgEntries.length / 2} DG entries` : ""}`
    );
  }

  /** Find the linked RootTemplate entry for a given CC Preset */
  function findLinkedTemplate(preset: ManualEntry): { entry: ManualEntry; index: number } | undefined {
    const rtUuid = preset.fields.RootTemplate;
    if (!rtUuid) return undefined;
    for (let i = 0; i < configStore.manualEntries.length; i++) {
      const e = configStore.manualEntries[i];
      if (e.section === "RootTemplates" && (e.fields.MapKey === rtUuid || e.fields.UUID === rtUuid)) {
        return { entry: e, index: i };
      }
    }
    return undefined;
  }

  /** Save a single template field inline */
  function saveTemplateField(templateMapKey: string, field: string, value: string) {
    for (let i = 0; i < configStore.manualEntries.length; i++) {
      const e = configStore.manualEntries[i];
      if (e.section === "RootTemplates" && (e.fields.MapKey === templateMapKey || e.fields.UUID === templateMapKey)) {
        const updatedFields = { ...e.fields, [field]: value };
        configStore.updateManualEntry(i, "RootTemplates", updatedFields);
        break;
      }
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
        {#each existingPresets as preset (preset.fields.UUID)}
          {@const linked = findLinkedTemplate(preset)}
          <div class="border border-[var(--th-border-700)] rounded">
            <button
              type="button"
              class="w-full text-left px-2.5 py-1.5 text-xs flex items-center gap-2 hover:bg-[var(--th-bg-800)] transition-colors"
              onclick={() => toggleExpand(preset.fields.UUID)}
              aria-expanded={expandedPresets.has(preset.fields.UUID)}
            >
              <ChevronRight size={10} class="shrink-0 transition-transform {expandedPresets.has(preset.fields.UUID) ? 'rotate-90' : ''}" />
              <span class="text-[var(--th-text-200)]">
                {bodyLabel(Number(preset.fields.BodyShape), Number(preset.fields.BodyType))}
              </span>
              {#if preset.fields.SubRaceUUID && preset.fields.SubRaceUUID !== raceUuid && preset.fields.SubRaceUUID !== "00000000-0000-0000-0000-000000000000"}
                <span class="text-[var(--th-text-500)] text-[10px]">Sub: {preset.fields.SubRaceUUID}</span>
              {/if}
              {#if linked}
                <span class="ml-auto font-mono text-[10px] text-[var(--th-text-500)] truncate max-w-40">RT: {linked.entry.fields.MapKey || linked.entry.fields.UUID}</span>
              {/if}
            </button>

            {#if expandedPresets.has(preset.fields.UUID) && linked}
              <div class="px-3 py-2 border-t border-[var(--th-border-700)] bg-[var(--th-bg-900)] space-y-2">
                <div class="text-[10px] text-[var(--th-text-500)] mb-1">
                  Edit linked RootTemplate — <span class="font-mono select-all">{linked.entry.fields.MapKey || linked.entry.fields.UUID}</span>
                </div>
                {#each ["ParentTemplateId", "CharacterVisualResourceID", "AnimationSetResourceID", "Icon", "Equipment", "SpellSet"] as field}
                  {@const rtKey = linked.entry.fields.MapKey || linked.entry.fields.UUID}
                  <div class="flex flex-col gap-0.5 text-xs">
                    <label class="text-[var(--th-text-400)]" for="rt-{rtKey}-{field}">{field}</label>
                    <input
                      id="rt-{rtKey}-{field}"
                      type="text"
                      class="form-input w-full"
                      value={linked.entry.fields[field] ?? ""}
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
        {#each existingDGEntries as dg (dg.fields.UUID)}
          <div class="flex items-center gap-2 text-xs px-2.5 py-1.5 border border-[var(--th-border-700)] rounded">
            <span class="text-[var(--th-text-200)]">{dg.fields.Name || "DG Entry"}</span>
            {#if dg.fields.ParentTemplateId}
              <span class="ml-auto text-[10px] text-[var(--th-text-500)] font-mono truncate max-w-48">
                Parent: {dg.fields.ParentTemplateId}
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
