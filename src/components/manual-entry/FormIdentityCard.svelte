<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    accentColor = "var(--th-text-sky-400, #38bdf8)",
    children,
  }: {
    accentColor?: string;
    children: Snippet;
  } = $props();
</script>

<div class="form-identity-card" style="border-left: 3px solid {accentColor}">
  {@render children()}
</div>

<style>
  .form-identity-card {
    border: 1px solid var(--th-card-border);
    border-radius: 0.5rem;
    background: var(--th-card-bg);
    box-shadow: var(--th-card-shadow);
    padding: 0.5rem 0.625rem 0.625rem;
  }
</style>
