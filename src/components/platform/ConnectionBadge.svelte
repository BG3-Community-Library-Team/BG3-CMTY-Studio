<!--
  ConnectionBadge — Reusable status badge showing connection state.
  Consumed by Nexus, mod.io, and git sidebars.
-->
<script lang="ts">
  let { status, label, tooltip = "" }: {
    status: "connected" | "warning" | "disconnected";
    label: string;
    tooltip?: string;
  } = $props();

  let dotColor = $derived(
    status === "connected" ? "var(--th-success, #10b981)" :
    status === "warning" ? "var(--th-warning, #f59e0b)" :
    "var(--th-text-600, #6b7280)"
  );

  let textColor = $derived(
    status === "connected" ? "var(--th-success, #10b981)" :
    status === "warning" ? "var(--th-warning, #f59e0b)" :
    "var(--th-text-500)"
  );

  let bgColor = $derived(
    status === "connected" ? "color-mix(in srgb, var(--th-success, #10b981) 12%, transparent)" :
    status === "warning" ? "color-mix(in srgb, var(--th-warning, #f59e0b) 12%, transparent)" :
    "var(--th-bg-800)"
  );
</script>

<span
  class="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full"
  style="color: {textColor}; background: {bgColor}"
  role="status"
  aria-live="polite"
  title={tooltip || undefined}
>
  <span
    class="w-1.5 h-1.5 rounded-full flex-shrink-0"
    style="background: {dotColor}"
    aria-hidden="true"
  ></span>
  {label}
</span>
