<!--
  Custom window titlebar with integrated hamburger menu & command palette trigger.
  Replaces native OS decorations. Absorbs the old Header bar into the titlebar.
  Provides drag region, hamburger menu, app title, command palette (35-40% width),
  and window controls (min/max/close).

  Uses manual startDragging() per Tauri v2 docs — data-tauri-drag-region requires
  core:window:allow-start-dragging permission. Double-click toggles maximize.
  Window controls use direct Tauri API calls (minimize, toggleMaximize, close).
-->
<script lang="ts">
  import CommandPalette from "./CommandPalette.svelte";
  import { m } from "../paraglide/messages.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { projectStore } from "../lib/stores/projectStore.svelte.js";
  import { commandRegistry } from "../lib/utils/commandRegistry.svelte.js";
  import { APP_NAME } from "../lib/version.js";
  import Search from "@lucide/svelte/icons/search";
  import Minus from "@lucide/svelte/icons/minus";
  import Square from "@lucide/svelte/icons/square";
  import Copy from "@lucide/svelte/icons/copy";
  import X from "@lucide/svelte/icons/x";

  let commandPaletteOpen = $state(false);

  let isMaximized = $state(false);

  let primaryModName = $derived(modStore.scanResult?.mod_meta?.name ?? "");

  /** Active global filter to display in the trigger when palette is closed */
  let activeFilter = $derived(modStore.globalFilter ?? "");

  /** Track whether Alt key is currently held (for showing keyboard hints) */
  let altKeyHeld = $state(false);

  function handleTitlebarKeydown(e: KeyboardEvent) {
    if (e.key === "Alt") altKeyHeld = true;
  }
  function handleTitlebarKeyup(e: KeyboardEvent) {
    if (e.key === "Alt") altKeyHeld = false;
  }
  function handleTitlebarBlur() {
    altKeyHeld = false;
  }

  // ── File menu state ──
  let fileMenuOpen = $state(false);

  function toggleFileMenu(e: MouseEvent) {
    e.stopPropagation();
    fileMenuOpen = !fileMenuOpen;
  }

  function closeFileMenu() {
    fileMenuOpen = false;
  }

  function handleFileMenuKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") closeFileMenu();
  }

  // Click-outside listener to close the file menu
  $effect(() => {
    if (!fileMenuOpen) return;
    function onClickOutside() { fileMenuOpen = false; }
    // Defer to next tick so the opening click doesn't immediately close
    const timer = setTimeout(() => {
      window.addEventListener("click", onClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", onClickOutside);
    };
  });

  let saveEnabled = $derived(projectStore.dirty && !!modStore.selectedModPath);
  let closeEnabled = $derived(!!modStore.scanResult);
  let packageEnabled = $derived(!!modStore.scanResult);

  // Import Tauri window API lazily so the component works in non-Tauri environments
  let tauriWindow: any = null;

  async function getTauriWindow() {
    if (tauriWindow) return tauriWindow;
    try {
      const mod = await import("@tauri-apps/api/window");
      tauriWindow = mod.getCurrentWindow();
      return tauriWindow;
    } catch {
      return null;
    }
  }

  async function minimize() {
    const win = await getTauriWindow();
    await win?.minimize();
  }

  async function toggleMaximize() {
    const win = await getTauriWindow();
    if (!win) return;
    await win.toggleMaximize();
  }

  async function closeWindow() {
    const win = await getTauriWindow();
    await win?.close();
  }

  /** Manual drag implementation per Tauri v2 docs.
   *  Primary button: single-click starts drag, double-click toggles maximize. */
  async function handleDragMousedown(e: MouseEvent) {
    if (e.buttons !== 1) return; // primary button only
    if (e.detail === 2) {
      await toggleMaximize();
    } else {
      const win = await getTauriWindow();
      await win?.startDragging();
    }
  }

  // Track maximize state changes
  $effect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      const win = await getTauriWindow();
      if (!win) return;
      isMaximized = await win.isMaximized();
      const unlisten = await win.onResized(async () => {
        isMaximized = await win.isMaximized();
      });
      cleanup = unlisten;
    })();
    return () => { cleanup?.(); };
  });
</script>

<!-- Outer wrapper: uses manual drag via handleDragMousedown on draggable areas -->
<svelte:window onkeydown={handleTitlebarKeydown} onkeyup={handleTitlebarKeyup} onblur={handleTitlebarBlur} />
<header
  class="titlebar flex items-center h-11 bg-[var(--th-sidebar-bg-deep,var(--th-bg-950))]
         select-none shrink-0"
