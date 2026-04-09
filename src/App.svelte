<script lang="ts">
  import "./app.css";
  import { settingsStore } from "./lib/stores/settingsStore.svelte.js";
  import { modStore } from "./lib/stores/modStore.svelte.js";
  import SectionAccordion from "./components/SectionAccordion.svelte";
  import OutputSidebar from "./components/OutputSidebar.svelte";
  import FirstRunModal from "./components/FirstRunModal.svelte";
  import CreateModModal from "./components/CreateModModal.svelte";
  import PanelSplitter from "./components/PanelSplitter.svelte";
  import ToastContainer from "./components/ToastContainer.svelte";
  import StatusBar from "./components/StatusBar.svelte";
  import Titlebar from "./components/Titlebar.svelte";
  import ActivityBar from "./components/ActivityBar.svelte";
  import FileExplorer from "./components/FileExplorer.svelte";
  import EditorTabs from "./components/EditorTabs.svelte";
  import SearchPanel from "./components/SearchPanel.svelte";
  import SettingsView from "./components/SettingsView.svelte";
  import HelpSidebarPanel from "./components/HelpSidebarPanel.svelte";
  import ProjectPanel from "./components/ProjectPanel.svelte";
  import LoadedDataPanel from "./components/hamburger/LoadedDataPanel.svelte";
  import ErrorBoundary from "./components/ErrorBoundary.svelte";
  import EntrySummary from "./components/manual-entry/EntrySummary.svelte";
  import DuplicateModModal from "./components/DuplicateModModal.svelte";
  import PreExportValidation from "./components/PreExportValidation.svelte";
  import { modImportService, type DuplicatePromptFn } from "./lib/services/modImportService.svelte.js";
  import { detectGameDataPath, type ModMetaInfo } from "./lib/utils/tauri.js";
  import { onMount } from "svelte";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import XIcon from "@lucide/svelte/icons/x";
  import { fade } from "svelte/transition";
  import { commandRegistry, type Command } from "./lib/utils/commandRegistry.svelte.js";
  import { projectStore, sectionToTable } from "./lib/stores/projectStore.svelte.js";
  import { toastStore } from "./lib/stores/toastStore.svelte.js";
  import { uiStore } from "./lib/stores/uiStore.svelte.js";
  import { applyTheme, THEME_COMMANDS, type ThemeId } from "./lib/themes/themeManager.js";
  import { getPrefersReducedMotion } from "./lib/stores/motion.svelte.js";
  import { scanAndImport } from "./lib/services/scanService.js";
  import { saveProject, validateHandlers, type HandlerWarning } from "./lib/tauri/save.js";
  import { getDbPaths } from "./lib/tauri/db-management.js";
  import { undoStore } from "./lib/stores/undoStore.svelte.js";
  import { open, ask } from "@tauri-apps/plugin-dialog";
  import { SECTIONS_ORDERED, SECTION_DISPLAY_NAMES, type Section, getErrorMessage } from "./lib/types/index.js";
  import { m } from "./paraglide/messages.js";
  import { loadIdeHelpers } from "./lib/plugins/index.js";

  const MIN_SIDEBAR = 280;
  const MAX_SIDEBAR_RATIO = 0.6;
  const DEFAULT_SIDEBAR = 420;

  toastStore.registerToastAction("undo", () => undoStore.undo());

  // AI-26: Theme command definitions for array-based registration
  // AI-31: Commands whose shortcuts should not be intercepted by the global handler
  // (copyPreview would hijack native Ctrl+C; searchEntries dispatches a synthetic
  //  keydown that would cause an infinite loop)
  const SKIP_GLOBAL_SHORTCUTS = new Set(["action.copyPreview", "action.searchEntries", "action.save"]);

  // HAM-01: Startup init (migrated from HamburgerMenu.onMount)
  onMount(async () => {
    // SEC-5: Hydrate sensitive path settings from OS keychain (must complete before restorePersistedMods)
    await settingsStore.hydrateSecureKeys();
    // USE-03: Show first-run onboarding modal if no vanilla path configured
    if (!settingsStore.vanillaPath && !settingsStore.gameDataPath && !settingsStore.hasSeenFirstRunModal) {
      showFirstRunModal = true;
    }

    await modImportService.restorePersistedMods();
    if (!settingsStore.gameDataPath) {
      try {
        const detected = await detectGameDataPath();
        if (detected) settingsStore.setGameDataPath(detected);
      } catch { /* ignore */ }
    }
  });

  let showFirstRunModal = $state(false);

  // Load IDE helpers file when the settings path changes
  $effect(() => {
    const path = settingsStore.ideHelpersPath;
    loadIdeHelpers(path);
  });

  // ERR-006 Option C: Global unhandled error/rejection safety net
  $effect(() => {
    function handleGlobalError(event: ErrorEvent) {
      console.error("[Global] Unhandled error:", event.error);
      toastStore.error(m.app_unexpected_error(), String(event.message));
    }
    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      console.error("[Global] Unhandled rejection:", event.reason);
      const reason = event.reason;
      const msg = typeof reason === "string" ? reason
        : reason instanceof Error ? reason.message
        : reason && typeof reason === "object" && "message" in reason ? String(reason.message)
        : JSON.stringify(reason);
      toastStore.error(m.app_unexpected_error(), msg);
    }
    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  });

  // MOD-SWITCH: Close all tabs when switching between mods (non-empty → different non-empty)
  let prevModPath = $state(modStore.selectedModPath ?? "");
  $effect(() => {
    const current = modStore.selectedModPath ?? "";
    if (current && prevModPath && current !== prevModPath) {
      uiStore.closeAllTabs();
    }
    prevModPath = current;
  });

  // PF-034: Register static commands
  $effect(() => {
    commandRegistry.registerMany([
      {
        id: "action.copyPreview",
        label: m.command_label_copy_preview(),
        category: "action",
        icon: "⚡",
        shortcut: "Ctrl+C",
        enabled: () => !!modStore.scanResult,
        execute: () => {
          // Preview text is managed by OutputSidebar — copy from clipboard is handled there
          toastStore.info(m.app_copied_to_clipboard());
        },
      },
      {
        id: "action.openAndScan",
        label: m.command_label_open_project(),
        category: "action",
        icon: "⚡",
        enabled: () => !modStore.isScanning,
        execute: async () => {
          try {
            if (projectStore.dirty) {
              const confirmed = await ask(
                m.app_unsaved_changes_switch(),
                { title: m.app_unsaved_changes_title(), kind: "warning" },
              );
              if (!confirmed) return;
            }
            const selected = await open({ directory: true, title: m.app_select_mod_folder() });
            if (selected != null) {
              const path = Array.isArray(selected) ? selected[0] : String(selected);
              modStore.selectedModPath = path;
              await scanAndImport(path);
            }
          } catch (e: unknown) {
            toastStore.error(m.app_open_scan_failed(), getErrorMessage(e));
          }
        },
      },
      {
        id: "action.rescan",
        label: m.command_label_rescan(),
        category: "action",
        icon: "⚡",
        shortcut: "Ctrl+Shift+S",
        enabled: () => !!modStore.selectedModPath && !modStore.isScanning,
        execute: async () => {
          await scanAndImport(modStore.selectedModPath);
        },
      },
      {
        id: "action.save",
        label: "Save Project",
        category: "action",
        icon: "⚡",
        shortcut: "Ctrl+S",
        enabled: () => projectStore.dirty && !!modStore.selectedModPath && !isSaving,
        execute: handleSave,
      },
      {
        id: "action.createNewMod",
        label: m.command_label_new_project(),
        category: "action",
        icon: "⚡",
        enabled: () => true,
        execute: () => {
          uiStore.showCreateModModal = true;
        },
      },
      {
        id: "action.searchEntries",
        label: m.command_label_search_entries(),
        category: "action",
        icon: "🔍",
        shortcut: "Ctrl+Shift+F",
        enabled: () => !!modStore.scanResult,
        execute: () => {
          // Dispatch a synthetic keyboard event to toggle the search bar
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "F", ctrlKey: true, shiftKey: true, bubbles: true }));
        },
      },
      {
        id: "action.zoomIn",
        label: m.command_label_zoom_in(),
        category: "action",
        icon: "🔎",
        shortcut: "Ctrl+=",
        enabled: () => settingsStore.zoomLevel < 200,
        execute: () => {
          settingsStore.zoomIn();
          toastStore.info(m.app_zoom(), m.app_zoom_percent({ percent: String(settingsStore.zoomLevel) }));
        },
      },
      {
        id: "action.zoomOut",
        label: m.command_label_zoom_out(),
        category: "action",
        icon: "🔎",
        shortcut: "Ctrl+-",
        enabled: () => settingsStore.zoomLevel > 50,
        execute: () => {
          settingsStore.zoomOut();
          toastStore.info(m.app_zoom(), m.app_zoom_percent({ percent: String(settingsStore.zoomLevel) }));
        },
      },
      {
        id: "action.zoomReset",
        label: m.command_label_zoom_reset(),
        category: "action",
        icon: "🔎",
        shortcut: "Ctrl+0",
        enabled: () => settingsStore.zoomLevel !== 100,
        execute: () => {
          settingsStore.zoomReset();
          toastStore.info(m.app_zoom(), m.app_zoom_reset());
        },
      },
      ...THEME_COMMANDS.map(([themeId, name]): Command => ({
        id: `setting.theme${name.replace(/\s+/g, "")}`,
        label: m.command_label_set_theme({ name }),
        category: "setting",
        icon: "⚙",
        enabled: () => true,
        execute: () => { settingsStore.setTheme(themeId); toastStore.info(m.app_theme_changed(), name); },
      })),
      {
        id: "help.about",
        label: m.command_label_about(),
        category: "help",
        icon: "❓",
        enabled: () => true,
        execute: () => {
          uiStore.toggleSidebar("help");
        },
      },
      // ── Reset commands: global + per-section ──
      {
        id: "action.resetAll",
        label: m.command_label_reset_all(),
        category: "action",
        icon: "↺",
        enabled: () => projectStore.sections.length > 0 && projectStore.dirty,
        execute: () => {
          for (const s of SECTIONS_ORDERED) {
            projectStore.resetSection(sectionToTable(s));
          }
          toastStore.info(m.app_all_sections_reset(), m.app_restored_to_scan_state());
        },
      },
      ...SECTIONS_ORDERED.map((section): Command => ({
        id: `action.reset.${section}`,
        label: m.command_label_reset_section({ section: SECTION_DISPLAY_NAMES[section] }),
        category: "action",
        icon: "↺",
        enabled: () => {
          const table = sectionToTable(section);
          const entries = projectStore.getEntries(table);
          return entries.some(e => e._is_new || e._is_modified || e._is_deleted);
        },
        execute: () => {
          projectStore.resetSection(sectionToTable(section));
          toastStore.info(m.app_section_reset(), m.app_section_restored({ section: SECTION_DISPLAY_NAMES[section] }));
        },
      })),
      // ── Close Project: clear all state (File menu command) ──
      {
        id: "action.closeProject",
        label: m.command_label_close_project(),
        category: "action",
        icon: "⏏",
        enabled: () => !!modStore.scanResult,
        execute: async () => {
          if (projectStore.dirty) {
            const confirmed = await ask(
              m.app_unsaved_changes_exit(),
              { title: m.app_unsaved_changes_title(), kind: "warning" },
            );
            if (!confirmed) return;
          }
          projectStore.reset();
          modStore.reset();
          modStore.selectedModPath = "";
          toastStore.info(m.app_project_closed());
        },
      },
      // ── Package Project: create .pak from mod folder ──
      {
        id: "action.packageProject",
        label: m.command_label_package_project(),
        category: "action",
        icon: "📦",
        shortcut: "Ctrl+Shift+E",
        enabled: () => !!modStore.scanResult,
        execute: () => {
          toastStore.info("Package Project", "Packaging will create a .pak file. Coming soon.");
        },
      },
      // ── Exit Mod: clear all state ──
      {
        id: "action.exitMod",
        label: m.command_label_exit_mod(),
        category: "action",
        icon: "⏏",
        enabled: () => !!modStore.scanResult,
        execute: async () => {
          if (projectStore.dirty) {
            const confirmed = await ask(
              m.app_unsaved_changes_exit(),
              { title: m.app_unsaved_changes_title(), kind: "warning" },
            );
            if (!confirmed) return;
          }
          projectStore.reset();
          modStore.reset();
          modStore.selectedModPath = "";
          toastStore.info(m.app_mod_closed(), m.app_all_data_cleared());
        },
      },
      // ── Edit README ──
      {
        id: "action.editReadme",
        label: "Edit README",
        category: "action",
        icon: "📝",
        enabled: () => !!modStore.scanResult,
        execute: () => {
          uiStore.openTab({ id: "readme", label: "README.md", type: "readme", icon: "📝" });
        },
      },
      // ── Dev: Theme Gallery ──
      ...(import.meta.env.DEV ? [{
        id: "dev.themeGallery",
        label: m.theme_gallery_command_label(),
        category: "action" as const,
        icon: "🎨",
        enabled: () => true,
        execute: () => { uiStore.openTab({ id: "theme-gallery", label: "Theme Gallery", type: "theme-gallery", icon: "🎨" }); },
      }] : []),
    ]);
    // Run once
    return undefined;
  });

  let sidebarWidth = $state(settingsStore.sidebarWidth);
  let appContainer: HTMLDivElement | undefined = $state(undefined);
  let contentColumnEl: HTMLDivElement | undefined = $state(undefined);

  // Keep --app-chrome-top and --app-chrome-bottom in sync with actual content offset (accounts for banners + statusbar)
  $effect(() => {
    if (!contentColumnEl) return;
    const observer = new ResizeObserver(() => {
      const rect = contentColumnEl!.getBoundingClientRect();
      document.documentElement.style.setProperty("--app-chrome-top", `${rect.top}px`);
      document.documentElement.style.setProperty("--app-chrome-bottom", `${window.innerHeight - rect.bottom}px`);
    });
    observer.observe(contentColumnEl);
    // Also set on mount
    const rect = contentColumnEl.getBoundingClientRect();
    document.documentElement.style.setProperty("--app-chrome-top", `${rect.top}px`);
    document.documentElement.style.setProperty("--app-chrome-bottom", `${window.innerHeight - rect.bottom}px`);
    return () => observer.disconnect();
  });

  // Left side-panel resizable width
  const LEFT_PANEL_MIN = 140;
  const LEFT_PANEL_MAX = 480;
  const LEFT_PANEL_DEFAULT = 240;
  let leftPanelWidth = $state(settingsStore.leftPanelWidth ?? LEFT_PANEL_DEFAULT);
  let leftPanelDragging = $state(false);

  // ── Loaded Data sidebar state ────────────────────────────────────
  let showWarningModal = $state(false);
  let warningMessages: string[] = $state([]);

  // ── Debounced rediffing overlay (500ms delay to prevent flash) ──
  let showRediffOverlay = $state(false);
  $effect(() => {
    if (modStore.isRediffing) {
      const id = setTimeout(() => { showRediffOverlay = true; }, 500);
      return () => clearTimeout(id);
    }
    showRediffOverlay = false;
  });

  let showDuplicateModal = $state(false);
  let duplicateExistingPath = $state("");
  let duplicateExistingMeta: ModMetaInfo | null = $state(null);
  let duplicateNewPath = $state("");
  let duplicateNewMeta: ModMetaInfo | null = $state(null);
  let duplicateResolver: ((action: "replace" | "keep-both" | "cancel") => void) | null = $state(null);

  const sidebarDuplicatePrompt: DuplicatePromptFn = (
    existingPath, existingMeta, newPath, newMeta,
  ) => {
    duplicateExistingPath = existingPath;
    duplicateExistingMeta = existingMeta;
    duplicateNewPath = newPath;
    duplicateNewMeta = newMeta;
    showDuplicateModal = true;
    return new Promise((resolve) => { duplicateResolver = resolve; });
  };

  function handleDuplicateReplace() {
    showDuplicateModal = false;
    duplicateResolver?.("replace");
    duplicateResolver = null;
  }
  function handleDuplicateKeepBoth() {
    showDuplicateModal = false;
    duplicateResolver?.("keep-both");
    duplicateResolver = null;
  }
  function handleDuplicateCancel() {
    showDuplicateModal = false;
    duplicateResolver?.("cancel");
    duplicateResolver = null;
  }

  function startLeftPanelResize(e: MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftPanelWidth;
    leftPanelDragging = true;

    function onMove(ev: MouseEvent) {
      const delta = ev.clientX - startX;
      leftPanelWidth = Math.max(LEFT_PANEL_MIN, Math.min(LEFT_PANEL_MAX, startWidth + delta));
    }
    function onUp() {
      leftPanelDragging = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      settingsStore.leftPanelWidth = leftPanelWidth;
      settingsStore.persist();
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Clamp sidebar width when window resizes (action-based for clean lifecycle)
  function clampSidebarOnResize(node: HTMLElement) {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const max = Math.round(entry.contentRect.width * MAX_SIDEBAR_RATIO);
        if (sidebarWidth > max) {
          sidebarWidth = Math.max(MIN_SIDEBAR, max);
        }
      }
    });
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }

  function handleSplitterResize(w: number): void {
    const max = appContainer
      ? Math.round(appContainer.clientWidth * MAX_SIDEBAR_RATIO)
      : 900;
    sidebarWidth = Math.max(MIN_SIDEBAR, Math.min(max, w));
  }

  function handleSplitterCommit(w: number): void {
    settingsStore.sidebarWidth = w;
    settingsStore.persist();
  }

  // Apply theme class + CSS variables to root element (P-01: JS token map)
  $effect(() => {
    applyTheme(settingsStore.theme, settingsStore.theme === "custom" ? settingsStore.customTheme : undefined);
  });

  // PF-019: Apply reduced-motion class based on user setting + OS preference
  $effect(() => {
    const root = document.documentElement;
    if (getPrefersReducedMotion()) {
      root.classList.add("reduced-motion");
    } else {
      root.classList.remove("reduced-motion");
    }
  });

  // Guard: switch away from project view when mod is unloaded
  $effect(() => {
    if (!modStore.scanResult && uiStore.activeView === "project") {
      uiStore.activeView = "explorer";
    }
  });

  // ── Save project via new export pipeline with pre-export validation gate ──
  let isSaving = $state(false);
  let validationWarnings: HandlerWarning[] = $state([]);
  let showValidationModal = $state(false);

  /** Run validation, then either save directly or show the validation gate modal. */
  async function handleSave() {
    if (!modStore.selectedModPath || isSaving) return;
    isSaving = true;
    try {
      const dbPaths = await getDbPaths();
      // Run pre-export validation
      const warnings = await validateHandlers(
        dbPaths.staging,
        dbPaths.base,
        modStore.selectedModPath,
        modStore.modName,
        modStore.modFolder,
      );
      const hasErrors = warnings.some(w => w.severity === "Error");
      const hasWarnings = warnings.some(w => w.severity === "Warning" || w.severity === "Info");
      if (hasErrors || hasWarnings) {
        // Show the validation gate modal — save is deferred until user confirms
        validationWarnings = warnings;
        showValidationModal = true;
        if (hasErrors) {
          isSaving = false;
          return;
        }
        // Warnings/info only — modal lets user proceed or cancel
        isSaving = false;
        return;
      }
      // No issues — save directly
      await executeSave(dbPaths);
    } catch (e: unknown) {
      toastStore.error("Save failed", getErrorMessage(e));
    } finally {
      isSaving = false;
    }
  }

  /** Execute the actual save (called directly or after validation modal approval). */
  async function executeSave(dbPaths?: { staging: string; base: string }) {
    if (!modStore.selectedModPath) return;
    isSaving = true;
    try {
      if (!dbPaths) dbPaths = await getDbPaths();
      const result = await saveProject(
        dbPaths.staging,
        dbPaths.base,
        modStore.selectedModPath,
        modStore.modName,
        modStore.modFolder,
        false,
        false,
      );
      if (result.errors.length === 0) {
        projectStore.markClean();
        const fileCount = result.files_created.length + result.files_updated.length;
        toastStore.success(
          `Saved ${fileCount} file${fileCount !== 1 ? "s" : ""}`,
          `${result.total_entries} entries exported`,
        );
      } else {
        toastStore.error("Save failed", result.errors.join(", "));
      }
    } catch (e: unknown) {
      toastStore.error("Save failed", getErrorMessage(e));
    } finally {
      isSaving = false;
    }
  }

  function handleValidationContinue() {
    showValidationModal = false;
    validationWarnings = [];
    executeSave();
  }

  function handleValidationCancel() {
    showValidationModal = false;
    validationWarnings = [];
  }

  function handleValidationRetry() {
    showValidationModal = false;
    validationWarnings = [];
    // Re-trigger save which will re-run validation
    handleSave();
  }

  // Global keyboard shortcuts
  function handleAppKeydown(e: KeyboardEvent) {
    // AI-31: Dispatch to registry-matched command shortcuts first
    const matched = commandRegistry.matchShortcut(e);
    if (matched && !SKIP_GLOBAL_SHORTCUTS.has(matched.id)) {
      e.preventDefault();
      if (matched.enabled()) matched.execute();
      return;
    }
    // Toggle sidebar with Ctrl+B
    if (e.ctrlKey && !e.shiftKey && e.key === "b") {
      e.preventDefault();
      uiStore.toggleSidebar();
      return;
    }
    // IX-03A: Ctrl+S → save project + pin preview tab + save active file
    if (e.ctrlKey && !e.shiftKey && e.key === "s") {
      e.preventDefault();
      // Pin the active tab if it's a preview
      const active = uiStore.activeTab;
      if (active?.preview) {
        uiStore.pinTab(active.id);
      }
      // Save active file tab if applicable
      if (active?.type === "meta-lsx") {
        window.dispatchEvent(new CustomEvent("save-active-file"));
      } else {
        window.dispatchEvent(new CustomEvent("save-active-file"));
      }
      // Save project via new export pipeline
      if (projectStore.dirty && modStore.selectedModPath) {
        handleSave();
      }
    }
    // IX-03A + ER-01: Ctrl+Z → undo
    if (e.ctrlKey && !e.shiftKey && e.key === "z") {
      e.preventDefault();
      undoStore.undo().then(label => {
        if (label) {
          toastStore.info(m.toast_undo_title(), m.app_undid({ label }));
        }
      });
    }
    // IX-03A + ER-01: Ctrl+Y or Ctrl+Shift+Z → redo
    if ((e.ctrlKey && !e.shiftKey && e.key === "y") || (e.ctrlKey && e.shiftKey && e.key === "Z")) {
      e.preventDefault();
      undoStore.redo().then(label => {
        if (label) {
          toastStore.info(m.toast_redo_title(), m.app_redid({ label }));
        }
      });
    }
  }

  // Track maximized state for app-frame class
  let isMaximized = $state(false);
  $effect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const mod = await import("@tauri-apps/api/window");
        const win = mod.getCurrentWindow();
        isMaximized = await win.isMaximized();
        const unlisten = await win.onResized(async () => {
          isMaximized = await win.isMaximized();
        });
        cleanup = unlisten;
      } catch { /* non-Tauri */ }
    })();
    return () => { cleanup?.(); };
  });

  // Flush pending settings writes on Tauri native close (beforeunload may not fire)
  // DSM-01: If there are unsaved staging changes, prompt the user before closing.
  $effect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const mod = await import("@tauri-apps/api/window");
        const win = mod.getCurrentWindow();
        const unlisten = await win.onCloseRequested(async (event) => {
          if (projectStore.dirty) {
            const confirmed = await ask(
              m.app_unsaved_changes_exit(),
              { title: m.app_unsaved_changes_title(), kind: "warning" },
            );
            if (!confirmed) {
              event.preventDefault();
              return;
            }
          }
          settingsStore.persistNow();
        });
        cleanup = unlisten;
      } catch { /* non-Tauri */ }
    })();
    return () => { cleanup?.(); };
  });

  // ── Global context menu ──
  let ctxMenuVisible = $state(false);
  let ctxMenuX = $state(0);
  let ctxMenuY = $state(0);
  let ctxMenuTarget: HTMLElement | null = $state(null);

  function isTextInput(el: HTMLElement): boolean {
    if (el instanceof HTMLInputElement) {
      const type = el.type.toLowerCase();
      return !["checkbox", "radio", "range", "button", "submit", "reset", "color", "file"].includes(type);
    }
    return el instanceof HTMLTextAreaElement || el.isContentEditable;
  }

  function handleGlobalContextMenu(e: MouseEvent) {
    // Allow components with their own custom contextmenu (e.g. FileExplorer) to handle first
    if (e.defaultPrevented) return;
    e.preventDefault();

    const target = e.target as HTMLElement;
    ctxMenuTarget = target;
    ctxMenuX = Math.min(e.clientX, window.innerWidth - 200);
    ctxMenuY = Math.min(e.clientY, window.innerHeight - 150);
    ctxMenuVisible = true;
  }

  function hideCtxMenu() {
    ctxMenuVisible = false;
    ctxMenuTarget = null;
  }

  async function ctxCut() {
    document.execCommand("cut");
    hideCtxMenu();
  }
  async function ctxCopy() {
    const selection = window.getSelection()?.toString();
    if (selection) {
      await navigator.clipboard.writeText(selection);
    }
    hideCtxMenu();
  }
  async function ctxPaste() {
    if (ctxMenuTarget && isTextInput(ctxMenuTarget)) {
      const text = await navigator.clipboard.readText();
      document.execCommand("insertText", false, text);
    }
    hideCtxMenu();
  }
  async function ctxSelectAll() {
    if (ctxMenuTarget && isTextInput(ctxMenuTarget)) {
      (ctxMenuTarget as HTMLInputElement | HTMLTextAreaElement).select();
    } else {
      document.execCommand("selectAll");
    }
    hideCtxMenu();
  }
