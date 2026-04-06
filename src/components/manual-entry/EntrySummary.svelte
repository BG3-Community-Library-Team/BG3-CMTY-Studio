<script lang="ts">
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import AlertCircle from "@lucide/svelte/icons/circle-alert";
  import CircleDot from "@lucide/svelte/icons/circle-dot";
  import Copy from "@lucide/svelte/icons/copy";
  import Check from "@lucide/svelte/icons/check";
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import { previewLsx } from "../../lib/tauri/lsx-export.js";
  import { getRegionId } from "../../lib/utils/entryToLsx.js";
  import type { Section } from "../../lib/types/index.js";

  let copied = $state(false);
  let copyError = $state(false);

  async function copyAsLsx() {
    try {
      const entry = {
        uuid: uuids[0] ?? "",
        node_id: nodeId ?? section,
        raw_attributes: rawAttributes ?? {},
        raw_attribute_types: rawAttributeTypes ?? {},
        raw_children: rawChildren ?? {},
      };
      const regionId = getRegionId(section as Section);
      const lsxXml = await previewLsx([entry], regionId);
      await navigator.clipboard.writeText(lsxXml);
      copied = true;
      copyError = false;
      setTimeout(() => { copied = false; }, 2000);
    } catch {
      copyError = true;
      setTimeout(() => { copyError = false; }, 2000);
    }
  }

  let {
    section,
    displayName = "",
    uuids = [],
    validationErrors = [],
    fields = {},
    booleans = [],
    strings = [],
    rawAttributes = null,
    rawChildren = null,
    vanillaAttributes = null,
    autoEntryId = null,
    nodeId = null,
    rawAttributeTypes = null,
  }: {
    section: string;
    displayName?: string;
    uuids?: string[];
    validationErrors?: Array<{ key: string; msg: string; level: "warn" | "error" }>;
    fields?: Record<string, string>;
    booleans?: Array<{ key: string; value: boolean }>;
    strings?: Array<{ action: string; type: string; values: string[] }>;
    rawAttributes?: Record<string, string> | null;
    rawChildren?: Record<string, string[]> | null;
    vanillaAttributes?: Record<string, string> | null;
    autoEntryId?: string | null;
    nodeId?: string | null;
    rawAttributeTypes?: Record<string, string> | null;
  } = $props();

  const resolvedName = $derived.by(() => {
    if (displayName) {
      const looked = modStore.lookupDisplayName(displayName)
        ?? modStore.lookupLocalizedString(displayName);
      if (looked) return looked;
      return displayName;
    }
    if (uuids.length > 0) {
      const looked = modStore.lookupDisplayName(uuids[0]);
      if (looked) return looked;
      return uuids[0];
    }
    return section;
  });

  const errorCount = $derived(validationErrors.filter(e => e.level === "error").length);
  const warnCount = $derived(validationErrors.filter(e => e.level === "warn").length);

  const fieldEntries = $derived.by(() => {
    const entries: Array<{ key: string; value: string }> = [];
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== "") {
        entries.push({ key, value });
      }
    }
    return entries;
  });

  const diffFields = $derived.by(() => {
    if (!vanillaAttributes) return new Set<string>();
    const changed = new Set<string>();
    for (const [key, value] of Object.entries(fields)) {
      const vanilla = vanillaAttributes[key];
      if (vanilla !== undefined && vanilla !== value) {
        changed.add(key);
      }
    }
    return changed;
  });

  const activeBooleans = $derived(booleans.filter(b => b.value));
  const inactiveBooleans = $derived(booleans.filter(b => !b.value));
</script>

