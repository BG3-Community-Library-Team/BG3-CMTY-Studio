<script lang="ts">
  import { descriptionTemplateStore, type DescriptionTemplate } from "../../lib/stores/descriptionTemplateStore.svelte.js";
  import { m } from "../../paraglide/messages.js";
  import FileText from "@lucide/svelte/icons/file-text";

  interface Props {
    platform: "nexus" | "modio" | "both";
    values?: Record<string, string>;
    onselect: (content: string) => void;
  }

  let { platform, values = {}, onselect }: Props = $props();

  let filteredTemplates = $derived(
    descriptionTemplateStore.templates.filter(
      (t: DescriptionTemplate) => t.platform === platform || t.platform === "both"
    )
  );

  function handleSelect(template: DescriptionTemplate) {
    const filled = descriptionTemplateStore.fillTemplate(template.id, values);
    if (filled) onselect(filled);
  }
</script>

{#if filteredTemplates.length > 0}
  <div class="template-select">
    <span class="template-label">
      <FileText size={14} />
      {m.description_template_label()}
    </span>
    <div class="template-options">
      {#each filteredTemplates as template (template.id)}
        <button
          type="button"
          class="template-option"
          onclick={() => handleSelect(template)}
        >
          {template.name}
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .template-select {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .template-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--th-text-300);
  }

  .template-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .template-option {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    border: 1px solid var(--th-border-700);
    border-radius: 0.25rem;
    background: var(--th-bg-800);
    color: var(--th-text-200);
    cursor: pointer;
    transition: background 0.15s;
  }

  .template-option:hover {
    background: var(--th-bg-700);
    border-color: var(--th-border-500);
  }
</style>
