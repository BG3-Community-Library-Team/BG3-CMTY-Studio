<!-- ModioDependencies — Dependencies section for the mod.io platform drawer.
     Cross-references dependencies.json config with the mod.io API. -->
<script lang="ts">
  import { m } from "../../../paraglide/messages.js";
  import {
    modioGetDependencies,
    modioAddDependencies,
    modioRemoveDependencies,
    modioGetModByNameId,
    type ModioDependency,
  } from "../../../lib/tauri/modio.js";
  import {
    dependencyStore,
  } from "../../../lib/stores/dependencyStore.svelte.js";
  import { toastStore } from "../../../lib/stores/toastStore.svelte.js";
  import { getPrefersReducedMotion } from "../../../lib/stores/motion.svelte.js";

  import Loader2 from "@lucide/svelte/icons/loader-2";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Link from "@lucide/svelte/icons/link";
  import Unlink from "@lucide/svelte/icons/unlink";

  let { modId, gameId, showAddForm = $bindable(false) }: { modId: number; gameId: number; showAddForm?: boolean } = $props();

  // ── State ──
  let apiDeps: ModioDependency[] = $state([]);
  let isLoading = $state(false);
  let addInput = $state("");
  let isAdding = $state(false);
  let addError: string | null = $state(null);
  let linkingIndex: number | null = $state(null);
  let linkModIdInput = $state("");

  // ── Derived ──
  /** Entries with modioModId set — "linked" mod.io deps. */
  let linkedDeps = $derived(
    dependencyStore.dependencies.filter((d) => d.modioModId != null),
  );

  /** Entries with metaUuid but no modioModId — "unlinked" meta.lsx deps. */
  let unlinkedDeps = $derived(
    dependencyStore.dependencies
      .map((d, i) => ({ dep: d, index: i }))
      .filter(({ dep }) => dep.metaUuid != null && dep.modioModId == null),
  );

  // ── Load on mount ──
  $effect(() => {
    if (modId) {
      loadApiDeps();
    }
  });

  async function loadApiDeps() {
    isLoading = true;
    try {
      apiDeps = await modioGetDependencies(modId);
    } catch {
      console.warn("[ModioDependencies] Failed to load API deps");
    } finally {
      isLoading = false;
    }
  }

  /** Parse a mod.io URL or numeric ID and return the numeric mod ID. */
  async function resolveModInput(raw: string): Promise<number | null> {
    const trimmed = raw.trim();
    // Try plain numeric ID
    const asNum = parseInt(trimmed, 10);
    if (!isNaN(asNum) && String(asNum) === trimmed && asNum > 0) {
      return asNum;
    }
    // Try mod.io URL with name_id slug
    const nameIdMatch = trimmed.match(/mod\.io\/.*?\/m\/([a-zA-Z0-9_-]+)/i);
    if (nameIdMatch) {
      const nameId = nameIdMatch[1];
      try {
        const mod = await modioGetModByNameId(nameId);
        return mod.id;
      } catch {
        return null;
      }
    }
    return null;
  }

  // ── Handlers ──
  async function handleAddDep() {
    if (!addInput.trim() || isAdding) return;
    addError = null;
    isAdding = true;
    try {
      const depId = await resolveModInput(addInput);
      if (!depId) {
        addError = "Could not resolve mod. Use a numeric ID or mod.io URL.";
        return;
      }
      await modioAddDependencies(modId, [depId]);
      addInput = "";
      showAddForm = false;
      await loadApiDeps();
    } catch {
      toastStore.error(m.modio_error_save_failed());
    } finally {
      isAdding = false;
    }
  }

  async function handleRemoveDep(depModId: number) {
    try {
      await modioRemoveDependencies(modId, [depModId]);
      await loadApiDeps();

      // Also clear the modioModId from dependencies.json
      const idx = dependencyStore.dependencies.findIndex(
        (d) => d.modioModId === depModId,
      );
      if (idx >= 0) {
        dependencyStore.updateDependency(idx, { modioModId: null });
      }
    } catch {
      toastStore.error(m.modio_error_delete_failed());
    }
  }

  async function handleLinkDep(depIndex: number) {
    const depId = parseInt(linkModIdInput.trim(), 10);
    if (isNaN(depId) || depId <= 0) return;

    try {
      await modioAddDependencies(modId, [depId]);
      dependencyStore.updateDependency(depIndex, { modioModId: depId });
      linkingIndex = null;
      linkModIdInput = "";
      await loadApiDeps();
    } catch {
      toastStore.error(m.modio_error_save_failed());
    }
  }
</script>

