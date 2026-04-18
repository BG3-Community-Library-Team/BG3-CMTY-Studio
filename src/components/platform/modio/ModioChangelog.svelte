<!-- ModioChangelog — Aggregated changelog from mod.io file versions. -->
<script lang="ts">
  import {
    modioListFiles,
    type ModioFileEntry,
  } from "../../../lib/tauri/modio.js";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import { getPrefersReducedMotion } from "../../../lib/stores/motion.svelte.js";

  let { modId, gameId }: { modId: number; gameId: number } = $props();

  let files: ModioFileEntry[] = $state([]);
  let isLoading = $state(false);

  // Entries that have a non-empty changelog, sorted newest first
  let changelogEntries = $derived(
    files
      .filter(f => f.changelog && f.changelog.trim())
      .sort((a, b) => b.date_added - a.date_added),
  );

  $effect(() => {
    if (modId) loadFiles();
  });

  async function loadFiles() {
    isLoading = true;
    try {
      files = await modioListFiles(modId);
    } catch (e) {
      console.warn("[ModioChangelog] Failed to load files:", e);
    } finally {
      isLoading = false;
    }
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
</script>

<div class="px-3 pb-3 pt-2">
  {#if isLoading}
    <div class="flex items-center justify-center py-4">
      <Loader2
        size={16}
        class={getPrefersReducedMotion() ? "text-[var(--th-text-500)]" : "animate-spin text-[var(--th-text-500)]"}
      />
    </div>
  {:else if changelogEntries.length === 0}
    <p class="py-3 text-center text-[10px] text-[var(--th-text-500)]">
      No changelog entries found.
    </p>
  {:else}
    <ul role="list" class="flex flex-col gap-2">
      {#each changelogEntries as file (file.id)}
        <li class="rounded border border-[var(--th-border-700)] bg-[var(--th-bg-800)] px-2 py-1.5">
          <div class="flex items-center gap-1.5 text-[10px]">
            <span class="font-medium text-[var(--th-text-200)]">
              {file.version ?? file.filename}
            </span>
            <span class="text-[var(--th-text-500)]">·</span>
            <span class="text-[var(--th-text-500)]">{formatDate(file.date_added)}</span>
          </div>
          <div class="mt-1 text-[9px] text-[var(--th-text-300)] whitespace-pre-wrap">
            {file.changelog}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>
