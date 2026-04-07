<!--
  ExportModModal — DEPRECATED (Sprint 19 / A8)
  This component has been replaced by the Package Project flow.
  The incremental auto-save pipeline writes mod files to disk after every mutation,
  making the Export modal redundant. Use action.packageProject instead.
-->
<script lang="ts">
  let { onclose }: { onclose: () => void } = $props();
</script>

<!-- A8: This modal has been removed. The component stub remains for VCS history. -->
