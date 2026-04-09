<script lang="ts">
  import { validateScript, type ScriptDiagnostic } from "../../lib/tauri/scripts.js";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import CircleX from "@lucide/svelte/icons/circle-x";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import Info from "@lucide/svelte/icons/info";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { m } from "../../paraglide/messages.js";

  interface Props {
    filePath: string;
    language: string;
    content: string;
    ongotoline?: (line: number) => void;
  }

  let { filePath, language, content, ongotoline }: Props = $props();

  let diagnostics: ScriptDiagnostic[] = $state([]);
  let expanded = $state(false);
  let validating = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined = $state(undefined);
  let listEl: HTMLUListElement | undefined = $state(undefined);

  let errorCount = $derived(diagnostics.filter(d => d.severity === "Error").length);
  let warningCount = $derived(diagnostics.filter(d => d.severity === "Warning").length);
  let infoCount = $derived(diagnostics.filter(d => d.severity === "Info").length);
  let hasIssues = $derived(diagnostics.length > 0);

  async function validate() {
    validating = true;
    try {
      diagnostics = await validateScript(filePath, language, content);
    } catch {
      // Backend command may not exist yet — treat as no diagnostics
      diagnostics = [];
    } finally {
      validating = false;
    }
  }

  // Debounced re-validation when content changes
  $effect(() => {
    // Read content to subscribe to changes
    const _c = content;
    const _fp = filePath;
    const _lang = language;

    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      validate();
    }, 500);

    return () => {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }
    };
  });

  function toggleExpanded() {
    expanded = !expanded;
    if (expanded && listEl) {
      // Focus the list when expanding for keyboard navigation
      requestAnimationFrame(() => listEl?.focus());
    }
  }

  function handleDiagnosticClick(diag: ScriptDiagnostic) {
    ongotoline?.(diag.line);
  }

  function handleListKeydown(e: KeyboardEvent) {
    const items = listEl?.querySelectorAll<HTMLLIElement>("[data-diag-index]");
    if (!items || items.length === 0) return;

    const focused = listEl?.querySelector<HTMLLIElement>(":focus");
    let currentIndex = focused ? Number(focused.dataset.diagIndex ?? 0) : -1;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(currentIndex + 1, items.length - 1);
      items[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(currentIndex - 1, 0);
      items[prev]?.focus();
    } else if (e.key === "Enter" && focused) {
      e.preventDefault();
      const idx = Number(focused.dataset.diagIndex);
      if (diagnostics[idx]) {
        handleDiagnosticClick(diagnostics[idx]);
      }
    } else if (e.key === "Escape") {
      expanded = false;
    }
  }

  function severityIcon(severity: ScriptDiagnostic["severity"]) {
    if (severity === "Error") return CircleX;
    if (severity === "Warning") return AlertTriangle;
    return Info;
  }
</script>

<div class="diagnostics-bar">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <button
    class="summary-row"
    onclick={toggleExpanded}
    aria-expanded={expanded}
    aria-controls="diagnostics-list"
  >
    <span class="summary-toggle">
      {#if expanded}
        <ChevronDown size={14} />
      {:else}
        <ChevronRight size={14} />
      {/if}
    </span>

    <span class="summary-counts" aria-live="polite" role="status">
      {#if !hasIssues}
        <span class="count-badge count-ok">
          <CircleCheck size={14} />
          {m.diagnostics_no_issues()}
        </span>
      {:else}
        {#if errorCount > 0}
          <span class="count-badge count-error">
            <CircleX size={14} />
            {m.diagnostics_error_count({ count: errorCount })}
          </span>
        {/if}
        {#if warningCount > 0}
          <span class="count-badge count-warning">
            <AlertTriangle size={14} />
            {m.diagnostics_warning_count({ count: warningCount })}
          </span>
        {/if}
        {#if infoCount > 0}
          <span class="count-badge count-info">
            <Info size={14} />
            {m.diagnostics_info_count({ count: infoCount })}
          </span>
        {/if}
      {/if}
    </span>

    {#if validating}
      <span class="validating-indicator">{m.diagnostics_validating()}</span>
    {/if}
  </button>

  {#if expanded && hasIssues}
    <ul
      id="diagnostics-list"
      class="diagnostic-list"
      role="listbox"
      aria-label={m.diagnostics_list_label()}
      bind:this={listEl}
      onkeydown={handleListKeydown}
    >
      {#each diagnostics as diag, i}
        {@const SeverityIcon = severityIcon(diag.severity)}
        <li
          class="diagnostic-item severity-{diag.severity.toLowerCase()}"
          data-diag-index={i}
          role="option"
          aria-selected="false"
          tabindex={i === 0 ? 0 : -1}
          onclick={() => handleDiagnosticClick(diag)}
          onkeydown={(e) => { if (e.key === "Enter") handleDiagnosticClick(diag); }}
        >
          <span class="diag-icon">
            <SeverityIcon size={14} />
          </span>
          <span class="diag-line">{m.diagnostics_line({ line: diag.line })}</span>
          <span class="diag-message">{diag.message}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .diagnostics-bar {
    border-top: 1px solid var(--th-border-700);
    background: var(--th-bg-900);
    font-size: 0.75rem;
    user-select: none;
  }

  .summary-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.25rem 0.75rem;
    border: none;
    background: transparent;
    color: var(--th-text-300);
    cursor: pointer;
    font-size: 0.75rem;
    font-family: inherit;
    text-align: left;
  }

  .summary-row:hover {
    background: var(--th-bg-800);
  }

  .summary-row:focus-visible {
    outline: 2px solid var(--th-accent-sky);
    outline-offset: -2px;
  }

  .summary-toggle {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    color: var(--th-text-400);
  }

  .summary-counts {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .count-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .count-ok {
    color: var(--th-accent-emerald);
  }

  .count-error {
    color: #ef4444;
  }

  .count-warning {
    color: #f59e0b;
  }

  .count-info {
    color: var(--th-accent-sky);
  }

  .validating-indicator {
    margin-left: auto;
    color: var(--th-text-500);
    font-style: italic;
  }

  .diagnostic-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 12rem;
    overflow-y: auto;
    border-top: 1px solid var(--th-border-700);
  }

  .diagnostic-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.2rem 0.75rem 0.2rem 1.75rem;
    cursor: pointer;
    color: var(--th-text-300);
  }

  .diagnostic-item:hover {
    background: var(--th-bg-800);
  }

  .diagnostic-item:focus-visible {
    outline: 2px solid var(--th-accent-sky);
    outline-offset: -2px;
    background: var(--th-bg-800);
  }

  .severity-error .diag-icon {
    color: #ef4444;
  }

  .severity-warning .diag-icon {
    color: #f59e0b;
  }

  .severity-info .diag-icon {
    color: var(--th-accent-sky);
  }

  .diag-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .diag-line {
    flex-shrink: 0;
    color: var(--th-text-500);
    font-variant-numeric: tabular-nums;
    min-width: 4rem;
  }

  .diag-message {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
