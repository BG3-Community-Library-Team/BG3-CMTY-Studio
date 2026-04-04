<script lang="ts">
  /**
   * Draggable vertical panel splitter for resizing the two-panel layout.
   *
   * Emits the new sidebar width via the `onresize` callback during drag,
   * and `oncommit` when the drag ends (to persist to settings store).
   * Supports keyboard arrow keys (±10px), Home/End (min/max), and
   * double-click to reset to default width.
   */

  let {
    sidebarWidth,
    minWidth = 280,
    maxWidth = 900,
    defaultWidth = 420,
    onresize,
    oncommit,
  }: {
    sidebarWidth: number;
    minWidth?: number;
    maxWidth?: number;
    defaultWidth?: number;
    onresize: (width: number) => void;
    oncommit: (width: number) => void;
  } = $props();

  let isDragging = $state(false);
  let splitterEl: HTMLDivElement | undefined = $state(undefined);

  function handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    isDragging = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function handlePointerMove(e: PointerEvent): void {
    if (!isDragging) return;
    // sidebarWidth = distance from the right edge of the viewport to the pointer
    const containerWidth = document.documentElement.clientWidth;
    const newWidth = Math.round(containerWidth - e.clientX);
    const clamped = Math.max(minWidth, Math.min(maxWidth, newWidth));
    onresize(clamped);
  }

  function handlePointerUp(e: PointerEvent): void {
    if (!isDragging) return;
    isDragging = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    oncommit(sidebarWidth);
  }

  function handleDoubleClick(): void {
    onresize(defaultWidth);
    oncommit(defaultWidth);
  }

  function handleKeyDown(e: KeyboardEvent): void {
    let newWidth = sidebarWidth;
    switch (e.key) {
      case "ArrowLeft":
        newWidth = Math.min(maxWidth, sidebarWidth + 10);
        break;
      case "ArrowRight":
        newWidth = Math.max(minWidth, sidebarWidth - 10);
        break;
      case "Home":
        newWidth = maxWidth;
        break;
      case "End":
        newWidth = minWidth;
        break;
      default:
        return;
    }
    e.preventDefault();
    onresize(newWidth);
    oncommit(newWidth);
  }
</script>

<div
  bind:this={splitterEl}
  class="splitter-handle shrink-0 w-1 cursor-col-resize select-none
         bg-[var(--th-bg-800)] hover:bg-[var(--th-text-sky-400)]
         transition-colors duration-150 relative group
         {isDragging ? 'bg-[var(--th-text-sky-400)]' : ''}"
  role="slider"
  aria-roledescription="splitter"
  aria-orientation="vertical"
  aria-valuenow={sidebarWidth}
  aria-valuemin={minWidth}
  aria-valuemax={maxWidth}
  aria-label="Resize sidebar"
  tabindex="0"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onlostpointercapture={() => { isDragging = false; }}
  ondblclick={handleDoubleClick}
  onkeydown={handleKeyDown}
>
  <!-- Visual grip dots -->
  <div class="absolute inset-0 flex items-center justify-center pointer-events-none
              opacity-0 group-hover:opacity-100 transition-opacity
              {isDragging ? '!opacity-100' : ''}">
    <div class="flex flex-col gap-1">
      <div class="w-0.5 h-0.5 rounded-full bg-[var(--th-text-400)]"></div>
      <div class="w-0.5 h-0.5 rounded-full bg-[var(--th-text-400)]"></div>
      <div class="w-0.5 h-0.5 rounded-full bg-[var(--th-text-400)]"></div>
    </div>
  </div>
</div>

{#if isDragging}
  <!-- Overlay to prevent text selection and iframe interference during drag.
       Pointer events are captured by the splitter via setPointerCapture,
       so no event handlers are needed on this element. -->
  <div class="fixed inset-0 z-50 cursor-col-resize pointer-events-none"></div>
{/if}
