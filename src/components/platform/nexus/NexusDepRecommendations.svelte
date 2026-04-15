<!-- NexusDepRecommendations — Shows meta.lsx deps not yet linked to Nexus, and those already linked.
     Wrapped in a Drawer for consistent sidebar UX. -->
<script lang="ts">
  import { m } from "../../../paraglide/messages.js";
  import { dependencyStore } from "../../../lib/stores/dependencyStore.svelte.js";
  import { nexusResolveMod } from "../../../lib/tauri/nexus.js";

  import Check from "@lucide/svelte/icons/check";
  import Link from "@lucide/svelte/icons/link";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import { getPrefersReducedMotion } from "../../../lib/stores/motion.svelte.js";

  const GUSTAVDEV_UUID = "28ac9ce2-2aba-8cda-b3b5-6e922f71b6b8";

  interface MetaDependency {
    uuid: string;
    name: string;
    folder: string;
  }

  let { metaDependencies }: { metaDependencies: MetaDependency[] } = $props();

  /** Index of the dep currently being linked (null = none). */
  let linkingIndex: number | null = $state(null);
  let linkInput = $state("");
  let isResolving = $state(false);
  let resolveError: string | null = $state(null);

  /** Filter out GustavDev base-game dependency. */
  let filteredDeps = $derived(
    metaDependencies.filter((d) => d.uuid !== GUSTAVDEV_UUID),
  );

  /**
   * Sync: remove orphaned dependency-store entries whose metaUuid no longer
   * exists in meta.lsx.  Fixes the bug where removing a meta.lsx dep leaves
   * a stale entry in the Nexus deps list.
   */
  $effect(() => {
    const validUuids = new Set(filteredDeps.map((d) => d.uuid));
    const kept = dependencyStore.dependencies.filter(
      (d) => !d.metaUuid || validUuids.has(d.metaUuid),
    );
    if (kept.length !== dependencyStore.dependencies.length) {
      dependencyStore.dependencies = kept;
      dependencyStore.saveDependencies();
    }
  });

  /** Deps that already have a matching entry in dependencyStore by metaUuid. */
  let linkedDeps = $derived.by(() => {
    const uuids = new Set(
      dependencyStore.dependencies
        .filter((d) => d.metaUuid)
        .map((d) => d.metaUuid),
    );
    return filteredDeps.filter((d) => uuids.has(d.uuid));
  });

  /** Deps with no matching dependencyStore entry. */
  let unmatchedDeps = $derived.by(() => {
    const uuids = new Set(
      dependencyStore.dependencies
        .filter((d) => d.metaUuid)
        .map((d) => d.metaUuid),
    );
    return filteredDeps.filter((d) => !uuids.has(d.uuid));
  });

  function getNexusModId(metaUuid: string): string | null {
    const entry = dependencyStore.dependencies.find(
      (d) => d.metaUuid === metaUuid,
    );
    return entry?.nexusModId ?? null;
  }

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

  function handleInputKeydown(e: KeyboardEvent, dep: MetaDependency) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleResolve(dep);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelLinking();
    }
  }
</script>

<div class="nexus-drawer-content">
  {#if filteredDeps.length === 0}
    <p class="text-xs px-3 py-2 text-[var(--th-text-500)] italic">
      {m.nexus_dep_unlinked_hint()}
    </p>
  {:else if unmatchedDeps.length === 0}
    <p role="status" class="text-xs px-3 py-2 text-[var(--th-text-500)]">
      {m.nexus_dep_all_linked()}
    </p>
  {:else}
      <div role="list" class="max-h-64 overflow-y-auto">
        {#each unmatchedDeps as dep, i}
          <div role="listitem" class="border-b border-[var(--th-border-800,var(--th-border-700))] last:border-b-0 px-3 py-1.5">
            <div class="flex items-center gap-2">
              <div class="flex-1 min-w-0">
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
                  onkeydown={(e) => handleInputKeydown(e, dep)}
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

  {#if linkedDeps.length > 0}
    <div role="list" class="border-t border-[var(--th-border-800,var(--th-border-700))] pt-1">
      {#each linkedDeps as dep}
        {@const modId = getNexusModId(dep.uuid)}
        <div role="listitem" class="flex items-center gap-2 px-3 py-1 text-xs">
          <Check size={12} class="text-green-400 shrink-0" aria-hidden="true" />
          <span class="truncate text-[var(--th-text-300)]">{dep.name || dep.folder}</span>
          {#if modId}
            <span role="status" class="text-[10px] text-green-400">
              {m.nexus_dep_linked_to({ modId })}
            </span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
