<!--
  ManualEntryCard: Reusable display card for a single manual/imported entry.
  Manages view mode (summary row with remove button) and edit mode (inline form).
-->
<script lang="ts">
  import type { ManualEntry } from "../lib/types/index.js";
  import { projectStore, sectionToTable } from "../lib/stores/projectStore.svelte.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import UnifiedForm from "./UnifiedForm.svelte";
  import TagBadge from "./TagBadge.svelte";
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import { tooltip } from "../lib/actions/tooltip.js";
  import { SECTION_CAPS } from "../lib/data/sectionCaps.js";
  import { m } from "../paraglide/messages.js";

  let {
    entry,
    globalIndex,
    section,
    table: tableOverride = undefined,
  }: {
    entry: ManualEntry;
    globalIndex: number;
    section: string;
    table?: string;
  } = $props();

  let editing = $state(false);
  let editFields: Record<string, string> = $state({});

  /** Get the display label for a manual entry, with UUID lookup fallback */
  function getLabel(fields: Record<string, string>): string {
    if (fields["_entryLabel"]) return fields["_entryLabel"];
    if (fields["Name"] || fields["EntryName"]) {
      return fields["Name"] || fields["EntryName"];
    }
    const uuid = fields["UUID"];
    if (uuid) {
      const first = uuid.includes("|") ? uuid.split("|")[0] : uuid;
      const lookup = modStore.lookupDisplayName(first);
      if (lookup) return lookup;
      return uuid;
    }
    return m.manual_entry_card_label();
  }

  /** Quick validation check: does a manual entry have potential issues? */
  function getStatus(fields: Record<string, string>, sec: string): "ok" | "warning" | "error" {
    const uuid = fields["UUID"];
    const entryName = fields["EntryName"];
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (uuid) {
      const parts = uuid.includes("|") ? uuid.split("|") : [uuid];
      for (const p of parts) {
        if (p.trim() && !UUID_RE.test(p.trim())) return "warning";
      }
    }

    const hasIdentity = !!(uuid?.trim()) || !!(entryName?.trim());
    if (!hasIdentity) return "ok";

    const metaKeys = new Set(["UUID", "UUIDs", "Name", "EntryName", "_uuidIsArray", "_entryLabel", "Action", "Type", "modGuid", "Blacklist"]);
    const contentKeys = Object.keys(fields).filter(k => !metaKeys.has(k));

    if (sec === "Lists") {
      const hasListContent = fields["Items"]?.trim() || fields["Inherit"]?.trim() || fields["Exclude"]?.trim();
      if (!hasListContent && contentKeys.filter(k => k !== "Items" && k !== "Inherit" && k !== "Exclude").length === 0) return "warning";
    } else if (sec === "Spells") {
      if (contentKeys.filter(k => k.startsWith("SpellField:")).length === 0) return "warning";
    } else {
      if (contentKeys.length === 0) return "warning";
    }

    const ownModUuid = modStore.scanResult?.mod_meta?.uuid?.toLowerCase();
    if (ownModUuid) {
      const hasBadModGuid = Object.entries(fields).some(([k, v]) =>
        k.endsWith(":modGuid") && v.trim().toLowerCase() === ownModUuid
      );
      if (hasBadModGuid) return "warning";
    }

    return "ok";
  }

  function startEdit() {
    editFields = { ...entry.fields };
    editing = true;
  }

  function cancelEdit() {
    editing = false;
    editFields = {};
  }

  function removeEntry() {
    const label = getLabel(entry.fields);
    const pk = entry.fields["UUID"] ?? entry.fields["EntryName"] ?? "";
    projectStore.removeEntry(tableOverride ?? sectionToTable(section), pk);
    toastStore.info(m.manual_entry_card_removed_title(), label);
  }

  let label = $derived(getLabel(entry.fields));
  let status = $derived(getStatus(entry.fields, section));

  /** Detect if this manual entry has Hidden or IsHidden set to true. */
  let isHidden = $derived(
    entry.fields["Boolean:Hidden"] === "true" || entry.fields["Boolean:IsHidden"] === "true"
  );

  /** Whether this section has a Hidden or IsHidden boolean */
  let supportsHidden = $derived.by(() => {
    const caps = SECTION_CAPS[section as keyof typeof SECTION_CAPS] as any;
    const boolKeys: string[] = caps?.booleanKeys ?? [];
    return boolKeys.includes("Hidden") || boolKeys.includes("IsHidden");
  });
</script>

{#if editing}
  {@const entryStatusEdit = getStatus(entry.fields, section)}
  <div
    class="rounded border {entryStatusEdit === 'error' ? 'border-red-500/60 bg-red-950/20' : entryStatusEdit === 'warning' ? 'border-amber-500/60 bg-amber-950/20' : 'border-violet-700/40 bg-violet-950/20'}"
    data-manual-entry
  >
    <button
      type="button"
      class="flex items-center gap-2 px-3 py-2 w-full text-left cursor-pointer hover:bg-zinc-700/20 transition-colors border-b border-zinc-700/50"
      onclick={cancelEdit}
      aria-label={m.manual_entry_card_cancel_aria({ label })}
    >
      <TagBadge tag={entry.imported ? 'IMP' : 'NEW'} />
      <span class="flex-1 text-sm font-medium truncate text-zinc-200"
        title={entry.fields["UUID"] ?? entry.fields["EntryName"] ?? ""}
      >
        {label}
      </span>
      <span class="text-xs text-zinc-500 select-none">{m.manual_entry_card_click_cancel()}</span>
    </button>
    <div class="px-2 py-1">
      <UnifiedForm
        {section}
        table={tableOverride}
        prefill={editFields}
        editIndex={globalIndex}
        editComment={entry.comment ?? ""}
        onclose={cancelEdit}
      />
    </div>
  </div>
{:else}
  <div
    class="flex flex-col rounded border {status === 'error' ? 'border-red-500/60 bg-red-950/20' : status === 'warning' ? 'border-amber-500/60 bg-amber-950/20' : 'border-violet-700/40 bg-violet-950/20'}"
    data-manual-entry
  >
    <div class="flex items-center gap-2 px-3 py-2">
      <button
        type="button"
        class="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer hover:text-sky-300 transition-colors"
        onclick={startEdit}
        aria-label={m.manual_entry_card_edit_aria({ label })}
      >
        <TagBadge tag={entry.imported ? 'IMP' : 'NEW'} />
        {#if status === "warning"}
          <TagBadge tag="WARN" />
        {/if}
        <span class="flex-1 text-sm font-medium truncate text-zinc-200"
          title={entry.fields["UUID"] ?? entry.fields["EntryName"] ?? ""}
        >
          {label}
        </span>
      </button>
      {#if supportsHidden}
        {#if isHidden}
          <span
            class="shrink-0 text-amber-400"
            use:tooltip={m.manual_entry_card_hidden_tooltip()}
          >
            <EyeOff class="w-3.5 h-3.5" />
          </span>
        {:else}
          <span
            class="shrink-0 text-[var(--th-text-500)]"
            use:tooltip={m.manual_entry_card_visible_tooltip()}
          >
            <Eye class="w-3.5 h-3.5" />
          </span>
        {/if}
      {/if}
    </div>
  </div>
{/if}
