<!--
  Notification History Popover
  Displays recent toast notifications with timestamps, opened from StatusBar bell icon.
  Opens upward (dropup) from the bottom bar.
-->
<script lang="ts">
  import { toastStore, type ToastLevel, type ToastHistoryEntry } from "../lib/stores/toastStore.svelte.js";
  import { m } from "../paraglide/messages.js";
  import Check from "@lucide/svelte/icons/check";
  import Info from "@lucide/svelte/icons/info";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import X from "@lucide/svelte/icons/x";
  import Copy from "@lucide/svelte/icons/copy";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";

  let {
    onclose,
  }: {
    onclose: () => void;
  } = $props();

  const LEVEL_ICONS: Record<ToastLevel, typeof Check> = {
    success: Check,
    info: Info,
    warning: AlertTriangle,
    error: X,
  };

  const LEVEL_COLORS: Record<ToastLevel, string> = {
    success: "text-emerald-400",
    info: "text-sky-400",
    warning: "text-amber-400",
    error: "text-red-400",
  };

  function relativeTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // Mark all as read when the panel opens
  $effect(() => {
    toastStore.markAllRead();
  });

  /** Track which history entries are expanded. */
  let expandedEntries = $state(new Set<number>());

  function toggleExpand(id: number) {
    const next = new Set(expandedEntries);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedEntries = next;
  }

  async function copyMessage(entry: { title: string; message?: string }) {
    const text = `${entry.title}${entry.message ? "\n" + entry.message : ""}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch { /* ignore */ }
  }
</script>

<!-- Backdrop to close on outside click -->
<div
  class="fixed inset-0 z-[90]"
  role="presentation"
  onclick={onclose}
  onkeydown={(e) => e.key === "Escape" && onclose()}
></div>

<!-- Popover panel (opens upward from StatusBar) -->
<div
  class="absolute bottom-full right-0 mb-1 w-80 max-h-[360px] bg-[var(--th-sidebar-bg,var(--th-bg-900))] border border-[var(--th-border-600)]
         rounded-md shadow-xl z-[91] flex flex-col overflow-hidden"
  role="dialog"
  aria-label={m.notification_history_aria()}
>
  <!-- Header -->
  <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--th-border-700)]">
    <span class="text-xs font-semibold text-[var(--th-text-200)]">{m.notification_history_header()}</span>
    {#if toastStore.history.length > 0}
      <button
        class="text-xs text-[var(--th-text-500)] hover:text-[var(--th-text-200)] cursor-pointer transition-colors"
        onclick={() => toastStore.clearHistory()}
      >
        {m.notification_history_clear_all()}
      </button>
    {/if}
  </div>

  <!-- History list -->
  <div class="flex-1 overflow-y-auto scrollbar-thin">
    {#if toastStore.history.length === 0}
      <div class="px-3 py-6 text-center text-xs text-[var(--th-text-600)]">
        {m.notification_history_empty()}
      </div>
    {:else}
      {#each toastStore.history as entry (entry.id)}
        {@const IconComponent = LEVEL_ICONS[entry.level]}
        <div class="flex items-start gap-2 px-3 py-2 hover:bg-[var(--th-bg-800)] transition-colors group">
          <!-- Level icon -->
          <span class="shrink-0 mt-0.5 {LEVEL_COLORS[entry.level]}"><IconComponent size={14} /></span>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-medium text-[var(--th-text-200)] truncate">{entry.title}</span>
              {#if entry.count > 1}
                <span class="text-[10px] bg-[var(--th-bg-700)] text-[var(--th-text-400)] rounded-full px-1 py-0.5 leading-none">
                  ×{entry.count}
                </span>
              {/if}
              {#if entry.level === "error" && entry.message}
                <button
                  class="text-[var(--th-text-500)] hover:text-[var(--th-text-300)] cursor-pointer shrink-0 ml-auto"
                  onclick={() => copyMessage(entry)}
                  aria-label="Copy error message"
                  title="Copy to clipboard"
                >
                  <Copy size={12} />
                </button>
              {/if}
            </div>
            {#if entry.message}
              <p class="text-[11px] text-[var(--th-text-500)] mt-0.5" class:line-clamp-1={!expandedEntries.has(entry.id)}>{entry.message}</p>
              {#if entry.message.length > 60}
                <button
                  class="text-[10px] text-[var(--th-text-500)] hover:text-[var(--th-text-300)] mt-0.5 cursor-pointer inline-flex items-center gap-0.5"
                  onclick={() => toggleExpand(entry.id)}
                >
                  {#if expandedEntries.has(entry.id)}
                    <ChevronUp size={10} /> Less
                  {:else}
                    <ChevronDown size={10} /> More
                  {/if}
                </button>
              {/if}
            {/if}
            <span class="text-[10px] text-[var(--th-text-600)] mt-0.5 block">{relativeTime(entry.createdAt)}</span>
          </div>

          <!-- Dismiss from history -->
          <button
            class="text-[var(--th-text-600)] hover:text-[var(--th-text-300)] text-xs leading-none p-0.5 cursor-pointer
                   shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onclick={() => toastStore.removeFromHistory(entry.id)}
            aria-label={m.notification_history_remove_aria()}
          ><X size={12} /></button>
        </div>
      {/each}
    {/if}
  </div>
</div>
