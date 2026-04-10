<script lang="ts">
  import type { SectionResult } from "../lib/types/index.js";
  import SectionPanel from "./SectionPanel.svelte";
  import { projectStore, sectionToTable } from "../lib/stores/projectStore.svelte.js";

  let {
    infoResult,
    uvResult,
    globalFilter = "",
  }: {
    infoResult: SectionResult;
    uvResult: SectionResult;
    globalFilter?: string;
  } = $props();

  // ── Staging data for atlas info entries ──
  let infoTable = $derived(sectionToTable(infoResult.section, undefined, "TextureAtlasInfo"));

  $effect(() => {
    const t = infoTable;
    if (!projectStore.isSectionLoaded(t)) {
      projectStore.loadSection(t).catch(err => {
        console.warn(`[TextureAtlasPanel] Failed to load table ${t}:`, err);
      });
    }
  });

  let uvCount = $derived(uvResult.entries.length);
</script>

<div class="atlas-panel">
  <!-- ── TextureAtlasInfo — combined section with all node types (Path, IconSize, TextureSize) ── -->
  <SectionPanel
    sectionResult={infoResult}
    {globalFilter}
    displayLabel="Texture Atlas Info"
    regionId="TextureAtlasInfo"
  />

  <!-- ── IconUVList — child section nested under the atlas umbrella ── -->
  <div class="atlas-child-section">
    <SectionPanel
      sectionResult={uvResult}
      {globalFilter}
      displayLabel="Icon UV List ({uvCount})"
      regionId="IconUVList"
    />
  </div>
</div>

<style>
  .atlas-panel {
    padding: 1rem 1rem 1rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .atlas-child-section {
    margin-left: 1rem;
    border-left: 2px solid var(--th-border-700);
    padding-left: 0.5rem;
  }
</style>
