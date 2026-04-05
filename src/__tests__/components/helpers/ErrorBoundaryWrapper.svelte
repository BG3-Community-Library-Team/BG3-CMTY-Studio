<!--
  Test wrapper that renders ErrorBoundary with a child that optionally throws.
  Used by ErrorBoundary.test.ts to test both happy and error paths.
-->
<script lang="ts">
  import ErrorBoundary from "../../../components/ErrorBoundary.svelte";

  let { fail = false }: { fail?: boolean } = $props();

  function maybeThrow(): string {
    if (fail) throw new Error("Test render error");
    return "";
  }
</script>

<ErrorBoundary name="TestBoundary">
  <span data-testid="child-content">{maybeThrow()}OK</span>
</ErrorBoundary>
