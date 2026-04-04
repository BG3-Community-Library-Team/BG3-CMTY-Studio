<!--
  UX-021: Shared Button Component
  Variants: primary, secondary, destructive, ghost, link
  Sizes: sm, md, lg
  Supports loading state (spinner + disabled), class overrides, and rest props spreading.
-->
<script lang="ts">
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  type Variant = "primary" | "secondary" | "destructive" | "ghost" | "link";
  type Size = "sm" | "md" | "lg" | "icon";

  let {
    variant = "primary",
    size = "md",
    disabled = false,
    loading = false,
    class: className = "",
    children,
    ...restProps
  }: HTMLButtonAttributes & {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    children?: Snippet;
    class?: string;
  } = $props();

  const VARIANT_CLASSES: Record<Variant, string> = {
    primary:
      "bg-[var(--th-accent-primary,#0284c7)] hover:bg-[var(--th-accent-hover,#0369a1)] text-white",
    secondary:
      "bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-200)]",
    destructive:
      "bg-red-600 hover:bg-red-500 text-white",
    ghost:
      "hover:bg-[var(--th-bg-800)] text-[var(--th-text-300)]",
    link:
      "text-[var(--th-accent-primary,#0284c7)] hover:underline",
  };

  const SIZE_CLASSES: Record<Size, string> = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
    lg: "text-base px-4 py-2",
    icon: "p-1.5 min-w-[2.375rem] min-h-[2.375rem] aspect-square",
  };

  let computedClass = $derived(
    [
      "inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors",
      VARIANT_CLASSES[variant],
      SIZE_CLASSES[size],
      (disabled || loading) ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      className,
    ].filter(Boolean).join(" ")
  );
</script>

<button
  class={computedClass}
  disabled={disabled || loading}
  {...restProps}
>
  {#if loading}
    <Loader2 size={size === "sm" ? 12 : size === "lg" ? 18 : 14} class="animate-spin" />
  {/if}
  {#if children}
    {@render children()}
  {/if}
</button>