</script>

<svelte:window onkeydown={handleAppKeydown} oncontextmenu={handleGlobalContextMenu} onbeforeunload={(e) => { settingsStore.persistNow(); if (projectStore.dirty) { e.preventDefault(); } }} />

<div bind:this={appContainer} use:clampSidebarOnResize class="app-frame flex flex-col h-screen bg-[var(--th-sidebar-bg-deep,var(--th-bg-950))] text-[var(--th-text-100)] {isMaximized ? 'maximized' : ''}">
  <!-- Custom titlebar with hamburger menu & command palette integration -->
  <Titlebar />

  <!-- A11Y-01: Skip navigation links (visible on focus) -->
  <div class="skip-nav">
    <a href="#main-content" class="skip-link">{m.app_skip_to_sections()}</a>
    <a href="#preview-content" class="skip-link">{m.app_skip_to_preview()}</a>
  </div>

  <!-- Body: activity bar spans full height beside header + content -->
  <div class="flex flex-1 min-h-0">
    <!-- Activity bar: vertical icon navigation (spans titlebar to statusbar) -->
    <ActivityBar />

    <!-- Right column: Header + main content -->
    <div class="flex flex-col flex-1 min-h-0 min-w-0">
      <!-- Error / Warning banners (moved from deprecated Header) -->
      {#if modStore.error}
        <div class="px-4 py-2 bg-[var(--th-bg-red-900-50)] border-b border-[var(--th-border-red-700)] text-[var(--th-text-red-300)] text-sm">
          {modStore.error}
        </div>
      {/if}
      {#if !settingsStore.gameDataPath && modStore.scanResult}
        <div class="flex items-center gap-2 px-4 py-2 bg-[var(--th-warn-bg,rgba(120,53,15,0.3))] border-b border-[var(--th-warn-border,rgba(180,83,9,0.5))] text-[var(--th-warn-text,#fcd34d)] text-xs">
          <span class="flex-1">{m.app_vanilla_not_configured()}</span>
          <button
            class="text-[var(--th-warn-link,#fde68a)] hover:text-[var(--th-text-100)] underline underline-offset-2 cursor-pointer whitespace-nowrap font-medium"
            onclick={() => uiStore.toggleSidebar("loaded-data")}
          >{m.header_configure_now()}</button>
        </div>
      {/if}

      <!-- Main content area -->
      <div bind:this={contentColumnEl} class="flex flex-1 min-h-0">
        <!-- Side panel: contextual view based on active activity -->
        {#if uiStore.sidebarVisible && (uiStore.activeView === "project" || uiStore.activeView === "explorer" || uiStore.activeView === "search" || uiStore.activeView === "loaded-data" || uiStore.activeView === "help" || uiStore.activeView === "settings")}
          <div class="side-panel" style="width: {leftPanelWidth}px; zoom: {settingsStore.zoomLevel / 100};">
            {#if uiStore.activeView === "search"}
              <ErrorBoundary name="Search Panel">
                <SearchPanel />
              </ErrorBoundary>
            {:else if uiStore.activeView === "project"}
              <ErrorBoundary name="Project Panel">
                <ProjectPanel />
              </ErrorBoundary>
            {:else if uiStore.activeView === "loaded-data"}
              <ErrorBoundary name="Loaded Data">
                <LoadedDataPanel
                sidebar={true}
                onback={() => {}}
                onclose={() => {}}
                showDuplicatePrompt={sidebarDuplicatePrompt}
                onwarnings={(msgs) => { warningMessages = msgs; showWarningModal = true; }}
              />
              </ErrorBoundary>
            {:else if uiStore.activeView === "help"}
              <ErrorBoundary name="Help Panel">
                <HelpSidebarPanel />
              </ErrorBoundary>
            {:else if uiStore.activeView === "settings"}
              <ErrorBoundary name="Settings">
                <SettingsView />
              </ErrorBoundary>
            {:else}
              <ErrorBoundary name="File Explorer">
                <FileExplorer />
              </ErrorBoundary>
            {/if}
          </div>
          <!-- Left panel resize gripper -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="left-panel-gripper {leftPanelDragging ? 'active' : ''}"
            onmousedown={startLeftPanelResize}
          ></div>
        {/if}

        <!-- Left panel: main editor area -->
        <main id="main-content" class="relative flex-1 overflow-y-auto scrollbar-thin bg-[var(--th-bg-800)]" style="min-width: 320px; zoom: {settingsStore.zoomLevel / 100};" inert={modStore.isScanning || showRediffOverlay}>
          {#if modStore.isScanning}
            <div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[var(--th-bg-800)]/80 backdrop-blur-[2px]" transition:fade={{ duration: 150 }}>
              <div class="loading-spinner lg"></div>
              <p class="mt-4 text-sm font-medium text-[var(--th-text-300)]">{m.app_scanning_mod()}</p>
            </div>
          {:else if showRediffOverlay}
            <div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[var(--th-bg-800)]/80 backdrop-blur-[2px]" transition:fade={{ duration: 150 }}>
              <div class="loading-spinner"></div>
              <p class="mt-3 text-xs text-[var(--th-text-400)]">{m.app_comparing_mod()}</p>
            </div>
          {/if}
          {#if uiStore.activeView === "editor" || uiStore.activeView === "project" || uiStore.activeView === "explorer" || uiStore.activeView === "search" || uiStore.activeView === "loaded-data" || uiStore.activeView === "help" || uiStore.activeView === "settings"}
            <ErrorBoundary name="Editor">
              <EditorTabs />
            </ErrorBoundary>
          {:else}
            <!-- Default: show section accordion (classic view) -->
            <div class="p-4 pr-2">
              <ErrorBoundary name="Sections">
                <SectionAccordion />
              </ErrorBoundary>
            </div>
          {/if}
        </main>

        <!-- Summary drawer: entry summary sidebar (flex child, same level as main + output preview) -->
        {#if uiStore.summaryDrawer}
          <aside class="summary-drawer" aria-label="Entry summary">
            <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--th-border-700)]">
              <span class="text-xs font-semibold text-[var(--th-text-300)] uppercase tracking-wide">Summary</span>
              <button
                type="button"
                class="p-1 rounded text-[var(--th-text-400)] hover:text-[var(--th-text-100)] hover:bg-[var(--th-bg-700)] transition-colors"
                title="Close summary"
                aria-label="Close summary panel"
                onclick={() => uiStore.closeSummaryDrawer()}
              ><XIcon size={14} /></button>
            </div>
            <EntrySummary
              section={uiStore.summaryDrawer.section}
              displayName={uiStore.summaryDrawer.displayName}
              uuids={uiStore.summaryDrawer.uuids}
              validationErrors={uiStore.summaryDrawer.validationErrors}
              fields={uiStore.summaryDrawer.fields}
              booleans={uiStore.summaryDrawer.booleans}
              strings={uiStore.summaryDrawer.strings}
              rawAttributes={uiStore.summaryDrawer.rawAttributes}
              rawChildren={uiStore.summaryDrawer.rawChildren}
              vanillaAttributes={uiStore.summaryDrawer.vanillaAttributes}
              autoEntryId={uiStore.summaryDrawer.autoEntryId}
              nodeId={uiStore.summaryDrawer.nodeId}
              rawAttributeTypes={uiStore.summaryDrawer.rawAttributeTypes}
            />
          </aside>
        {/if}

        <!-- Gap between left pane scrollbar and splitter (hidden when preview collapsed) -->
        {#if !uiStore.previewCollapsed}

          <!-- Draggable splitter -->
          <PanelSplitter
            {sidebarWidth}
            minWidth={MIN_SIDEBAR}
            maxWidth={appContainer ? Math.round(appContainer.clientWidth * MAX_SIDEBAR_RATIO) : 900}
            defaultWidth={DEFAULT_SIDEBAR}
            onresize={handleSplitterResize}
            oncommit={handleSplitterCommit}
          />

          <!-- Right panel: output preview (resizable) -->
          <aside id="preview-content" class="shrink-0 bg-[var(--th-bg-700)] overflow-hidden" style="width: {sidebarWidth}px; zoom: {settingsStore.zoomLevel / 100};" aria-label={m.app_output_preview()}>
            <ErrorBoundary name="Output Preview">
              <OutputSidebar />
            </ErrorBoundary>
          </aside>
        {/if}
      </div>
    </div>
  </div>

  <!-- Status bar at bottom -->
  <StatusBar />
</div>

<CreateModModal />

<!-- Pre-export validation gate modal -->
{#if showValidationModal && validationWarnings.length > 0}
  <PreExportValidation
    warnings={validationWarnings}
    oncontinue={handleValidationContinue}
    oncancel={handleValidationCancel}
    onretry={handleValidationRetry}
  />
{/if}

<!-- USE-03: First-run onboarding modal -->
<FirstRunModal bind:show={showFirstRunModal} />

<!-- Loaded Data warning modal -->
{#if showWarningModal}
  <div
    class="fixed inset-0 bg-[var(--th-modal-backdrop)] z-[60] flex items-center justify-center p-4"
    onclick={() => showWarningModal = false}
    onkeydown={(e) => e.key === "Escape" && (showWarningModal = false)}
    role="presentation"
  >
    <div
      class="bg-[var(--th-bg-900)] border border-[var(--th-border-700)] rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.key === 'Escape' && (showWarningModal = false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="warning-modal-title"
      tabindex="-1"
    >
      <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--th-border-700)]">
        <h3 id="warning-modal-title" class="text-sm font-bold text-amber-400 flex items-center gap-2">
          <AlertTriangle size={20} strokeWidth={2} />
          {m.app_warnings_during_unpacking()}
        </h3>
        <button
          class="text-[var(--th-text-400)] hover:text-[var(--th-text-200)] p-1"
          onclick={() => showWarningModal = false}
          aria-label={m.app_close_warnings()}
        ><XIcon size={14} /></button>
      </div>
      <div class="flex-1 overflow-y-auto p-4 scrollbar-thin">
        <p class="text-xs text-[var(--th-text-400)] mb-3">
          {m.app_unpacking_warnings_desc()}
        </p>
        <ul class="space-y-2">
          {#each warningMessages as msg}
            <li class="text-xs text-[var(--th-text-300)] bg-[var(--th-bg-800)] rounded px-3 py-2 font-mono break-all">
              {msg}
            </li>
          {/each}
        </ul>
      </div>
      <div class="px-4 py-3 border-t border-[var(--th-border-700)] flex justify-end">
        <button
          class="px-4 py-1.5 text-xs rounded bg-[var(--th-bg-700)] text-[var(--th-text-200)] hover:bg-[var(--th-bg-800)] transition-colors"
          onclick={() => showWarningModal = false}
        >{m.common_close()}</button>
      </div>
    </div>
  </div>
{/if}

{#if showDuplicateModal}
  <DuplicateModModal
    existingMeta={duplicateExistingMeta}
    existingPath={duplicateExistingPath}
    newMeta={duplicateNewMeta}
    newPath={duplicateNewPath}
    onreplace={handleDuplicateReplace}
    onkeepboth={handleDuplicateKeepBoth}
    oncancel={handleDuplicateCancel}
  />
{/if}

<ToastContainer />

<!-- Global context menu -->
{#if ctxMenuVisible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-[200]" onclick={hideCtxMenu} onkeydown={(e) => { if (e.key === "Escape") hideCtxMenu(); }} role="none"></div>
  <div
    class="fixed z-[201] min-w-[160px] py-1 rounded-md shadow-xl
           bg-[var(--th-bg-900)] border border-[var(--th-border-600)]"
    style="left: {ctxMenuX}px; top: {ctxMenuY}px;"
    role="menu"
  >
    {#if ctxMenuTarget && isTextInput(ctxMenuTarget)}
      <button class="ctx-item" onclick={ctxCut} role="menuitem">
        <span>{m.app_cut()}</span><span class="ctx-shortcut">Ctrl+X</span>
      </button>
    {/if}
    <button class="ctx-item" onclick={ctxCopy} role="menuitem">
      <span>Copy</span><span class="ctx-shortcut">Ctrl+C</span>
    </button>
    {#if ctxMenuTarget && isTextInput(ctxMenuTarget)}
      <button class="ctx-item" onclick={ctxPaste} role="menuitem">
        <span>{m.app_paste()}</span><span class="ctx-shortcut">Ctrl+V</span>
      </button>
    {/if}
    <div class="my-0.5 border-t border-[var(--th-border-700)]"></div>
    <button class="ctx-item" onclick={ctxSelectAll} role="menuitem">
      <span>{m.app_select_all()}</span><span class="ctx-shortcut">Ctrl+A</span>
    </button>
  </div>
{/if}

<style>
  .side-panel {
    min-width: 140px;
    max-width: 480px;
    background: var(--th-sidebar-bg, var(--th-bg-900));
    border-right: 1px solid transparent;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    transition: border-color 0.15s;
  }
  .side-panel:hover {
    border-right-color: var(--th-border-800, var(--th-bg-700));
  }

  .left-panel-gripper {
    width: 3px;
    cursor: col-resize;
    background: var(--th-sidebar-bg, var(--th-bg-900));
    position: relative;
    flex-shrink: 0;
    transition: background-color 0.15s;
  }
  .left-panel-gripper:hover,
  .left-panel-gripper.active {
    background: var(--th-accent-500, #0ea5e9);
  }

  .loading-spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--th-border-700);
    border-top-color: var(--th-accent-500, #0ea5e9);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  .loading-spinner.lg {
    width: 48px;
    height: 48px;
    border-width: 4px;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .skip-nav {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 10000;
    display: flex;
    gap: 0.25rem;
  }
  .skip-link {
    position: absolute;
    left: -9999px;
    top: auto;
    width: 1px;
    height: 1px;
    overflow: hidden;
    padding: 0.5rem 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    background: var(--th-bg-sky-600, #0284c7);
    border-radius: 0 0 0.375rem 0;
    text-decoration: none;
    white-space: nowrap;
  }
  .skip-link:focus {
    position: static;
    width: auto;
    height: auto;
    overflow: visible;
  }

  .ctx-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    color: var(--th-text-200);
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.1s;
  }
  .ctx-item:hover {
    background: var(--th-bg-700);
  }
  .ctx-shortcut {
    font-size: 0.625rem;
    color: var(--th-text-500);
    margin-left: 1.5rem;
  }
</style>

