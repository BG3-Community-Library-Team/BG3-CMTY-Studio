<!--
  Meta.lsx Form — Displays and edits mod metadata from meta.lsx.
  Shows all ModuleInfo fields, Dependencies, PublishVersion, and TargetModes.
  Includes Version64 translation, UUID regeneration, save to disk, and
  Advanced Fields collapsible section.
-->
<script lang="ts">
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import { saveConfig, renameDir } from "../lib/utils/tauri.js";
  import { modImportService } from "../lib/services/modImportService.svelte.js";
  import { localeSortStrings } from "../lib/utils/localeSort.js";
  import { onMount } from "svelte";
  import Cog from "@lucide/svelte/icons/cog";
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Shuffle from "@lucide/svelte/icons/shuffle";
  import Save from "@lucide/svelte/icons/save";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import MultiSelectCombobox from "./MultiSelectCombobox.svelte";
  import SingleSelectCombobox from "./SingleSelectCombobox.svelte";
  import { m } from "../paraglide/messages.js";
  import { generateUuid } from "../lib/utils/uuid.js";

  let meta = $derived(modStore.scanResult?.mod_meta);

  // Listen for Ctrl+S dispatched from App.svelte
  onMount(() => {
    function onSave() { handleSave(); }
    window.addEventListener("save-active-file", onSave);
    return () => window.removeEventListener("save-active-file", onSave);
  });

  // ── Version64 helpers ──
  // BG3 Version64: 64-bit int where bits encode major.minor.revision.build
  // Layout: major(32-28) | minor(27-24) | revision(23-16) | build(15-0) — each left-shifted
  // major << 55, minor << 47, revision << 31, build << 0
  function version64ToParts(v64: string): { major: number; minor: number; revision: number; build: number } {
    try {
      const n = BigInt(v64);
      const major = Number((n >> 55n) & 0xFFn);
      const minor = Number((n >> 47n) & 0xFFn);
      const revision = Number((n >> 31n) & 0xFFFFn);
      const build = Number(n & 0x7FFFFFFFn);
      return { major, minor, revision, build };
    } catch {
      return { major: 1, minor: 0, revision: 0, build: 0 };
    }
  }

  function partsToVersion64(major: number, minor: number, revision: number, build: number): string {
    const n = (BigInt(major & 0xFF) << 55n) |
              (BigInt(minor & 0xFF) << 47n) |
              (BigInt(revision & 0xFFFF) << 31n) |
              BigInt(build & 0x7FFFFFFF);
    return n.toString();
  }

  // ── ModuleInfo fields ──
  let editName = $state("");
  let editAuthor = $state("");
  let editDescription = $state("");
  let editFolder = $state("");
  let editUuid = $state("");
  let editVersion64 = $state("36028797018963968");
  let editMd5 = $state("");
  let editType = $state("Add-on");
  let editTags = $state("");
  let editNumPlayers = $state("4");
  let editGmTemplate = $state("");
  let editCharCreationLevel = $state("");
  let editLobbyLevel = $state("");
  let editMenuLevel = $state("");
  let editStartupLevel = $state("");
  let editPhotoBooth = $state("");
  let editMainMenuBgVideo = $state("");
  let editPublishVersion = $state("36028797018963968");
  let editTargetMode = $state("Story");

  // ── Version display state ──
  let versionParts = $derived(version64ToParts(editVersion64));
  let publishVersionParts = $derived(version64ToParts(editPublishVersion));
  let versionDisplay = $derived(`${versionParts.major}.${versionParts.minor}.${versionParts.revision}.${versionParts.build}`);
  let publishVersionDisplay = $derived(`${publishVersionParts.major}.${publishVersionParts.minor}.${publishVersionParts.revision}.${publishVersionParts.build}`);

  // ── Dependencies ──
  let dependencies: { uuid: string; name: string; folder: string; md5: string; version64: string }[] = $state([]);
  let newDepUuid = $state("");
  let newDepName = $state("");
  let newDepFolder = $state("");
  let newDepVersion64 = $state("36028797018963968");

  // ── Advanced toggle ──
  let showAdvanced = $state(false);

  // ── Save state ──
  let isSaving = $state(false);

  // ── PublishVersion sync toggle ──
  let syncPublishVersion = $state(true);

  // When syncPublishVersion is on, keep PublishVersion in sync with Version
  $effect(() => {
    if (syncPublishVersion) {
      editPublishVersion = editVersion64;
    }
  });

  // ── UUID warning modal ──
  let showUuidWarning = $state(false);
  let pendingUuidAction: (() => void) | null = $state(null);

  function requestUuidChange() {
    pendingUuidAction = () => { editUuid = generateUuid(); };
    showUuidWarning = true;
  }

  function confirmUuidChange() {
    pendingUuidAction?.();
    pendingUuidAction = null;
    showUuidWarning = false;
  }

  function cancelUuidChange() {
    pendingUuidAction = null;
    showUuidWarning = false;
  }

  // Track the original folder to detect changes
  let originalFolder = $state("");
  $effect(() => {
    if (meta?.folder && !originalFolder) originalFolder = meta.folder;
  });

  function onFolderInput(newFolder: string) {
    if (originalFolder && newFolder !== originalFolder && newFolder.trim()) {
      pendingUuidAction = () => { editFolder = newFolder; };
      showUuidWarning = true;
    } else {
      editFolder = newFolder;
    }
  }

  // ── Dependencies manual toggle ──
  let depManualMode = $state(false);

  // ── Tags multiselect ──
  let editTagsList = $derived(editTags ? editTags.split(";").map(t => t.trim()).filter(Boolean) : []);

  /** Collect tag options from additional mods and the current mod */
  let tagOptions = $derived.by(() => {
    const tags = new Set<string>();
    // From current mod meta
    if (meta?.tags) {
      for (const t of meta.tags.split(";")) {
        const trimmed = t.trim();
        if (trimmed) tags.add(trimmed);
      }
    }
    // From additional mods
    for (const res of modStore.additionalModResults) {
      if (res.mod_meta?.tags) {
        for (const t of res.mod_meta.tags.split(";")) {
          const trimmed = t.trim();
          if (trimmed) tags.add(trimmed);
        }
      }
    }
    // Common BG3 tags
    for (const common of ["CharacterCentric", "Classes", "Races", "Spells", "Items", "Story", "Gameplay", "UI", "Cosmetic", "QoL", "Overhaul", "Balance", "Companions", "Subclasses", "Feats", "Backgrounds", "Origins"]) {
      tags.add(common);
    }
    return localeSortStrings([...tags]).map(t => ({ value: t, label: t }));
  });

  /** Dependency combobox options: display format [ModName] UUID */
  let depModOptions = $derived.by(() => {
    const opts: { value: string; label: string }[] = [];
    const seen = new Set<string>();
    // From scan results
    for (const m of additionalModMetas) {
      if (m.uuid && !seen.has(m.uuid)) {
        seen.add(m.uuid);
        opts.push({ value: m.uuid, label: `[${m.name || m.folder}] ${m.uuid}` });
      }
    }
    // Also include mods from modImportService.additionalModMeta (may have mods not yet in scan results)
    for (const meta of Object.values(modImportService.additionalModMeta)) {
      if (meta?.uuid && !seen.has(meta.uuid)) {
        seen.add(meta.uuid);
        opts.push({ value: meta.uuid, label: `[${meta.name || meta.folder}] ${meta.uuid}` });
      }
    }
    return opts;
  });

  // ── Additional mod meta for dependency combobox ──
  let additionalModMetas = $derived(
    modStore.additionalModResults
      .map(r => r.mod_meta)
      .filter((m): m is NonNullable<typeof m> => !!m)
  );

  // Initialize from meta when it changes
  $effect(() => {
    if (meta) {
      editName = meta.name ?? "";
      editAuthor = meta.author ?? "";
      editFolder = meta.folder ?? "";
      editUuid = meta.uuid ?? "";
      if (meta.version64) editVersion64 = meta.version64;
      editDescription = meta.description ?? "";
      editMd5 = meta.md5 ?? "";
      editType = meta.mod_type || "Add-on";
      editTags = meta.tags ?? "";
      if (meta.num_players) editNumPlayers = meta.num_players;
      editGmTemplate = meta.gm_template ?? "";
      editCharCreationLevel = meta.char_creation_level ?? "";
      editLobbyLevel = meta.lobby_level ?? "";
      editMenuLevel = meta.menu_level ?? "";
      editStartupLevel = meta.startup_level ?? "";
      editPhotoBooth = meta.photo_booth ?? "";
      editMainMenuBgVideo = meta.main_menu_bg_video ?? "";
      if (meta.publish_version) editPublishVersion = meta.publish_version;
      if (meta.target_mode) editTargetMode = meta.target_mode;
      if (meta.dependencies?.length) {
        dependencies = meta.dependencies.map(d => ({
          uuid: d.uuid,
          name: d.name,
          folder: d.folder,
          md5: d.md5,
          version64: d.version64,
        }));
      }
    }
  });

  /** Parse "major.minor.revision.build" string — only digits and dots allowed */
  function parseVersionString(input: string): { major: number; minor: number; revision: number; build: number } | null {
    // Only allow digits and dots in the format N.N.N.N
    if (!/^\d+(\.\d+){0,3}$/.test(input.trim())) return null;
    const parts = input.split(".").map(s => parseInt(s.trim()));
    if (parts.some(n => isNaN(n))) return null;
    return {
      major: Math.max(0, parts[0] ?? 0),
      minor: Math.max(0, parts[1] ?? 0),
      revision: Math.max(0, parts[2] ?? 0),
      build: Math.max(0, parts[3] ?? 0),
    };
  }

  /** Filter version input to only allow digits and dots, max 3 dots (4 segments) */
  function filterVersionInput(e: Event) {
    const input = e.target as HTMLInputElement;
    let val = input.value.replace(/[^\d.]/g, "");
    // Limit to at most 3 dots (major.minor.revision.build)
    const parts = val.split(".");
    if (parts.length > 4) val = parts.slice(0, 4).join(".");
    input.value = val;
  }

  function updateVersion(input: string) {
    const p = parseVersionString(input);
    if (p) editVersion64 = partsToVersion64(p.major, p.minor, p.revision, p.build);
  }

  function updatePublishVersion(input: string) {
    const p = parseVersionString(input);
    if (p) editPublishVersion = partsToVersion64(p.major, p.minor, p.revision, p.build);
  }

  function updateDepVersion(idx: number, input: string) {
    const dep = dependencies[idx];
    if (!dep) return;
    const p = parseVersionString(input);
    if (p) {
      dep.version64 = partsToVersion64(p.major, p.minor, p.revision, p.build);
      dependencies = [...dependencies];
    }
  }

  function addDependency() {
    const uuid = newDepUuid.trim();
    if (!uuid) return;
    if (dependencies.some(d => d.uuid === uuid)) return;
    dependencies = [...dependencies, {
      uuid,
      name: newDepName.trim() || uuid,
      folder: newDepFolder.trim(),
      md5: "",
      version64: newDepVersion64,
    }];
    newDepUuid = "";
    newDepName = "";
    newDepFolder = "";
    newDepVersion64 = "36028797018963968";
  }

  function removeDependency(uuid: string) {
    dependencies = dependencies.filter(d => d.uuid !== uuid);
  }

  /** Auto-fill dependency fields when selecting a known mod UUID */
  function onDepUuidChange(value: string) {
    newDepUuid = value;
    const match = additionalModMetas.find(m => m.uuid === value);
    if (match) {
      newDepName = match.name || match.folder;
      newDepFolder = match.folder;
      if (match.version64) newDepVersion64 = match.version64;
    } else {
      // Also check modImportService.additionalModMeta
      const svcMatch = Object.values(modImportService.additionalModMeta).find(m => m?.uuid === value);
      if (svcMatch) {
        newDepName = svcMatch.name || svcMatch.folder;
        newDepFolder = svcMatch.folder;
        if (svcMatch.version64) newDepVersion64 = svcMatch.version64;
      }
    }
  }

  /** Build meta.lsx XML content and save to disk */
  async function handleSave() {
    if (!modStore.selectedModPath || !meta) return;
    isSaving = true;
    try {
      const folder = editFolder || meta.folder;
      const modPath = modStore.selectedModPath;

      // Rename directories if folder name changed
      if (originalFolder && folder !== originalFolder) {
        const modsOld = `${modPath}/Mods/${originalFolder}`;
        const modsNew = `${modPath}/Mods/${folder}`;
        const publicOld = `${modPath}/Public/${originalFolder}`;
        const publicNew = `${modPath}/Public/${folder}`;
        try {
          await renameDir(modsOld, modsNew);
        } catch (e) {
          // Mods folder might not exist yet for new mods — that's OK
          console.warn("Mods folder rename skipped:", e);
        }
        try {
          await renameDir(publicOld, publicNew);
        } catch (e) {
          console.warn("Public folder rename skipped:", e);
        }
        originalFolder = folder;
      }

      const xml = buildMetaLsx();
      const metaPath = `${modPath}/Mods/${folder}/meta.lsx`;
      await saveConfig(xml, metaPath, true);
      toastStore.success(m.meta_lsx_saved_title(), m.meta_lsx_saved_message({ folder }));
    } catch (e: any) {
      toastStore.error("Save failed", String(e?.message ?? e));
    } finally {
      isSaving = false;
    }
  }

  function buildMetaLsx(): string {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    let xml = `<?xml version="1.0" encoding="utf-8"?>\n<save>\n  <version major="4" minor="0" revision="0" build="49" />\n  <region id="Config">\n    <node id="root">\n      <children>\n`;
    // Dependencies
    xml += `        <node id="Dependencies">\n`;
    if (dependencies.length > 0) {
      xml += `          <children>\n`;
      for (const dep of dependencies) {
        xml += `            <node id="ModuleShortDesc">\n`;
        xml += `              <attribute id="Folder" type="LSWString" value="${esc(dep.folder)}" />\n`;
        xml += `              <attribute id="MD5" type="LSString" value="${esc(dep.md5)}" />\n`;
        xml += `              <attribute id="Name" type="FixedString" value="${esc(dep.name)}" />\n`;
        xml += `              <attribute id="UUID" type="FixedString" value="${esc(dep.uuid)}" />\n`;
        xml += `              <attribute id="Version64" type="int64" value="${esc(dep.version64)}" />\n`;
        xml += `            </node>\n`;
      }
      xml += `          </children>\n`;
    }
    xml += `        </node>\n`;
    // ModuleInfo
    xml += `        <node id="ModuleInfo">\n`;
    xml += `          <attribute id="Author" type="LSWString" value="${esc(editAuthor)}" />\n`;
    xml += `          <attribute id="CharacterCreationLevelName" type="FixedString" value="${esc(editCharCreationLevel)}" />\n`;
    xml += `          <attribute id="Description" type="LSWString" value="${esc(editDescription)}" />\n`;
    xml += `          <attribute id="Folder" type="LSWString" value="${esc(editFolder)}" />\n`;
    xml += `          <attribute id="GMTemplate" type="FixedString" value="${esc(editGmTemplate)}" />\n`;
    xml += `          <attribute id="LobbyLevelName" type="FixedString" value="${esc(editLobbyLevel)}" />\n`;
    xml += `          <attribute id="MD5" type="LSString" value="${esc(editMd5)}" />\n`;
    xml += `          <attribute id="MainMenuBackgroundVideo" type="FixedString" value="${esc(editMainMenuBgVideo)}" />\n`;
    xml += `          <attribute id="MenuLevelName" type="FixedString" value="${esc(editMenuLevel)}" />\n`;
    xml += `          <attribute id="Name" type="FixedString" value="${esc(editName)}" />\n`;
    xml += `          <attribute id="NumPlayers" type="uint8" value="${esc(editNumPlayers)}" />\n`;
    xml += `          <attribute id="PhotoBooth" type="FixedString" value="${esc(editPhotoBooth)}" />\n`;
    xml += `          <attribute id="StartupLevelName" type="FixedString" value="${esc(editStartupLevel)}" />\n`;
    xml += `          <attribute id="Tags" type="LSWString" value="${esc(editTags)}" />\n`;
    xml += `          <attribute id="Type" type="FixedString" value="${esc(editType)}" />\n`;
    xml += `          <attribute id="UUID" type="FixedString" value="${esc(editUuid)}" />\n`;
    xml += `          <attribute id="Version64" type="int64" value="${esc(editVersion64)}" />\n`;
    xml += `          <children>\n`;
    xml += `            <node id="PublishVersion">\n`;
    xml += `              <attribute id="Version64" type="int64" value="${esc(editPublishVersion)}" />\n`;
    xml += `            </node>\n`;
    xml += `            <node id="Scripts" />\n`;
    xml += `            <node id="TargetModes">\n`;
    xml += `              <children>\n`;
    xml += `                <node id="Target">\n`;
    xml += `                  <attribute id="Object" type="FixedString" value="${esc(editTargetMode)}" />\n`;
    xml += `                </node>\n`;
    xml += `              </children>\n`;
    xml += `            </node>\n`;
    xml += `          </children>\n`;
    xml += `        </node>\n`;
    xml += `      </children>\n`;
    xml += `    </node>\n`;
    xml += `  </region>\n`;
    xml += `</save>\n`;
    return xml;
  }

  const inputClass = "form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] rounded px-2 py-1.5 text-xs text-[var(--th-text-100)] focus:border-[var(--th-accent-500,#0ea5e9)]";
  const monoInputClass = `${inputClass} font-mono`;
  const labelClass = "text-[var(--th-text-400)] font-medium";
  const versionInputClass = "w-full bg-[var(--th-bg-800)] border border-[var(--th-border-600)] rounded px-2 py-1 text-xs font-mono text-[var(--th-text-100)] focus:border-[var(--th-accent-500,#0ea5e9)]";