<div class="entry-summary">
  <!-- Display Name -->
  <div class="summary-section">
    <div class="summary-name" title={resolvedName}>{resolvedName}</div>
    {#if uuids.length > 0}
      <div class="summary-uuid">{uuids[0]}</div>
    {/if}
    <div class="summary-section-label">{section}</div>
  </div>

  <!-- Validation Summary -->
  {#if errorCount > 0 || warnCount > 0}
    <div class="summary-section">
      <div class="section-header">Validation</div>
      <div class="validation-badges">
        {#if errorCount > 0}
          <span class="badge badge-error">
            <AlertCircle size={10} />
            {errorCount} {errorCount === 1 ? "error" : "errors"}
          </span>
        {/if}
        {#if warnCount > 0}
          <span class="badge badge-warn">
            <AlertTriangle size={10} />
            {warnCount} {warnCount === 1 ? "warning" : "warnings"}
          </span>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Key Stats (fields) -->
  {#if fieldEntries.length > 0}
    <div class="summary-section">
      <div class="section-header">Fields</div>
      <div class="fields-grid">
        {#each fieldEntries as entry (entry.key)}
          <div class="field-row">
            <span class="field-label">
              {#if diffFields.has(entry.key)}
                <CircleDot size={8} class="diff-dot" />
              {/if}
              {entry.key}
            </span>
            <span class="field-value" title={entry.value}>{entry.value}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Booleans -->
  {#if booleans.length > 0}
    <div class="summary-section">
      <div class="section-header">Booleans</div>
      <div class="chips-wrap">
        {#each activeBooleans as b (b.key)}
          <span class="chip chip-active">{b.key}</span>
        {/each}
        {#each inactiveBooleans as b (b.key)}
          <span class="chip chip-inactive">{b.key}</span>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Strings (Passives & Boosts) -->
  {#if strings.length > 0}
    <div class="summary-section">
      <div class="section-header">Passives & Boosts</div>
      {#each strings as entry (entry.type + entry.action)}
        <div class="string-group">
          <span class="string-type-label">{entry.type}</span>
          <div class="chips-wrap">
            {#each entry.values as val}
              {#if entry.action === "Remove"}
                <span class="chip chip-remove">{val}</span>
              {:else}
                <span class="chip chip-insert">{val}</span>
              {/if}
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Raw Attributes (combined view with copy-as-LSX) -->
  {#if rawAttributes && Object.keys(rawAttributes).length > 0}
    <div class="summary-section">
      <div class="section-header lsx-section-header">
        <span>Raw Attributes ({Object.keys(rawAttributes).length})</span>
        <button class="copy-lsx-btn" onclick={copyAsLsx} title="Copy as LSX">
          {#if copied}
            <Check size={10} />
            <span>Copied!</span>
          {:else if copyError}
            <span class="text-[var(--th-text-red-400)]">Failed</span>
          {:else}
            <Copy size={10} />
            <span>Copy LSX</span>
          {/if}
        </button>
      </div>
      <div class="lsx-codeblock">
        <pre class="lsx-codeblock-body">{#each Object.entries(rawAttributes) as [key, value]}<code><span class="lsx-attr-key">{key}</span><span class="lsx-punct">:</span> <span class="lsx-attr-val">{value}</span>
</code>{/each}{#if rawChildren}{#each Object.entries(rawChildren) as [group, guids]}{#if guids.length > 0}<code><span class="lsx-child-key">{group}</span><span class="lsx-punct">:</span> <span class="lsx-child-val">{guids.join(', ')}</span>
</code>{/if}{/each}{/if}</pre>
      </div>
    </div>
  {/if}

  <!-- Auto Entry Indicator -->
  {#if autoEntryId}
    <div class="summary-section">
      <div class="section-header">Auto Entry Override</div>
      <div class="summary-uuid">{autoEntryId}</div>
    </div>
  {/if}
</div>

<style>
  .entry-summary {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    flex: 1;
    overflow-y: auto;
    font-size: 0.75rem;
    color: var(--th-text-200);
  }

  .summary-section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .summary-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--th-text-100);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .summary-uuid {
    font-size: 0.625rem;
    font-family: monospace;
    color: var(--th-text-500);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .summary-section-label {
    font-size: 0.625rem;
    font-weight: 500;
    color: var(--th-text-500);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-header {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--th-text-500);
    margin-bottom: 0.125rem;
  }

  .validation-badges {
    display: flex;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.375rem;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 1.2;
  }

  .badge-error {
    background: rgb(127 29 29 / 0.5);
    color: #fca5a5;
  }

  .badge-warn {
    background: rgb(120 53 15 / 0.5);
    color: #fcd34d;
  }

  .fields-grid {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .field-row {
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
    min-width: 0;
  }

  .field-label {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
    font-size: 0.6875rem;
    color: var(--th-text-500);
  }

  .field-label :global(.diff-dot) {
    color: #f59e0b;
    flex-shrink: 0;
  }

  .field-value {
    font-size: 0.6875rem;
    color: var(--th-text-200);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .chips-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .chip {
    display: inline-block;
    padding: 0.0625rem 0.375rem;
    border-radius: 9999px;
    font-size: 0.625rem;
    font-weight: 500;
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 12rem;
  }

  .chip-active {
    background: var(--th-badge-info-bg, rgb(14 165 233 / 0.25));
    color: var(--th-badge-info-text, #7dd3fc);
  }

  .chip-inactive {
    background: var(--th-badge-muted-bg, var(--th-bg-800));
    color: var(--th-badge-muted-text, var(--th-text-500));
  }

  .chip-insert {
    background: var(--th-badge-import-bg, rgb(3 105 161 / 0.3));
    color: var(--th-badge-import-text, #7dd3fc);
  }

  .chip-remove {
    background: var(--th-badge-error-bg, rgb(127 29 29 / 0.4));
    color: var(--th-badge-error-text, #fca5a5);
  }

  .string-group {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .string-type-label {
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--th-text-400);
  }

  .lsx-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .copy-lsx-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.375rem;
    border: 1px solid var(--th-border-700);
    border-radius: 0.25rem;
    background: var(--th-bg-800);
    color: var(--th-text-400);
    font-size: 0.5625rem;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .copy-lsx-btn:hover {
    color: var(--th-text-200);
    border-color: var(--th-border-500);
  }

  .lsx-codeblock {
    border: 1px solid var(--th-lsx-border);
    border-radius: 0.375rem;
    overflow: hidden;
    max-height: 12rem;
    font-size: 0.75rem;
  }
  .lsx-codeblock-body {
    background: var(--th-lsx-body-bg);
    margin: 0;
    padding: 0.5rem;
    overflow-y: auto;
    max-height: 10rem;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    font-size: 0.75rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    cursor: default;
    user-select: text;
  }
  .lsx-attr-key { color: var(--th-lsx-attr-key); }
  .lsx-attr-val { color: var(--th-lsx-attr-val); }
  .lsx-child-key { color: var(--th-lsx-child-key); }
  .lsx-child-val { color: var(--th-lsx-child-val); }
  .lsx-punct { color: var(--th-lsx-punct); }
</style>
