<!--
  PF-007: Toast Container
  Fixed bottom-right container with stacked toast notifications.
  Renders in flex-col-reverse so newest toasts appear at the bottom.
  Uses Svelte transition:fly for enter/exit animations.
-->
<script lang="ts">
  import { fly } from "svelte/transition";
  import { toastStore, type ToastLevel } from "../lib/stores/toastStore.svelte.js";
  import { m } from "../paraglide/messages.js";
  import Check from "@lucide/svelte/icons/check";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import X from "@lucide/svelte/icons/x";
  import Info from "@lucide/svelte/icons/info";

  const LEVEL_STYLES: Record<ToastLevel, { border: string; icon: typeof Check }> = {
    success: {
      border: "border-l-emerald-500",
      icon: Check,
    },
    info: {
      border: "border-l-sky-500",
      icon: Info,
    },
    warning: {
      border: "border-l-amber-500",
      icon: AlertTriangle,
    },
    error: {
      border: "border-l-red-500",
      icon: AlertCircle,
    },
  };

  /** Check reduced-motion at render time. Svelte JS transitions aren't affected
   *  by the CSS !important overrides, so we must disable them explicitly. */
  function flyDuration(): number {
    return document.documentElement.classList.contains("reduced-motion") ? 0 : 200;
  }
</script>

{#if toastStore.toasts.length > 0}
  <div
    class="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none max-w-[380px]"
    role="region"
    aria-label={m.toast_notifications_aria()}
  >
    {#each toastStore.toasts as toast (toast.id)}
      {@const style = LEVEL_STYLES[toast.level]}
      {@const IconComponent = style.icon}
      <div
        class="pointer-events-auto border-l-4 {style.border}
               bg-[var(--th-bg-900)] border border-[var(--th-border-700)] rounded-r shadow-lg
               px-3 py-2.5 flex items-start gap-2 text-sm"
        role={toast.level === "error" || toast.level === "warning" ? "alert" : "status"}
        aria-live={toast.level === "error" || toast.level === "warning" ? "assertive" : "polite"}
        aria-atomic="true"
        transition:fly={{ x: 300, duration: flyDuration() }}
        onpointerenter={() => toastStore.pauseDismiss(toast.id)}
        onpointerleave={() => toastStore.resumeDismiss(toast.id)}
      >
        <!-- Icon -->
        <span class="shrink-0 mt-0.5"><IconComponent size={16} /></span>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="font-medium text-[var(--th-text-100)] truncate">{toast.title}</span>
            {#if toast.count > 1}
              <span class="text-xs bg-[var(--th-bg-700)] text-[var(--th-text-300)] rounded-full px-1.5 py-0.5 leading-none">
                {toast.count}
              </span>
            {/if}
          </div>
          {#if toast.message}
            <p class="text-xs text-[var(--th-text-400)] mt-0.5 line-clamp-2">{toast.message}</p>
          {/if}
          {#if toast.action}
            <button
              class="text-xs text-[var(--th-text-sky-400)] hover:underline mt-1 cursor-pointer"
              onclick={() => toastStore.executeToastAction(toast.action!.actionId)}
            >
              {toast.action.label}
            </button>
          {/if}
        </div>

        <!-- Dismiss -->
        <button
          class="text-[var(--th-text-500)] hover:text-[var(--th-text-200)] text-sm leading-none p-1 cursor-pointer shrink-0 min-w-6 min-h-6 inline-flex items-center justify-center"
          onclick={() => toastStore.dismiss(toast.id)}
          aria-label={m.toast_dismiss()}
        ><X size={14} /></button>
      </div>
    {/each}
  </div>
{/if}
