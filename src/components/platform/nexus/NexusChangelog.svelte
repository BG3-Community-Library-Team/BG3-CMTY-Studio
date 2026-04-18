<!-- NexusChangelog — Aggregated changelog drawer. Shows changelog_html for every file version. -->
<script lang="ts">
  import { m } from "../../../paraglide/messages.js";
  import { nexusStore } from "../../../lib/stores/nexusStore.svelte.js";
  import { nexusGetFileVersions, nexusGetAllModFiles, type NexusFileVersion } from "../../../lib/tauri/nexus.js";

  let {
    modUuid,
    fileGroupId,
  }: {
    modUuid: string;
    fileGroupId: string | null;
  } = $props();

  let versions: NexusFileVersion[] = $state([]);
  let isLoading = $state(false);
  let loadError: string | null = $state(null);

  /** Versions that have a changelog, newest first. */
  let changelogVersions = $derived(
    versions
      .filter(v => v.changelog_html)
      .sort((a, b) => {
        if (a.created_at && b.created_at) return b.created_at.localeCompare(a.created_at);
        return b.id.localeCompare(a.id);
      })
  );

  async function loadVersions() {
    isLoading = true;
    loadError = null;
    try {
      if (nexusStore.useUploadV3 && fileGroupId) {
        versions = await nexusGetFileVersions(fileGroupId);
      } else if (nexusStore.modId) {
        versions = await nexusGetAllModFiles(Number(nexusStore.modId));
      }
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    if (modUuid && (fileGroupId || nexusStore.modId)) {
      loadVersions();
    }
  });
</script>

<div class="nexus-changelog-content">
  {#if isLoading}
    <div class="px-3 py-4 text-xs text-[var(--th-text-500)]">Loading…</div>
  {:else if loadError}
    <div class="px-3 py-2 text-xs text-red-400">{loadError}</div>
  {:else if changelogVersions.length === 0}
    <p class="px-3 py-4 text-xs text-[var(--th-text-500)] italic">
      {m.nexus_changelog_empty()}
    </p>
  {:else}
    <ul role="list" class="flex flex-col gap-2 px-3 pb-3 pt-2">
      {#each changelogVersions as ver (ver.id)}
        <li class="rounded border border-[var(--th-border-700)] bg-[var(--th-bg-800)] px-2 py-1.5">
          <div class="flex items-center gap-1.5 text-[10px]">
            <span class="font-medium text-[var(--th-text-200)]">v{ver.version}</span>
            {#if ver.created_at}
              <span class="text-[var(--th-text-500)]">·</span>
              <span class="text-[var(--th-text-500)]">{ver.created_at}</span>
            {/if}
          </div>
          <div class="changelog-entry-body mt-1 text-[9px] text-[var(--th-text-300)]">{@html ver.changelog_html}</div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .changelog-entry-body :global(ul) {
    padding-left: 16px;
    margin: 2px 0;
    list-style: disc;
  }
  .changelog-entry-body :global(ol) {
    padding-left: 16px;
    margin: 2px 0;
  }
  .changelog-entry-body :global(p) {
    margin: 2px 0;
  }
  .changelog-entry-body :global(a) {
    color: var(--th-accent, #0ea5e9);
  }
</style>
