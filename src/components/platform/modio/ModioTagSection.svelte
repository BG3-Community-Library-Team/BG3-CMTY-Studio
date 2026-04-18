<script lang="ts">
  import { m } from "../../../paraglide/messages.js";
  import { modioGetGameTags, modioAddTags, modioRemoveTags, type TagOption } from "../../../lib/tauri/modio.js";
  import { toastStore } from "../../../lib/stores/toastStore.svelte.js";
  import { getPrefersReducedMotion } from "../../../lib/stores/motion.svelte.js";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";

  let { modId, gameId, tags = [] }: { modId: number; gameId: number; tags?: string[] } = $props();

  let showDropdown = $state(false);
  let gameTagOptions: TagOption[] = $state([]);
  let isLoadingGameTags = $state(false);
  let isAdding = $state(false);
  let removingTag: string | null = $state(null);
  let dropdownRef: HTMLDivElement | null = $state(null);
  let showAllTags = $state(false);
  let tagContainerRef: HTMLDivElement | null = $state(null);
  let isOverflowing = $state(false);
  let addTagBtnRef: HTMLButtonElement | null = $state(null);
  let dropdownPos = $state({ top: 0, left: 0 });

  // ── Color palette for tag badges ──
  const TAG_COLORS = [
    { bg: "rgba(59,130,246,0.15)", text: "#60a5fa", border: "rgba(59,130,246,0.3)" },   // blue
    { bg: "rgba(168,85,247,0.15)", text: "#c084fc", border: "rgba(168,85,247,0.3)" },   // purple
    { bg: "rgba(236,72,153,0.15)", text: "#f472b6", border: "rgba(236,72,153,0.3)" },   // pink
    { bg: "rgba(34,197,94,0.15)",  text: "#4ade80", border: "rgba(34,197,94,0.3)" },    // green
    { bg: "rgba(245,158,11,0.15)", text: "#fbbf24", border: "rgba(245,158,11,0.3)" },   // amber
    { bg: "rgba(14,165,233,0.15)", text: "#38bdf8", border: "rgba(14,165,233,0.3)" },   // sky
    { bg: "rgba(244,63,94,0.15)",  text: "#fb7185", border: "rgba(244,63,94,0.3)" },    // rose
    { bg: "rgba(20,184,166,0.15)", text: "#2dd4bf", border: "rgba(20,184,166,0.3)" },   // teal
  ];

  function hashStr(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function tagColor(tag: string) {
    // Find which category the tag belongs to for consistent coloring
    for (let ci = 0; ci < gameTagOptions.length; ci++) {
      if (gameTagOptions[ci].tags.includes(tag)) {
        return TAG_COLORS[ci % TAG_COLORS.length];
      }
    }
    return TAG_COLORS[hashStr(tag) % TAG_COLORS.length];
  }

  /** Available game tags grouped by category, excluding already-applied tags */
  let availableByCategory = $derived.by(() => {
    const modTagSet = new Set(tags);
    return gameTagOptions
      .map(cat => ({
        name: cat.name,
        tags: cat.tags.filter(t => !modTagSet.has(t)),
      }))
      .filter(cat => cat.tags.length > 0);
  });

  async function loadGameTags() {
    if (gameTagOptions.length > 0) return;
    isLoadingGameTags = true;
    try {
      gameTagOptions = await modioGetGameTags();
    } catch {
      console.warn("[ModioTagSection] Failed to load game tags");
    } finally {
      isLoadingGameTags = false;
    }
  }

  function toggleDropdown() {
    showDropdown = !showDropdown;
    if (showDropdown) {
      loadGameTags();
      // Compute fixed position from button rect
      if (addTagBtnRef) {
        const rect = addTagBtnRef.getBoundingClientRect();
        dropdownPos = { top: rect.bottom + 4, left: rect.left };
      }
    }
  }

  function closeDropdown() {
    showDropdown = false;
  }

  function handleClickOutside(e: MouseEvent) {
    if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
      closeDropdown();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") closeDropdown();
  }

  $effect(() => {
    if (showDropdown) {
      document.addEventListener("click", handleClickOutside, true);
      document.addEventListener("keydown", handleKeydown, true);
      return () => {
        document.removeEventListener("click", handleClickOutside, true);
        document.removeEventListener("keydown", handleKeydown, true);
      };
    }
  });

  // Check if tags overflow 2 rows
  $effect(() => {
    // Re-run when tags or showAllTags changes
    void tags;
    void showAllTags;
    if (!tagContainerRef) return;
    // Wait for DOM update
    requestAnimationFrame(() => {
      if (tagContainerRef && !showAllTags) {
        isOverflowing = tagContainerRef.scrollHeight > tagContainerRef.clientHeight;
      } else {
        isOverflowing = false;
      }
    });
  });

  async function handleAddTag(tag: string) {
    isAdding = true;
    try {
      await modioAddTags(modId, [tag]);
      toastStore.success(m.modio_tags_added?.() ?? "Tag added");
    } catch {
      toastStore.error(m.modio_error_save_failed());
    } finally {
      isAdding = false;
      showDropdown = false;
    }
  }

  async function handleRemoveTag(tag: string) {
    removingTag = tag;
    try {
      await modioRemoveTags(modId, [tag]);
      toastStore.success(m.modio_tags_removed?.() ?? "Tag removed");
    } catch {
      toastStore.error(m.modio_error_save_failed());
    } finally {
      removingTag = null;
    }
  }
</script>

<div class="modio-tag-section">
  <div
    bind:this={tagContainerRef}
    class="flex flex-wrap items-center gap-1 overflow-hidden"
    style={showAllTags ? '' : 'max-height: 52px;'}
  >
  {#each tags as tag (tag)}
    {@const color = tagColor(tag)}
    <span
      class="group inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors"
      style="background: {color.bg}; color: {color.text}; border-color: {color.border};"
    >
      {tag}
      <button
        type="button"
        class="ml-0.5 rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-400 transition-opacity"
        onclick={() => handleRemoveTag(tag)}
        disabled={removingTag === tag}
        aria-label="Remove tag {tag}"
      >
        {#if removingTag === tag}
          <Loader2 size={9} class={getPrefersReducedMotion() ? '' : 'animate-spin'} />
        {:else}
          <X size={9} />
        {/if}
      </button>
    </span>
  {/each}

  <!-- Add Tag badge-button with dropdown -->
  <div class="relative" bind:this={dropdownRef}>
    <button
      type="button"
      bind:this={addTagBtnRef}
      class="inline-flex items-center gap-0.5 rounded-full border border-dashed border-[var(--th-border-500)] px-2 py-0.5 text-[10px] font-medium text-[var(--th-text-500)] hover:text-[var(--th-text-300)] hover:border-[var(--th-text-400)] transition-colors"
      onclick={toggleDropdown}
      aria-expanded={showDropdown}
      aria-haspopup="true"
    >
      <Plus size={10} />
      {m.modio_tags_add?.() ?? "Add tag"}
      <ChevronDown size={9} class="ml-0.5 {showDropdown ? 'rotate-180' : ''} transition-transform" />
    </button>

    {#if showDropdown}
      <div
        class="fixed z-[9999] w-64 rounded-md border border-[var(--th-border-600)] bg-[var(--th-bg-800)] shadow-lg"
        style="top: {dropdownPos.top}px; left: {dropdownPos.left}px;"
        role="listbox"
        aria-label="Available tags"
      >
        {#if isLoadingGameTags}
          <div class="flex items-center justify-center py-4">
            <Loader2 size={14} class="{getPrefersReducedMotion() ? '' : 'animate-spin'} text-[var(--th-text-500)]" />
          </div>
        {:else if availableByCategory.length === 0}
          <p class="px-3 py-3 text-[10px] text-[var(--th-text-500)]">No more tags available.</p>
        {:else}
          <div class="max-h-48 overflow-y-auto py-1">
            {#each availableByCategory as category, ci (category.name)}
              {#if ci > 0}
                <div class="mx-2 my-1 border-t border-[var(--th-border-700)]"></div>
              {/if}
              <div class="px-3 pt-1.5 pb-1">
                <span class="text-[9px] font-semibold uppercase tracking-wider text-[var(--th-text-500)]">
                  {category.name}
                </span>
              </div>
              <div class="grid grid-cols-2 gap-1 px-2 pb-1.5">
                {#each category.tags as tag (tag)}
                  {@const color = tagColor(tag)}
                  <button
                    type="button"
                    class="rounded-full border px-2 py-0.5 text-[10px] font-medium text-left truncate hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-[var(--th-accent,#0ea5e9)] transition-opacity disabled:opacity-50"
                    style="background: {color.bg}; color: {color.text}; border-color: {color.border};"
                    onclick={() => handleAddTag(tag)}
                    disabled={isAdding}
                    role="option"
                    aria-selected="false"
                    title={tag}
                  >
                    {tag}
                  </button>
                {/each}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
  </div>
  {#if isOverflowing && !showAllTags}
    <button
      type="button"
      class="mt-0.5 inline-flex items-center rounded-full border border-dashed border-[var(--th-border-500)] px-2 py-0.5 text-[10px] font-medium text-[var(--th-text-500)] hover:text-[var(--th-text-300)] hover:border-[var(--th-text-400)] transition-colors"
      onclick={() => { showAllTags = true; }}
    >
      … {tags.length} tags
    </button>
  {/if}
  {#if showAllTags}
    <button
      type="button"
      class="mt-0.5 text-[9px] text-[var(--th-text-500)] hover:text-[var(--th-text-300)] transition-colors"
      onclick={() => { showAllTags = false; }}
    >
      Show less
    </button>
  {/if}
</div>
