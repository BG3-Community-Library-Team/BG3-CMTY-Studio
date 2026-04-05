<script lang="ts">
  import { schemaStore } from "../lib/stores/schemaStore.svelte.js";
  import type { NodeSchema, AttrSchema } from "../lib/utils/tauri.js";
  import { snapshot } from "../lib/utils/formSnapshot.js";
  import X from "@lucide/svelte/icons/x";
  import Shuffle from "@lucide/svelte/icons/shuffle";
  import { m } from "../paraglide/messages.js";
  import { generateUuid } from "../lib/utils/uuid.js";

  let {
    section,
    nodeId = null,
    onclose,
    prefill = null,
    onsave,
  }: {
    section: string;
    nodeId?: string | null;
    onclose: () => void;
    prefill?: Record<string, string> | null;
    onsave: (attrs: Record<string, string>, nodeId: string, attrTypes: Record<string, string>) => void;
  } = $props();

  // Resolve the schema for this node type
  let schemas = $derived(schemaStore.getBySection(section));
  // svelte-ignore state_referenced_locally — intentional one-time snapshot
  let selectedNodeId = $state(snapshot(nodeId) ?? schemas[0]?.node_id ?? "");
  let schema = $derived(schemaStore.getByNodeId(selectedNodeId));

  // Form state: attribute key → value
  let values = $state<Record<string, string>>({});

  // Categorize attributes for organized rendering
  let identityAttrs = $derived(
    schema?.attributes.filter(a => (a.name === "UUID" || a.name === "MapKey") && a.attr_type === "guid") ?? []
  );
  let boolAttrs = $derived(
    schema?.attributes.filter(a => a.attr_type === "bool") ?? []
  );
  let guidAttrs = $derived(
    schema?.attributes.filter(a => a.attr_type === "guid" && a.name !== "UUID" && a.name !== "MapKey") ?? []
  );
  let dataAttrs = $derived(
    schema?.attributes.filter(a =>
      a.attr_type !== "bool" &&
      a.attr_type !== "guid" &&
      !(a.name === "UUID" || a.name === "MapKey")
    ) ?? []
  );

  const RARE_THRESHOLD = 0.25;

  // Initialize form values from prefill or empty
  function buildInit() {
    const init: Record<string, string> = {};
    const snapped = snapshot(prefill);
    if (snapped) {
      for (const [k, v] of Object.entries(snapped)) {
        init[k] = v;
      }
    }
    if (!init["UUID"] && !init["MapKey"]) {
      init["UUID"] = generateUuid();
    }
    return init;
  }
  values = buildInit();

  /** Map LSX attr_type to appropriate HTML input type */
  function inputType(attr: AttrSchema): string {
    switch (attr.attr_type) {
      case "int32": case "uint8": case "int8": case "uint32": case "int64":
        return "number";
      case "float": case "double":
        return "number";
      default:
        return "text";
    }
  }

  /** Get a type badge label for display */
  function typeBadge(attr: AttrSchema): { label: string; classes: string } {
    const t = attr.attr_type;
    if (t === "guid") return { label: "UUID", classes: "bg-violet-700/50 text-violet-300" };
    if (t === "TranslatedString") return { label: "Loca", classes: "bg-amber-700/50 text-amber-300" };
    if (t === "FixedString" || t === "LSString") return { label: "Text", classes: "bg-zinc-600/50 text-zinc-300" };
    if (t.includes("int") || t.startsWith("uint")) return { label: "Int", classes: "bg-sky-700/50 text-sky-300" };
    if (t === "float" || t === "double") return { label: "Float", classes: "bg-amber-700/50 text-amber-300" };
    if (t === "bool") return { label: "Bool", classes: "bg-emerald-700/50 text-emerald-300" };
    return { label: t, classes: "bg-zinc-600/50 text-zinc-400" };
  }

  function handleSave() {
    const attrs: Record<string, string> = {};
    const attrTypes: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v !== "") {
        attrs[k] = v;
        const schemaAttr = schema?.attributes.find(a => a.name === k);
        if (schemaAttr) attrTypes[k] = schemaAttr.attr_type;
      }
    }
    onsave(attrs, selectedNodeId, attrTypes);
  }

  function fillUuidField(field: string = "UUID") {
    values[field] = generateUuid();
  }
</script>

