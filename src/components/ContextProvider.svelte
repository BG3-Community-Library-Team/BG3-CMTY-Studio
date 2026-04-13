<!--
  ContextProvider — bridges ViewRegistry stored context into Svelte's context system.
  Used by App.svelte to inject plugin-specific context when rendering dynamic views.
-->
<script lang="ts">
  import { setContext } from "svelte";
  import type { Snippet } from "svelte";

  interface Props {
    context: Record<string, unknown>;
    children: Snippet;
  }

  const { context, children }: Props = $props();

  // svelte-ignore state_referenced_locally
  for (const [key, value] of Object.entries(context)) {
    setContext(key, value);
  }
</script>

{@render children()}
