<script lang="ts">
  import type { DiffEntry, Change } from "../lib/types/index.js";
  import { m } from "../paraglide/messages.js";

  let { entry }: { entry: DiffEntry } = $props();

  const ADDED_TYPES: Set<string> = new Set(["StringAdded", "SelectorAdded", "ChildAdded"]);
  const REMOVED_TYPES: Set<string> = new Set(["StringRemoved", "SelectorRemoved", "ChildRemoved"]);
  const CHANGED_TYPES: Set<string> = new Set(["FieldChanged", "BooleanChanged", "SpellFieldChanged"]);

  function changeIcon(c: Change): string {
    if (c.change_type === "EntireEntryNew") return "★";
    if (ADDED_TYPES.has(c.change_type))   return "+";
    if (REMOVED_TYPES.has(c.change_type)) return "−";
    if (CHANGED_TYPES.has(c.change_type)) return "~";
    return " ";
  }

  function changeCss(c: Change): string {
    if (c.change_type === "EntireEntryNew") return "diff-added";
    if (ADDED_TYPES.has(c.change_type))   return "diff-added";
    if (REMOVED_TYPES.has(c.change_type)) return "diff-removed";
    if (CHANGED_TYPES.has(c.change_type)) return "diff-changed";
    return "";
  }

  function formatValues(c: Change): string {
    if (c.added_values.length > 0) return c.added_values.join(", ");
    if (c.removed_values.length > 0) return c.removed_values.join(", ");
    if (c.mod_value) return c.mod_value;
    return "";
  }
</script>

<div class="text-xs font-mono bg-zinc-900 rounded p-2 space-y-0.5 border border-zinc-700 overflow-x-auto">
  {#each entry.changes as change}
    {#if change.change_type === "EntireEntryNew"}
      <div class="flex gap-2 diff-added">
        <span class="w-4 text-center shrink-0 opacity-70">★</span>
        <ins class="font-semibold no-underline">{m.entry_diff_new_label()}</ins>
      </div>
      <!-- Show all raw attributes for new entries -->
      {#each Object.entries(entry.raw_attributes ?? {}) as [key, value]}
        <div class="flex gap-2 text-zinc-300">
          <span class="w-4 text-center shrink-0 opacity-40">·</span>
          <span class="font-semibold shrink-0 text-zinc-400">{key}:</span>
          <span class="break-all whitespace-pre-wrap" title={value}>{value}</span>
        </div>
      {/each}
      <!-- Show raw children for new entries -->
      {#each Object.entries(entry.raw_children ?? {}) as [group, guids]}
        <div class="flex gap-2 text-zinc-300">
          <span class="w-4 text-center shrink-0 opacity-40">·</span>
          <span class="font-semibold shrink-0 text-zinc-400">{group}:</span>
          <span class="break-all whitespace-pre-wrap" title={guids.join(', ')}>{guids.join(', ')}</span>
        </div>
      {/each}
    {:else}
      <div class="flex gap-2 {changeCss(change)}">
        <span class="w-4 text-center shrink-0 opacity-70">{changeIcon(change)}</span>
        <span class="font-semibold shrink-0">{change.field}:</span>
        {#if CHANGED_TYPES.has(change.change_type)}
          <del class="diff-old break-all whitespace-pre-wrap line-through opacity-50">{change.vanilla_value ?? ""}</del>
          <span class="shrink-0">→</span>
          <ins class="diff-new break-all whitespace-pre-wrap no-underline">{change.mod_value ?? ""}</ins>
        {:else if ADDED_TYPES.has(change.change_type)}
          <ins class="break-all whitespace-pre-wrap no-underline">{formatValues(change)}</ins>
        {:else}
          <del class="line-through break-all whitespace-pre-wrap">{change.vanilla_value ?? change.removed_values.join(", ")}</del>
        {/if}
      </div>
    {/if}
  {/each}
</div>