<div class="schema-form">
  <div class="flex items-center justify-between mb-3">
    <div class="flex items-center gap-2">
      <h3 class="text-sm font-semibold text-[var(--th-text-100)]">{m.schema_form_new_entry()}</h3>
      {#if schemas.length > 1}
        <select
          class="form-input text-xs h-6 py-0"
          value={selectedNodeId}
          onchange={(e) => selectedNodeId = (e.target as HTMLSelectElement).value}
        >
          {#each schemas as s}
            <option value={s.node_id}>{s.node_id} ({s.sample_count} samples)</option>
          {/each}
        </select>
      {:else if schema}
        <span class="text-xs text-[var(--th-text-500)]">{schema.node_id}</span>
      {/if}
    </div>
    <button class="p-2 rounded hover:bg-[var(--th-bg-600)]" onclick={onclose} aria-label={m.schema_form_close_aria()}>
      <X size={14} class="text-[var(--th-text-500)]" />
    </button>
  </div>

  {#if schemaStore.loading}
    <p class="text-xs text-[var(--th-text-500)] py-4 text-center">{m.schema_form_loading()}</p>
  {:else if !schema}
    <!-- No schema available — show basic UUID + Name form -->
    <p class="text-xs text-[var(--th-text-500)] mb-3">{m.schema_form_no_vanilla({ section })}</p>
    <fieldset class="space-y-1.5">
      <div class="flex items-center gap-2">
        <span class="text-xs text-[var(--th-text-400)] w-36 shrink-0 flex items-center gap-1">
          {m.schema_form_uuid_label()}
          <button
            type="button"
            class="inline-flex items-center justify-center w-5 h-5 rounded bg-[var(--th-accent-600)] text-white hover:opacity-90"
            onclick={() => fillUuidField()}
            title={m.schema_form_generate_uuid()}
          >
            <Shuffle size={10} />
          </button>
        </span>
        <input
          type="text"
          class="form-input w-full"
          value={values["UUID"] ?? ""}
          oninput={(e) => values["UUID"] = (e.target as HTMLInputElement).value}
          placeholder={m.schema_form_uuid_placeholder()}
        />
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-[var(--th-text-400)] w-36 shrink-0">Name</span>
        <input
          type="text"
          class="form-input w-full"
          value={values["Name"] ?? ""}
          oninput={(e) => values["Name"] = (e.target as HTMLInputElement).value}
          placeholder={m.schema_form_name_placeholder()}
        />
      </div>
    </fieldset>
  {:else}
    <!-- ── Schema-driven form ────────────────────────────── -->

    <!-- Identity (UUID / MapKey) -->
    {#if identityAttrs.length > 0}
      <fieldset class="space-y-1.5 mb-3">
        {#each identityAttrs as attr (attr.name)}
          <div class="flex items-center gap-2 max-w-[50%]">
            <span class="text-xs text-[var(--th-text-400)] w-36 shrink-0 flex items-center gap-1">
              {attr.name}
              <button
                type="button"
                class="inline-flex items-center justify-center w-5 h-5 rounded bg-[var(--th-accent-600)] text-white hover:opacity-90"
                onclick={() => fillUuidField(attr.name)}
                title={m.schema_form_generate_uuid()}
              >
                <Shuffle size={10} />
              </button>
            </span>
            <input
              type="text"
              class="form-input w-full"
              value={values[attr.name] ?? ""}
              oninput={(e) => values[attr.name] = (e.target as HTMLInputElement).value}
              placeholder={m.schema_form_uuid_placeholder()}
            />

          </div>
        {/each}
      </fieldset>
    {/if}

    <!-- Data attributes (text, numbers, loca handles) -->
    {#if dataAttrs.length > 0}
      <fieldset class="space-y-1.5 mb-2">
        <legend class="text-xs font-semibold text-[var(--th-text-300)] mb-1">{m.schema_form_attributes_legend()}</legend>
        {#each dataAttrs as attr (attr.name)}
          {@const badge = typeBadge(attr)}
          {@const isOptional = attr.frequency < RARE_THRESHOLD}
          <div class="flex items-center gap-2">
            <span class="text-xs text-[var(--th-text-400)] w-36 shrink-0 truncate" title="{attr.name} — {attr.attr_type} ({Math.round(attr.frequency * 100)}%)">
              {attr.name}
              {#if isOptional}<span class="text-[10px] text-[var(--th-text-600)]"> {m.common_optional()}</span>{/if}
            </span>
            <div class="relative flex-1">
              <input
                type={inputType(attr)}
                class="form-input w-full"
                value={values[attr.name] ?? ""}
                oninput={(e) => values[attr.name] = (e.target as HTMLInputElement).value}
                placeholder={attr.examples[0] ?? ""}
                step={attr.attr_type === "float" || attr.attr_type === "double" ? "0.01" : undefined}
              />
              <span class="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-medium px-1.5 py-0.5 rounded-full pointer-events-none {badge.classes}">{badge.label}</span>
            </div>
          </div>
        {/each}
      </fieldset>
    {/if}

    <!-- GUID reference attributes -->
    {#if guidAttrs.length > 0}
      <fieldset class="space-y-1.5 mb-2">
        <legend class="text-xs font-semibold text-[var(--th-text-300)] mb-1">{m.schema_form_references_legend()}</legend>
        {#each guidAttrs as attr (attr.name)}
          {@const isOptional = attr.frequency < RARE_THRESHOLD}
          <div class="flex items-center gap-2">
            <span class="text-xs text-[var(--th-text-400)] w-36 shrink-0 truncate" title="{attr.name} — guid ({Math.round(attr.frequency * 100)}%)">
              {attr.name}
              {#if isOptional}<span class="text-[10px] text-[var(--th-text-600)]"> {m.common_optional()}</span>{/if}
            </span>
            <div class="relative flex-1">
              <input
                type="text"
                class="form-input w-full pr-16"
                value={values[attr.name] ?? ""}
                oninput={(e) => values[attr.name] = (e.target as HTMLInputElement).value}
                placeholder={attr.examples[0] ?? m.schema_form_uuid_ref_placeholder()}
              />
              <button
                type="button"
                class="absolute right-1 top-1/2 -translate-y-1/2 text-xs px-1.5 py-0.5 rounded bg-violet-700/50 text-violet-300 hover:opacity-90"
                onclick={() => fillUuidField(attr.name)}
                title={m.schema_form_generate_uuid()}
              >
                <Shuffle size={12} />
              </button>
            </div>
          </div>
        {/each}
      </fieldset>
    {/if}

    <!-- Boolean attributes -->
    {#if boolAttrs.length > 0}
      <fieldset class="mb-2">
        <legend class="text-xs font-semibold text-[var(--th-text-300)] mb-1">{m.schema_form_booleans_legend()}</legend>
        <div class="flex flex-wrap gap-x-4 gap-y-1.5">
          {#each boolAttrs as attr (attr.name)}
            {@const isOptional = attr.frequency < RARE_THRESHOLD}
            <div class="flex items-center gap-2">
              <span class="text-xs text-[var(--th-text-400)] shrink-0" title="{attr.name} ({Math.round(attr.frequency * 100)}%)">
                {attr.name}
                {#if isOptional}<span class="text-[10px] text-[var(--th-text-600)]"> (opt)</span>{/if}
              </span>
              <button
                type="button"
                class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 {values[attr.name] === 'true' ? 'bg-emerald-500' : 'bg-[var(--th-bg-600,#52525b)]'}"
                role="switch"
                aria-checked={values[attr.name] === 'true'}
                aria-label="{attr.name} toggle"
                onclick={() => values[attr.name] = values[attr.name] === 'true' ? 'false' : 'true'}
              >
                <span
                  class="pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 {values[attr.name] === 'true' ? 'translate-x-4' : 'translate-x-0.5'}"
                ></span>
              </button>
              <span class="text-[10px] text-[var(--th-text-500)] w-8">{values[attr.name] === 'true' ? 'true' : 'false'}</span>
            </div>
          {/each}
        </div>
      </fieldset>
    {/if}

    <!-- Child groups -->
    {#if schema.children.length > 0}
      <div class="mt-3 pt-2 border-t border-[var(--th-border-700)]">
        <span class="text-xs font-semibold text-[var(--th-text-300)]">{m.schema_form_child_groups()}</span>
        <div class="flex flex-wrap gap-1.5 mt-1">
          {#each schema.children as child}
            <span class="text-xs px-2 py-1 rounded bg-[var(--th-bg-700)] text-[var(--th-text-400)] border border-[var(--th-border-600)]" title="{child.child_node_id} — {Math.round(child.frequency * 100)}% of entries">
              {child.group_id}
              <span class="text-[10px] text-[var(--th-text-600)] ml-0.5">({Math.round(child.frequency * 100)}%)</span>
            </span>
          {/each}
        </div>
        <p class="text-[10px] text-[var(--th-text-600)] mt-1">{m.schema_form_child_groups_info()}</p>
      </div>
    {/if}
  {/if}

  <!-- Actions -->
  <div class="flex justify-end gap-2 mt-4 pt-3 border-t border-[var(--th-border-700)]">
    <button
      type="button"
      class="px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] text-[var(--th-text-400)] hover:bg-[var(--th-bg-600)]"
      onclick={onclose}
    >{m.common_cancel()}</button>
    <button
      type="button"
      class="px-3 py-1.5 text-xs rounded bg-[var(--th-accent-500)] text-white hover:opacity-90"
      onclick={handleSave}
    >{m.schema_form_add_entry()}</button>
  </div>
</div>

<style>
  .schema-form {
    background: var(--th-bg-800);
    border: 1px solid var(--th-border-700);
    border-radius: 0.375rem;
    padding: 0.75rem 1rem;
  }
</style>