</script>

<div class="h-full overflow-y-auto scrollbar-thin">
  <div class="p-4 space-y-4">
    <!-- Header with UUID preview and save button -->
    <div class="flex items-center gap-2 mb-2">
      <Cog size={18} class="text-amber-400/80" />
      <h2 class="text-sm font-semibold text-[var(--th-text-200)]">{m.meta_lsx_heading()}</h2>
      {#if meta}
        <button
          type="button"
          class="inline-flex items-center justify-center w-4 h-4 rounded text-[var(--th-text-500)]
                 hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-600)] transition-colors cursor-pointer ml-1"
          onclick={requestUuidChange}
          title={m.meta_lsx_generate_uuid()}
          aria-label={m.meta_lsx_generate_uuid()}
        ><Shuffle size={10} /></button>
        <span class="font-mono text-[10px] text-[var(--th-text-400)] select-all cursor-text truncate">{editUuid}</span>
        <span class="flex-1"></span>
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium
                 bg-emerald-600 hover:bg-emerald-500 text-white transition-colors
                 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          onclick={handleSave}
          disabled={isSaving || !modStore.selectedModPath}
          title={m.meta_lsx_save_tooltip()}
        >
          <Save size={12} />
          {isSaving ? m.meta_lsx_saving() : m.common_save()}
        </button>
      {/if}
    </div>

    {#if !meta}
      <div class="text-xs text-[var(--th-text-500)]">
        {m.meta_lsx_no_metadata()}
      </div>
    {:else}
      <div class="flex flex-col xl:flex-row gap-4 xl:items-start">
      <!-- ── Mod Information ── -->
      <div class="border border-[var(--th-border-800,var(--th-bg-700))] rounded-lg overflow-hidden flex-1 min-w-0">
        <div class="px-4 py-2.5 bg-[var(--th-bg-900)] text-xs font-semibold text-[var(--th-text-200)]">{m.meta_lsx_mod_info()}</div>
        <div class="px-4 py-3 space-y-3 bg-[var(--th-bg-900)]/50">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="flex flex-col gap-1 text-xs">
              <span class={labelClass}>{m.meta_lsx_name()}</span>
              <input type="text" class={inputClass} bind:value={editName} />
            </label>
            <label class="flex flex-col gap-1 text-xs">
              <span class={labelClass}>{m.meta_lsx_author()}</span>
              <input type="text" class={inputClass} bind:value={editAuthor} />
            </label>
            <label class="flex flex-col gap-1 text-xs">
              <span class={labelClass}>{m.meta_lsx_folder()}</span>
              <input type="text" class={inputClass} bind:value={editFolder}
                     onblur={() => {
                       if (originalFolder && editFolder !== originalFolder && editFolder.trim()) {
                         const newFolder = editFolder;
                         editFolder = originalFolder;
                         pendingUuidAction = () => { editFolder = newFolder; };
                         showUuidWarning = true;
                       }
                     }} />
            </label>
            <label class="flex flex-col gap-1 text-xs">
              <span class={labelClass}>{m.meta_lsx_type()}</span>
              <select class={inputClass} bind:value={editType}>
                <option value="Add-on">{m.meta_lsx_type_addon()}</option>
                <option value="Adventure">{m.meta_lsx_type_adventure()}</option>
                <option value="Patch">{m.meta_lsx_type_patch()}</option>
                <option value="GMC">{m.meta_lsx_type_gmc()}</option>
              </select>
            </label>
          </div>
          <label class="flex flex-col gap-1 text-xs">
            <span class={labelClass}>{m.meta_lsx_description()}</span>
            <textarea class="{inputClass} min-h-[60px] resize-y" bind:value={editDescription} rows="2" placeholder="Mod description"></textarea>
          </label>

          <!-- Version64 with translation -->
          <div class="flex flex-col gap-1 text-xs">
            <span class={labelClass}>{m.meta_lsx_version()}</span>
            <div class="flex items-center gap-2">
              <input type="text" class="{versionInputClass} max-w-[140px]" value={versionDisplay}
                     oninput={(e) => { filterVersionInput(e); updateVersion((e.target as HTMLInputElement).value); }}
                     placeholder="1.0.0.0" title="major.minor.revision.build" pattern="\\d+\\.\\d+\\.\\d+\\.\\d+" />
              <span class="text-[10px] text-[var(--th-text-600)] font-mono select-all cursor-text" title="Version64 raw value">{editVersion64}</span>
            </div>
          </div>

          <!-- Tags -->
          <div class="flex flex-col gap-1 text-xs">
            <MultiSelectCombobox
              label={m.meta_lsx_tags()}
              options={tagOptions}
              selected={editTagsList}
              placeholder={m.meta_lsx_search_tags()}
              onchange={(vals) => editTags = vals.join(";")}
            />
          </div>

          <!-- Advanced fields (collapsible) — includes MD5, NumPlayers, GM fields, Publishing -->
          <button
            type="button"
            class="flex items-center gap-1 text-xs text-[var(--th-text-500)] hover:text-[var(--th-text-300)] mt-1"
            onclick={() => showAdvanced = !showAdvanced}
          >
            <ChevronRight size={12} class="transition-transform {showAdvanced ? 'rotate-90' : ''}" />
            {m.meta_lsx_advanced_fields()}
          </button>
          {#if showAdvanced}
            <div class="space-y-3 pl-2 border-l border-[var(--th-border-700)]">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label class="flex flex-col gap-1 text-xs">
                  <span class={labelClass}>{m.meta_lsx_md5()}</span>
                  <input type="text" class={monoInputClass} bind:value={editMd5} placeholder={m.meta_lsx_auto_generated()} />
                </label>
                <label class="flex flex-col gap-1 text-xs">
                  <span class={labelClass}>{m.meta_lsx_num_players()}</span>
                  <input type="number" class={inputClass} bind:value={editNumPlayers} min="1" />
                </label>
                <label class="flex flex-col gap-1 text-xs">
                  <span class={labelClass}>{m.meta_lsx_gm_template()}</span>
                  <input type="text" class={inputClass} bind:value={editGmTemplate} />
                </label>
                <label class="flex flex-col gap-1 text-xs">
                  <span class={labelClass}>{m.meta_lsx_cc_level_name()}</span>
                  <input type="text" class={inputClass} bind:value={editCharCreationLevel} />
                </label>
                <label class="flex flex-col gap-1 text-xs">
                  <span class={labelClass}>{m.meta_lsx_lobby_level()}</span>
                  <input type="text" class={inputClass} bind:value={editLobbyLevel} />
                </label>
                <label class="flex flex-col gap-1 text-xs">
                  <span class={labelClass}>{m.meta_lsx_menu_level()}</span>
                  <input type="text" class={inputClass} bind:value={editMenuLevel} />
                </label>
                <label class="flex flex-col gap-1 text-xs">
                  <span class={labelClass}>{m.meta_lsx_startup_level()}</span>
                  <input type="text" class={inputClass} bind:value={editStartupLevel} />
                </label>
                <label class="flex flex-col gap-1 text-xs">
                  <span class={labelClass}>{m.meta_lsx_photo_booth()}</span>
                  <input type="text" class={inputClass} bind:value={editPhotoBooth} />
                </label>
                <label class="flex flex-col gap-1 text-xs">
                  <span class={labelClass}>{m.meta_lsx_main_menu_bg_video()}</span>
                  <input type="text" class={inputClass} bind:value={editMainMenuBgVideo} />
                </label>
              </div>

              <!-- Publishing (moved into Advanced) -->
              <div class="mt-3 pt-3 border-t border-[var(--th-border-700)]/50">
                <div class="text-xs font-medium text-[var(--th-text-300)] mb-2">{m.meta_lsx_publishing()}</div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1 text-xs">
                    <div class="flex items-center gap-2">
                      <span class={labelClass}>{m.meta_lsx_publish_version()}</span>
                      <label class="flex items-center gap-1 text-[10px] text-[var(--th-text-500)] cursor-pointer">
                        <input type="checkbox" class="accent-[var(--th-accent-500)]" bind:checked={syncPublishVersion} />
                        {m.meta_lsx_sync()}
                      </label>
                    </div>
                    <div class="flex items-center gap-2">
                      <input type="text" class="{versionInputClass} max-w-[140px]" value={publishVersionDisplay}
                             oninput={(e) => { filterVersionInput(e); updatePublishVersion((e.target as HTMLInputElement).value); }}
                             disabled={syncPublishVersion}
                             placeholder="1.0.0.0" title="major.minor.revision.build" pattern="\\d+\\.\\d+\\.\\d+\\.\\d+" />
                      <span class="text-[10px] text-[var(--th-text-600)] font-mono select-all cursor-text" title="PublishVersion64 raw value">{editPublishVersion}</span>
                    </div>
                  </div>
                  <label class="flex flex-col gap-1 text-xs">
                    <span class={labelClass}>{m.meta_lsx_target_mode()}</span>
                    <select class={inputClass} bind:value={editTargetMode}>
                      <option value="Story">{m.meta_lsx_target_story()}</option>
                      <option value="GM">{m.meta_lsx_target_gm()}</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- ── Dependencies ── -->
      <div class="border border-[var(--th-border-800,var(--th-bg-700))] rounded-lg overflow-hidden xl:w-[480px] xl:shrink-0">
        <div class="px-4 py-2.5 bg-[var(--th-bg-900)] text-xs font-semibold text-[var(--th-text-200)] flex items-center gap-2">
          <span>{m.meta_lsx_dependencies()}</span>
          {#if dependencies.length > 0}
            <span class="text-[var(--th-text-500)] font-normal">({dependencies.length})</span>
          {/if}
          <span class="flex-1"></span>
          <!-- Manual toggle -->
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 {depManualMode ? 'bg-[var(--th-accent-500,#0ea5e9)]' : 'bg-[var(--th-bg-600,#52525b)]'}"
              role="switch"
              aria-checked={depManualMode}
              aria-label={m.meta_lsx_manual_entry_toggle()}
              onclick={() => depManualMode = !depManualMode}
            >
              <span
                class="pointer-events-none inline-block h-2.5 w-2.5 rounded-full bg-white shadow transition-transform duration-200 {depManualMode ? 'translate-x-3.5' : 'translate-x-0.5'}"
              ></span>
            </button>
            <span class="text-[10px] text-[var(--th-text-400)] font-normal">{m.meta_lsx_manual_toggle()}</span>
          </div>
        </div>
        <div class="px-4 py-3 space-y-3 bg-[var(--th-bg-900)]/50">
          {#if dependencies.length > 0}
            <div class="space-y-1.5">
              {#each dependencies as dep, depIdx}
                {@const depParts = version64ToParts(dep.version64)}
                {@const depVersionDisplay = `${depParts.major}.${depParts.minor}.${depParts.revision}.${depParts.build}`}
                <div class="flex items-start gap-2 px-2.5 py-2 rounded bg-[var(--th-bg-800)] border border-[var(--th-border-700)]">
                  <div class="flex-1 min-w-0 space-y-0.5">
                    <div class="text-xs text-[var(--th-text-200)] font-medium truncate">{dep.name}</div>
                    <div class="text-[10px] text-[var(--th-text-500)] font-mono truncate">{dep.uuid}</div>
                    {#if dep.folder}
                      <div class="text-[10px] text-[var(--th-text-500)]">Folder: {dep.folder}</div>
                    {/if}
                    <div class="flex items-center gap-1 mt-1">
                      <span class="text-[10px] text-[var(--th-text-500)]">Version:</span>
                      <input type="text" class="w-24 bg-[var(--th-bg-700)] border border-[var(--th-border-600)] rounded px-1 py-0.5 text-[10px] font-mono text-[var(--th-text-300)] focus:border-[var(--th-accent-500)]"
                             value={depVersionDisplay} oninput={(e) => updateDepVersion(depIdx, (e.target as HTMLInputElement).value)}
                             placeholder="1.0.0.0" />
                    </div>
                  </div>
                  <button
                    class="text-red-400 hover:text-red-300 p-1 shrink-0 mt-0.5 rounded hover:bg-red-400/10 transition-colors"
                    onclick={() => removeDependency(dep.uuid)}
                    aria-label="Remove dependency"
                  ><X size={16} /></button>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-xs text-[var(--th-text-500)]">{m.meta_lsx_no_dependencies()}</p>
          {/if}

          <!-- Add dependency form -->
          <div class="space-y-2 pt-1">
            {#if depManualMode}
              <!-- Manual mode: UUID, Name, Folder fields -->
              <div class="flex gap-2 items-end">
                <label class="flex flex-col gap-1 text-xs flex-1">
                  <span class={labelClass}>UUID</span>
                  <input
                    type="text"
                    class={monoInputClass}
                    placeholder={m.meta_lsx_dep_uuid_placeholder()}
                    bind:value={newDepUuid}
                    oninput={(e) => onDepUuidChange((e.target as HTMLInputElement).value)}
                    onkeydown={(e) => { if (e.key === "Enter") addDependency(); }}
                  />
                </label>
                <label class="flex flex-col gap-1 text-xs flex-1">
                  <span class={labelClass}>Name</span>
                  <input
                    type="text"
                    class={inputClass}
                    placeholder={m.meta_lsx_dep_name_placeholder()}
                    bind:value={newDepName}
                    onkeydown={(e) => { if (e.key === "Enter") addDependency(); }}
                  />
                </label>
              </div>
              <div class="flex gap-2 items-end">
                <label class="flex flex-col gap-1 text-xs flex-1">
                  <span class={labelClass}>{m.meta_lsx_dep_folder_label()}</span>
                  <input
                    type="text"
                    class={inputClass}
                    placeholder={m.meta_lsx_dep_folder_placeholder()}
                    bind:value={newDepFolder}
                    onkeydown={(e) => { if (e.key === "Enter") addDependency(); }}
                  />
                </label>
                <button
                  class="px-2.5 py-1.5 text-xs rounded bg-[var(--th-accent-500,#0ea5e9)] text-white hover:opacity-90 transition-colors shrink-0 flex items-center gap-1"
                  onclick={addDependency}
                  disabled={!newDepUuid.trim()}
                >
                  <Plus size={12} />
                  {m.common_add()}
                </button>
              </div>
            {:else}
              <!-- Simple mode: Mod combobox only -->
              <div class="flex gap-2 items-end">
                <div class="flex flex-col gap-1 text-xs flex-1 min-w-0">
                  <span class={labelClass}>Mod</span>
                  <SingleSelectCombobox
                    options={depModOptions}
                    value={newDepUuid}
                    placeholder={m.meta_lsx_search_loaded_mods()}
                    onchange={(v) => onDepUuidChange(v)}
                  />
                </div>
                <button
                  class="px-2.5 py-1.5 text-xs rounded bg-[var(--th-accent-500,#0ea5e9)] text-white hover:opacity-90 transition-colors shrink-0 flex items-center gap-1"
                  onclick={addDependency}
                  disabled={!newDepUuid.trim()}
                >
                  <Plus size={12} />
                  {m.common_add()}
                </button>
              </div>
            {/if}
          </div>
        </div>
      </div>
      </div>
    {/if}
  </div>
</div>

<!-- UUID/Folder Change Warning Modal -->
{#if showUuidWarning}
  <div class="fixed inset-0 z-[300] flex items-center justify-center bg-[var(--th-modal-backdrop,rgba(0,0,0,.5))]"
       role="dialog" aria-modal="true" aria-label="UUID Change Warning">
    <div class="bg-[var(--th-bg-900)] border border-[var(--th-border-600)] rounded-lg shadow-2xl max-w-sm w-full p-5 space-y-4">
      <div class="flex items-center gap-2">
        <AlertTriangle size={20} class="text-amber-400 shrink-0" />
        <h3 class="text-sm font-semibold text-[var(--th-text-100)]">{m.meta_lsx_uuid_warning_title()}</h3>
      </div>
      <p class="text-xs text-[var(--th-text-300)] leading-relaxed">
        {m.meta_lsx_uuid_warning_message()}
      </p>
      <div class="flex justify-end gap-2">
        <button
          class="px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] text-[var(--th-text-300)]
                 hover:bg-[var(--th-bg-600)] transition-colors"
          onclick={cancelUuidChange}
        >{m.common_cancel()}</button>
        <button
          class="px-3 py-1.5 text-xs rounded bg-amber-600 hover:bg-amber-500 text-white
                 font-medium transition-colors"
          onclick={confirmUuidChange}
        >{m.meta_lsx_uuid_warning_proceed()}</button>
      </div>
    </div>
  </div>
{/if}