<div class="flex flex-col gap-3 px-3 pb-3">
  {#if isLoading}
    <div class="flex items-center justify-center py-4">
      <Loader2
        size={16}
        class="{getPrefersReducedMotion() ? '' : 'animate-spin'} text-[var(--th-text-500)]"
      />
    </div>
  {:else}
    <!-- Linked mod.io deps -->
    {#if apiDeps.length > 0}
      <div>
        <h4 class="mb-1 text-[10px] font-medium text-[var(--th-text-400)]">
          {m.modio_dependencies_header()}
        </h4>
        <ul role="list" class="flex flex-col gap-0.5">
          {#each apiDeps as dep (dep.mod_id)}
            <li
              role="listitem"
              class="group flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-[var(--th-bg-800)]"
            >
              <div class="flex items-center gap-1.5">
                <Link
                  size={10}
                  class="text-[var(--th-text-500)]"
                  aria-hidden="true"
                />
                <span class="text-[var(--th-text-300)]">{dep.name}</span>
                {#if dependencyStore.dependencies.some((d) => d.modioModId === dep.mod_id && d.nexusModId)}
                  <span class="text-[8px] text-[var(--th-text-500)]"
                    >{m.modio_dep_linked_nexus()}</span
                  >
                {/if}
              </div>
              <button
                type="button"
                class="rounded p-0.5 text-[var(--th-text-500)] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-400"
                onclick={() => handleRemoveDep(dep.mod_id)}
                aria-label={m.modio_remove_dependency({ name: dep.name })}
              >
                <Trash2 size={11} />
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {:else if !showAddForm}
      <p class="py-3 text-center text-[10px] text-[var(--th-text-500)]">
        No dependencies found.
      </p>
    {/if}

    <!-- Unlinked meta.lsx deps -->
    {#if unlinkedDeps.length > 0}
      <div>
        <h4 class="mb-1 text-[10px] font-medium text-[var(--th-text-400)]">
          Unlinked
        </h4>
        <ul role="list" class="flex flex-col gap-0.5">
          {#each unlinkedDeps as { dep, index } (dep.metaUuid)}
            <li
              role="listitem"
              class="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-[var(--th-bg-800)]"
            >
              <div class="flex items-center gap-1.5">
                <Unlink
                  size={10}
                  class="text-[var(--th-warning,#f59e0b)]"
                  aria-hidden="true"
                />
                <span class="text-[var(--th-text-300)]">{dep.name}</span>
              </div>
              {#if linkingIndex === index}
                <form
                  class="flex items-center gap-1"
                  onsubmit={(e) => { e.preventDefault(); handleLinkDep(index); }}
                >
                  <input
                    type="number"
                    class="w-20 rounded border border-[var(--th-border-600)] bg-[var(--th-bg-800)] px-1.5 py-0.5 text-[10px] text-[var(--th-text-200)]"
                    placeholder={m.modio_dep_mod_id_placeholder()}
                    aria-label={m.modio_dep_mod_id_placeholder()}
                    bind:value={linkModIdInput}
                  />
                  <button
                    type="submit"
                    class="text-[var(--th-accent,#0ea5e9)]"
                    aria-label={m.modio_dep_link_action()}
                  >
                    <Link size={10} aria-hidden="true" />
                  </button>
                </form>
              {:else}
                <button
                  type="button"
                  class="text-[9px] text-[var(--th-accent,#0ea5e9)] hover:underline"
                  onclick={() => {
                    linkingIndex = index;
                    linkModIdInput = "";
                  }}
                >
                  {m.modio_dep_link_action()}
                </button>
              {/if}
            </li>
          {/each}
        </ul>
        <p class="mt-1 text-[9px] text-[var(--th-text-500)]">
          {m.modio_dep_unlinked_hint()}
        </p>
      </div>
    {/if}

    <!-- Add dependency form (toggled by header + button) -->
    {#if showAddForm}
      <div class="mt-2 rounded border border-[var(--th-border-600)] bg-[var(--th-bg-800)] p-2">
        <form
          class="flex flex-col gap-1.5"
          onsubmit={(e) => { e.preventDefault(); handleAddDep(); }}
        >
          <input
            type="text"
            class="w-full rounded border border-[var(--th-border-600)] bg-[var(--th-bg-700)] px-2 py-1 text-[10px] text-[var(--th-text-200)] placeholder:text-[var(--th-text-500)] focus:border-[var(--th-accent,#0ea5e9)] focus:outline-none"
            placeholder="Mod ID or mod.io URL…"
            aria-label="Add dependency by ID or URL"
            bind:value={addInput}
          />
          {#if addError}
            <p class="text-[9px] text-[var(--th-error,#ef4444)]">{addError}</p>
          {/if}
          <div class="flex items-center gap-1.5">
            <button
              type="submit"
              class="flex items-center gap-1 rounded bg-[var(--th-accent,#0ea5e9)] px-2 py-0.5 text-[10px] font-medium text-white hover:brightness-110 disabled:opacity-50"
              disabled={isAdding || !addInput.trim()}
            >
              {#if isAdding}
                <Loader2
                  size={10}
                  class={getPrefersReducedMotion() ? '' : 'animate-spin'}
                />
              {:else}
                <Plus size={10} />
              {/if}
              {m.modio_add_dependency()}
            </button>
            <button
              type="button"
              class="rounded px-2 py-0.5 text-[10px] text-[var(--th-text-400)] hover:bg-[var(--th-bg-700)] transition-colors"
              onclick={() => { showAddForm = false; addInput = ""; addError = null; }}
            >
              {m.common_cancel()}
            </button>
          </div>
        </form>
      </div>
    {/if}
  {/if}
</div>