>
  <!-- App icon + title (draggable) -->
  <div
    class="flex items-center gap-2 px-3 text-[var(--th-titlebar-text,var(--th-text-400))] text-xs font-medium h-full"
    role="presentation"
    onmousedown={handleDragMousedown}
  >
    <span class="hidden sm:inline text-[var(--th-text-200)]">{APP_NAME}</span>
  </div>

  <!-- File menu -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="relative h-full flex items-center" onkeydown={handleFileMenuKeydown}>
    <button
      class="px-3 py-1 mx-1 text-xs rounded-full text-[var(--th-text-400)] hover:text-[var(--th-text-100)]
             hover:bg-[var(--th-bg-800)] transition-colors cursor-pointer"
      onclick={toggleFileMenu}
      type="button"
      aria-haspopup="menu"
      aria-expanded={fileMenuOpen}
    >
      {m.titlebar_file_menu()}
    </button>
    {#if fileMenuOpen}
      <div
        class="file-menu-dropdown absolute top-full left-0 min-w-[220px] z-[100]
               bg-[var(--th-sidebar-bg,var(--th-bg-800))] border border-[var(--th-border-700)]
               shadow-lg py-1 text-xs"
        role="menu"
      >
        <!-- Open Project -->
        <button
          class="file-menu-item w-full flex items-center justify-between px-4 py-1.5
                 text-[var(--th-text-300)] hover:bg-[var(--th-bg-700)] hover:text-[var(--th-text-100)]
                 transition-colors cursor-pointer"
          role="menuitem"
          type="button"
          onclick={() => { closeFileMenu(); commandRegistry.execute("action.openAndScan"); }}
        >
          <span>{m.titlebar_file_open_project()}</span>
        </button>
        <!-- Save Project -->
        <button
          class="file-menu-item w-full flex items-center justify-between px-4 py-1.5
                 transition-colors {saveEnabled
                   ? 'text-[var(--th-text-300)] hover:bg-[var(--th-bg-700)] hover:text-[var(--th-text-100)] cursor-pointer'
                   : 'text-[var(--th-text-600)] cursor-default'}"
          role="menuitem"
          type="button"
          disabled={!saveEnabled}
          onclick={() => { if (saveEnabled) { closeFileMenu(); commandRegistry.execute("action.save"); } }}
        >
          <span>{m.titlebar_file_save_project()}</span>
          <span class="text-[var(--th-text-600)] text-[10px] ml-4">Ctrl+S</span>
        </button>
        <!-- Close Project -->
        <button
          class="file-menu-item w-full flex items-center justify-between px-4 py-1.5
                 transition-colors {closeEnabled
                   ? 'text-[var(--th-text-300)] hover:bg-[var(--th-bg-700)] hover:text-[var(--th-text-100)] cursor-pointer'
                   : 'text-[var(--th-text-600)] cursor-default'}"
          role="menuitem"
          type="button"
          disabled={!closeEnabled}
          onclick={() => { if (closeEnabled) { closeFileMenu(); commandRegistry.execute("action.closeProject"); } }}
        >
          <span>{m.titlebar_file_close_project()}</span>
        </button>
        <!-- Separator -->
        <div class="my-1 border-t border-[var(--th-border-700)]" role="separator"></div>
        <!-- Package Project -->
        <button
          class="file-menu-item w-full flex items-center justify-between px-4 py-1.5
                 transition-colors {packageEnabled
                   ? 'text-[var(--th-text-300)] hover:bg-[var(--th-bg-700)] hover:text-[var(--th-text-100)] cursor-pointer'
                   : 'text-[var(--th-text-600)] cursor-default'}"
          role="menuitem"
          type="button"
          disabled={!packageEnabled}
          onclick={() => { if (packageEnabled) { closeFileMenu(); commandRegistry.execute("action.packageProject"); } }}
        >
          <span>{m.titlebar_file_package_project()}</span>
          <span class="text-[var(--th-text-600)] text-[10px] ml-4">Ctrl+Shift+E</span>
        </button>
        <!-- Separator -->
        <div class="my-1 border-t border-[var(--th-border-700)]" role="separator"></div>
        <!-- Exit -->
        <button
          class="file-menu-item w-full flex items-center justify-between px-4 py-1.5
                 text-[var(--th-text-300)] hover:bg-[var(--th-bg-700)] hover:text-[var(--th-text-100)]
                 transition-colors cursor-pointer"
          role="menuitem"
          type="button"
          onclick={() => { closeFileMenu(); closeWindow(); }}
        >
          <span>{m.titlebar_file_exit()}</span>
          <span class="text-[var(--th-text-600)] text-[10px] ml-4">Alt+F4</span>
        </button>
      </div>
    {/if}
  </div>

  <!-- Spacer (draggable) -->
  <div class="flex-1 min-w-2 h-full" role="presentation" onmousedown={handleDragMousedown}></div>

  <!-- Command palette trigger area (inline palette when open) -->
  <div class="command-palette-area relative flex items-center mx-2">
    {#if !commandPaletteOpen}
      <div class="flex items-center w-full h-full relative">
        <div
          class="command-palette-trigger flex items-center justify-center gap-1.5 px-3 rounded-md flex-1 min-w-0 relative
                 bg-[var(--th-bg-800)] border border-[var(--th-border-700)]
                 text-[var(--th-titlebar-text,var(--th-text-500))] hover:text-[var(--th-text-300)]
                 hover:border-[var(--th-border-600)] text-xs cursor-pointer"
          onclick={() => commandPaletteOpen = true}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); commandPaletteOpen = true; } }}
          role="button"
          tabindex="0"
          title={m.titlebar_command_palette_title()}
        >
          <Search size={12} strokeWidth={2} class="shrink-0" />
          {#if activeFilter}
            <span class="truncate text-[var(--th-text-100)] font-medium">{activeFilter}</span>
          {:else if primaryModName}
            <span class="truncate max-w-[200px] text-[var(--th-titlebar-text,var(--th-text-400))]">{primaryModName}</span>
            <span class="text-[var(--th-text-500)] hidden xs:inline">{m.titlebar_search_placeholder()}</span>
          {:else}
            <span class="text-[var(--th-text-500)]">
              {modStore.scanResult ? m.titlebar_search_placeholder() : m.titlebar_scan_mod_hint()}
            </span>
          {/if}
          {#if altKeyHeld && !activeFilter}
            <span class="cp-hint-badge absolute right-3 inline-flex items-center text-[11px] font-mono font-bold leading-none rounded px-1.5 py-0.5 shrink-0
                         bg-[var(--th-bg-700)] text-[var(--th-text-400)] border border-[var(--th-border-700)]">{m.titlebar_keyboard_hint()}</span>
          {/if}
        </div>
        {#if activeFilter}
          <!-- Clear filter X button — positioned inside the palette trigger, aligned right -->
          <button
            class="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-5 h-5 rounded
                   bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-400)] hover:text-[var(--th-text-100)]
                   border border-[var(--th-border-600)] cursor-pointer transition-colors shrink-0 z-10"
            onclick={(e) => { e.stopPropagation(); modStore.setGlobalFilter(""); }}
            title={m.titlebar_clear_filter_title()}
            aria-label={m.titlebar_clear_filter_aria()}
            type="button"
          >
            <X size={10} strokeWidth={3} />
          </button>
        {/if}
      </div>
    {/if}
    <CommandPalette bind:open={commandPaletteOpen} />
  </div>

  <!-- Spacer (draggable) -->
  <div class="flex-1 min-w-2 h-full" role="presentation" onmousedown={handleDragMousedown}></div>

  <!-- Window controls — NOT draggable; direct onclick handlers -->
  <div class="flex items-center h-full shrink-0">
    <button
      class="flex items-center justify-center w-12 h-full
             text-[var(--th-text-300)] hover:bg-[var(--th-bg-800)] hover:text-[var(--th-text-100)]
             transition-colors"
      onclick={minimize}
      title={m.titlebar_minimize()}
      type="button"
      aria-label={m.titlebar_minimize_aria()}
    >
      <Minus size={14} />
    </button>
    <button
      class="flex items-center justify-center w-12 h-full
             text-[var(--th-text-300)] hover:bg-[var(--th-bg-800)] hover:text-[var(--th-text-100)]
             transition-colors"
      onclick={toggleMaximize}
      title={isMaximized ? m.titlebar_restore() : m.titlebar_maximize()}
      type="button"
      aria-label={isMaximized ? m.titlebar_restore_aria() : m.titlebar_maximize_aria()}
    >
      {#if isMaximized}
        <Copy size={12} strokeWidth={1.5} class="-scale-x-100" />
      {:else}
        <Square size={12} strokeWidth={1.5} />
      {/if}
    </button>
    <button
      class="flex items-center justify-center w-12 h-full
             text-[var(--th-text-300)] hover:bg-red-600 hover:text-white
             transition-colors"
      onclick={closeWindow}
      title={m.titlebar_close()}
      type="button"
      aria-label={m.titlebar_close_aria()}
    >
      <X size={14} strokeWidth={1.5} />
    </button>
  </div>
</header>

<style>
  /* Command palette trigger area: 35-40% of window width */
  .command-palette-area {
    width: clamp(180px, 37%, 600px);
    height: 70%;
  }
  /* Trigger button fills the area */
  .command-palette-trigger {
    height: 100%;
  }
</style>
