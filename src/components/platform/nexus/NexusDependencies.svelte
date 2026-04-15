<!-- NexusDependencies — Unified dependency management drawer.
     Merges meta.lsx auto-discovery + Nexus file-level requirements + manual add/remove. -->
<script lang="ts">
  import { m } from "../../../paraglide/messages.js";
  import { dependencyStore } from "../../../lib/stores/dependencyStore.svelte.js";
  import { nexusResolveMod, nexusGetModRequirements, type NexusDependency } from "../../../lib/tauri/nexus.js";
  import { nexusStore } from "../../../lib/stores/nexusStore.svelte.js";
  import { getPrefersReducedMotion } from "../../../lib/stores/motion.svelte.js";
  import { open as shellOpen } from "@tauri-apps/plugin-shell";

  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import Check from "@lucide/svelte/icons/check";
  import Link from "@lucide/svelte/icons/link";

  const GUSTAVDEV_UUID = "28ac9ce2-2aba-8cda-b3b5-6e922f71b6b8";

  interface MetaDependency {
    uuid: string;
    name: string;
    folder: string;
  }

  let { modUuid, metaDependencies = [], showAddForm = $bindable(false) }: { modUuid: string; metaDependencies?: MetaDependency[]; showAddForm?: boolean } = $props();

  const NEXUS_URL_PREFIX = "https://www.nexusmods.com/";

  // ── Manual add state ──
  let addInput = $state("");
  let isAdding = $state(false);
  let addError: string | null = $state(null);

  // ── Linking state (for meta.lsx deps) ──
  let linkingIndex: number | null = $state(null);
  let linkInput = $state("");
  let isResolving = $state(false);
  let resolveError: string | null = $state(null);

  // ── Nexus file-level requirements ──
  let nexusRequirements: NexusDependency[] = $state([]);
  let isLoadingNexusDeps = $state(false);
  let nexusDepsError: string | null = $state(null);

  /** Fetch mod-level requirements from Nexus. */
  async function loadNexusRequirements() {
    isLoadingNexusDeps = true;
    nexusDepsError = null;
    try {
      const groupIds = nexusStore.fileGroups.map(g => g.id);
      if (groupIds.length === 0) {
        nexusRequirements = [];
        return;
      }
      nexusRequirements = await nexusGetModRequirements(groupIds);
    } catch (e) {
      nexusDepsError = e instanceof Error ? e.message : String(e);
      nexusRequirements = [];
    } finally {
      isLoadingNexusDeps = false;
    }
  }

  $effect(() => {
    if (modUuid && nexusStore.fileGroups.length > 0) {
      loadNexusRequirements();
    }
  });

  /** Filter out GustavDev base-game dependency. */
  let filteredMetaDeps = $derived(
    metaDependencies.filter((d) => d.uuid !== GUSTAVDEV_UUID),
  );

  /** Sync: remove orphaned dependency-store entries whose metaUuid no longer exists in meta.lsx. */
  $effect(() => {
    const validUuids = new Set(filteredMetaDeps.map((d) => d.uuid));
    const kept = dependencyStore.dependencies.filter(
      (d) => !d.metaUuid || validUuids.has(d.metaUuid),
    );
    if (kept.length !== dependencyStore.dependencies.length) {
      dependencyStore.dependencies = kept;
      dependencyStore.saveDependencies();
    }
  });

  /** meta.lsx deps not yet linked to a Nexus mod. */
  let unmatchedMetaDeps = $derived.by(() => {
    const linked = new Set(
      dependencyStore.dependencies.filter((d) => d.metaUuid).map((d) => d.metaUuid),
    );
    return filteredMetaDeps.filter((d) => !linked.has(d.uuid));
  });

  /** meta.lsx deps that are already linked. */
  let linkedMetaDeps = $derived.by(() => {
    const linked = new Set(
      dependencyStore.dependencies.filter((d) => d.metaUuid).map((d) => d.metaUuid),
    );
    return filteredMetaDeps.filter((d) => linked.has(d.uuid));
  });

  /** Manually added deps (no metaUuid). */
  let manualDeps = $derived(
    dependencyStore.dependencies.filter((d) => !d.metaUuid),
  );

  function getNexusModId(metaUuid: string): string | null {
    return dependencyStore.dependencies.find((d) => d.metaUuid === metaUuid)?.nexusModId ?? null;
  }

  function buildModUrl(nexusModId: string): string {
    return `${NEXUS_URL_PREFIX}baldursgate3/mods/${nexusModId}`;
  }

  async function openModPage(nexusModId: string) {
    const url = buildModUrl(nexusModId);
    if (!url.startsWith(NEXUS_URL_PREFIX)) return;
    try {
      await shellOpen(url);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  // ── Meta.lsx linking ──
  function startLinking(index: number) {
    linkingIndex = index;
    linkInput = "";
    resolveError = null;
  }

  function cancelLinking() {
    linkingIndex = null;
    linkInput = "";
    resolveError = null;
    isResolving = false;
  }

  async function handleResolve(dep: MetaDependency) {
    const raw = linkInput.trim();
    if (!raw) return;
    isResolving = true;
    resolveError = null;
    try {
      const details = await nexusResolveMod(raw);
      dependencyStore.addDependency({
        name: dep.name || details.name,
        metaUuid: dep.uuid,
        nexusModId: String(details.game_scoped_id),
        modioModId: null,
        notes: null,
      });
      cancelLinking();
    } catch (e) {
      resolveError = e instanceof Error ? e.message : String(e);
    } finally {
      isResolving = false;
    }
  }

  function handleLinkKeydown(e: KeyboardEvent, dep: MetaDependency) {
    if (e.key === "Enter") { e.preventDefault(); handleResolve(dep); }
    else if (e.key === "Escape") { e.preventDefault(); cancelLinking(); }
  }

  // ── Manual add ──
  async function handleAdd() {
    const raw = addInput.trim();
    if (!raw) return;
    isAdding = true;
    addError = null;
    try {
      const details = await nexusResolveMod(raw);
      dependencyStore.addDependency({
        name: details.name,
        nexusModId: String(details.game_scoped_id),
        metaUuid: null,
        modioModId: null,
        notes: null,
      });
      addInput = "";
    } catch (e) {
      addError = e instanceof Error ? e.message : String(e);
    } finally {
      isAdding = false;
    }
  }

  function handleAddKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
  }

  function removeDependency(index: number) {
    dependencyStore.removeDependency(index);
  }

  /** Find the index in the full dependencies array for a manual dep. */
  function getFullIndex(dep: typeof manualDeps[0]): number {
    return dependencyStore.dependencies.indexOf(dep);
  }
</script>

<div class="nexus-drawer-content">
  <!-- ── Add dependency (inline form, toggled from header + button) ── -->
  {#if showAddForm}
    <div class="border-b border-[var(--th-border-700)] px-3 py-2">
      <div class="flex items-center gap-1.5">
        <input
          type="text"
          class="flex-1 rounded border border-[var(--th-border-700)] bg-[var(--th-bg-900)] px-2 py-1 text-xs text-[var(--th-text-200)] placeholder:text-[var(--th-text-600)] focus:border-[var(--th-accent-500)] focus:outline-none"
          placeholder={m.nexus_dep_link_prompt()}
          aria-label={m.nexus_dep_link_prompt()}
          bind:value={addInput}
          onkeydown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
            else if (e.key === "Escape") { e.preventDefault(); showAddForm = false; addInput = ""; addError = null; }
          }}
          disabled={isAdding}
        />
        <button
          class="inline-flex items-center gap-1 rounded border border-[var(--th-border-600)] bg-[var(--th-bg-700)] px-2 py-1 text-xs font-medium text-[var(--th-text-200)] hover:bg-[var(--th-bg-600)] disabled:opacity-50"
          onclick={handleAdd}
          disabled={isAdding || !addInput.trim()}
        >
          {#if isAdding}
            <Loader2 size={12} class={getPrefersReducedMotion() ? '' : 'animate-spin'} aria-hidden="true" />
          {:else}
            <Plus size={12} aria-hidden="true" />
          {/if}
          {m.nexus_add_dependency()}
        </button>
      </div>
      {#if addError}
        <div role="alert" class="mt-1 flex items-center gap-1 text-xs text-red-400">
          <AlertCircle size={12} aria-hidden="true" />
          <span>{addError}</span>
        </div>
      {/if}
    </div>
  {/if}

  <!-- ── Unlinked meta.lsx deps ── -->
  {#if unmatchedMetaDeps.length > 0}
    <div role="list" class="max-h-48 overflow-y-auto">
      {#each unmatchedMetaDeps as dep, i}
        <div role="listitem" class="border-b border-[var(--th-border-800,var(--th-border-700))] px-3 py-1.5 last:border-b-0">
          <div class="flex items-center gap-2">
            <div class="min-w-0 flex-1">
              <span class="block truncate text-xs font-medium text-[var(--th-text-200)]">
                {dep.name || dep.folder}
              </span>
              <span class="block truncate text-[10px] text-[var(--th-text-500)]">
                {dep.uuid}
              </span>
            </div>
            {#if linkingIndex !== i}
              <button
                class="inline-flex items-center gap-1 rounded bg-[var(--th-accent-600)] px-2 py-0.5 text-[10px] font-medium text-white hover:bg-[var(--th-accent-500)]"
                onclick={() => startLinking(i)}
              >
                <Link size={10} aria-hidden="true" />
                {m.nexus_dep_link_to_nexus()}
              </button>
            {/if}
          </div>

          {#if linkingIndex === i}
            <div class="mt-1.5 flex items-center gap-1.5">
              <input
                type="text"
                class="flex-1 rounded border border-[var(--th-border-700)] bg-[var(--th-bg-900)] px-2 py-1 text-xs text-[var(--th-text-200)] placeholder:text-[var(--th-text-600)] focus:border-[var(--th-accent-500)] focus:outline-none"
                placeholder={m.nexus_dep_link_prompt()}
                aria-label={m.nexus_dep_link_prompt()}
                bind:value={linkInput}
                onkeydown={(e) => handleLinkKeydown(e, dep)}
                disabled={isResolving}
              />
              <button
                class="inline-flex items-center gap-1 rounded bg-[var(--th-accent-600)] px-2 py-1 text-xs font-medium text-white hover:bg-[var(--th-accent-500)] disabled:opacity-50"
                onclick={() => handleResolve(dep)}
                disabled={isResolving || !linkInput.trim()}
              >
                {#if isResolving}
                  <Loader2 size={12} class={getPrefersReducedMotion() ? '' : 'animate-spin'} aria-hidden="true" />
                {:else}
                  <Link size={12} aria-hidden="true" />
                {/if}
                {m.nexus_dep_link_to_nexus()}
              </button>
            </div>
            {#if resolveError}
              <div role="alert" class="mt-1 flex items-center gap-1 text-xs text-red-400">
                <AlertCircle size={12} aria-hidden="true" />
                <span>{resolveError}</span>
              </div>
            {/if}
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- ── Linked meta.lsx deps ── -->
  {#if linkedMetaDeps.length > 0}
    <div role="list" class="border-t border-[var(--th-border-800,var(--th-border-700))]">
      {#each linkedMetaDeps as dep}
        {@const modId = getNexusModId(dep.uuid)}
        <div role="listitem" class="flex items-center gap-2 px-3 py-1 text-xs">
          <Check size={12} class="shrink-0 text-green-400" aria-hidden="true" />
          <span class="truncate text-[var(--th-text-300)]">{dep.name || dep.folder}</span>
          {#if modId}
            <button
              class="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[var(--th-accent-400)] hover:underline"
              onclick={() => openModPage(modId)}
              title={m.nexus_open_mod_page()}
            >
              <span class="text-[10px]">#{modId}</span>
              <ExternalLink size={10} aria-hidden="true" />
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- ── Manually added deps ── -->
  {#if manualDeps.length > 0}
    <div role="list" class="border-t border-[var(--th-border-700)]">
      {#each manualDeps as dep}
        {@const idx = getFullIndex(dep)}
        <div role="listitem" class="flex items-center gap-2 px-3 py-1.5 text-xs">
          <span class="flex-1 truncate font-medium text-[var(--th-text-200)]">
            {dep.name}
          </span>
          {#if dep.nexusModId}
            <button
              class="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[var(--th-accent-400)] hover:underline"
              onclick={() => openModPage(dep.nexusModId!)}
              title={m.nexus_open_mod_page()}
            >
              <span class="text-[10px]">#{dep.nexusModId}</span>
              <ExternalLink size={10} aria-hidden="true" />
            </button>
          {/if}
          {#if dep.notes}
            <span class="truncate text-[var(--th-text-500)]" title={dep.notes}>
              {dep.notes}
            </span>
          {/if}
          <button
            class="rounded p-1 text-[var(--th-text-500)] hover:bg-red-500/20 hover:text-red-400"
            onclick={() => removeDependency(idx)}
            aria-label="{m.nexus_remove_dependency()} {dep.name}"
          >
            <Trash2 size={12} aria-hidden="true" />
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <!-- ── Nexus file-level requirements (from API) ── -->
  {#if isLoadingNexusDeps}
    <p class="px-3 py-2 text-xs text-[var(--th-text-500)]">
      {m.nexus_dep_loading_requirements()}
    </p>
  {:else if nexusDepsError}
    <div class="px-3 py-1.5 text-[10px] text-[var(--th-text-600)]">
      <span class="text-red-400">Failed to load Nexus requirements</span>
    </div>
  {:else if nexusRequirements.length > 0}
    <div class="border-t border-[var(--th-border-700)]">
      <p class="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--th-text-500)]">
        {m.nexus_dep_nexus_requirements()}
      </p>
      <div role="list">
        {#each nexusRequirements as dep (dep.id)}
          <div role="listitem" class="flex items-center gap-2 px-3 py-1 text-xs">
            <span class="flex-1 truncate text-[var(--th-text-300)]">{dep.name || `Mod #${dep.mod_id}`}</span>
            {#if dep.version}
              <span class="text-[10px] text-[var(--th-text-500)]">v{dep.version}</span>
            {/if}
            {#if dep.mod_id}
              <button
                class="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[var(--th-accent-400)] hover:underline"
                onclick={() => openModPage(dep.mod_id)}
                title={m.nexus_open_mod_page()}
              >
                <span class="text-[10px]">#{dep.mod_id}</span>
                <ExternalLink size={10} aria-hidden="true" />
              </button>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- ── Empty state ── -->
  {#if filteredMetaDeps.length === 0 && dependencyStore.dependencies.length === 0 && nexusRequirements.length === 0 && !isLoadingNexusDeps}
    <p class="px-3 py-2 text-xs text-[var(--th-text-500)]">
      {m.nexus_dep_unlinked_hint()}
    </p>
  {/if}

</div>
