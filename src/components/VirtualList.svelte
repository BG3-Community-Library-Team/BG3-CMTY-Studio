<!--
  PF-022: VirtualList — Virtualized scrolling for large entry lists.
  Renders only visible items + overscan buffer. Supports fixed-height rows.
  Falls back to full rendering for lists below VIRTUALIZE_THRESHOLD.
-->
<script lang="ts" generics="T">
  import type { Snippet } from "svelte";

  interface Props {
    items: T[];
    /** Estimated row height in px (used for all rows) */
    itemHeight?: number;
    /** Number of extra items rendered above/below viewport */
    overscan?: number;
    /** Minimum item count before virtualization kicks in */
    threshold?: number;
    /** Unique key extractor for items */
    keyFn?: (item: T, index: number) => string | number;
    /** Content snippet: receives { item, index } */
    children: Snippet<[{ item: T; index: number }]>;
    /** ARIA role for the container */
    role?: string;
  }

  let {
    items,
    itemHeight = 40,
    overscan = 5,
    threshold = 50,
    keyFn = (_: T, i: number) => i,
    children,
    role = "list",
  }: Props = $props();

  let scrollContainer: HTMLDivElement | undefined = $state(undefined);
  let scrollTop = $state(0);
  let containerHeight = $state(400);

  // Determine whether to virtualize
  let shouldVirtualize = $derived(items.length >= threshold);

  // Total height of all items
  let totalHeight = $derived(items.length * itemHeight);

  // Calculate visible range
  let startIdx = $derived.by(() => {
    if (!shouldVirtualize) return 0;
    return Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  });

  let endIdx = $derived.by(() => {
    if (!shouldVirtualize) return items.length;
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    return Math.min(items.length, Math.floor(scrollTop / itemHeight) + visibleCount + overscan);
  });

  let visibleItems = $derived(items.slice(startIdx, endIdx));

  let offsetY = $derived(startIdx * itemHeight);

  function handleScroll(e: Event) {
    const el = e.target as HTMLDivElement;
    scrollTop = el.scrollTop;
  }

  // Observe container size
  $effect(() => {
    if (!scrollContainer) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        containerHeight = entry.contentRect.height;
      }
    });
    ro.observe(scrollContainer);
    return () => ro.disconnect();
  });
</script>

{#if shouldVirtualize}
  <div
    bind:this={scrollContainer}
    class="overflow-y-auto scrollbar-thin"
    style="height: 100%; position: relative;"
    onscroll={handleScroll}
    {role}
    aria-label="Virtualized entry list"
  >
    <!-- Spacer for total content height -->
    <div style="height: {totalHeight}px; position: relative;">
      <!-- Visible items positioned with transform -->
      <div style="transform: translateY({offsetY}px); will-change: transform;">
        {#each visibleItems as item, i (keyFn(item, startIdx + i))}
          <div
            style="height: {itemHeight}px;"
            role="listitem"
            aria-setsize={items.length}
            aria-posinset={startIdx + i + 1}
          >
            {@render children({ item, index: startIdx + i })}
          </div>
        {/each}
      </div>
    </div>
  </div>
{:else}
  <!-- Below threshold: render all items normally -->
  <div {role}>
    {#each items as item, i (keyFn(item, i))}
      {@render children({ item, index: i })}
    {/each}
  </div>
{/if}
