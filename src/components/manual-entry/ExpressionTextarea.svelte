<script lang="ts">
  import { CONDITION_FUNCTIONS } from "../../lib/data/conditionFunctions.js";
  import type { ConditionFunctionDef } from "../../lib/data/conditionFunctions.js";

  let {
    id,
    value,
    expressionType,
    oninput,
  }: {
    id: string;
    value: string;
    expressionType: string;
    oninput: (e: Event) => void;
  } = $props();

  let showAutocomplete = $state(false);
  let suggestions = $state<ConditionFunctionDef[]>([]);
  let selectedIndex = $state(0);
  let textareaEl: HTMLTextAreaElement | undefined = $state();
  let prefixStart = $state(0);
  let currentPrefix = $state('');

  function getWordAtCursor(textarea: HTMLTextAreaElement): { word: string; start: number } {
    const pos = textarea.selectionStart;
    const text = textarea.value;
    let start = pos;
    while (start > 0 && /[a-zA-Z]/.test(text[start - 1])) {
      start--;
    }
    return { word: text.slice(start, pos), start };
  }

  function isWordBoundary(text: string, pos: number): boolean {
    if (pos <= 0) return true;
    const prev = text[pos - 1];
    return /[\s(,;]/.test(prev) || text.slice(Math.max(0, pos - 4), pos).match(/\b(and|or|not)\s*$/i) !== null;
  }

  function updateSuggestions() {
    if (expressionType !== 'condition' || !textareaEl) {
      showAutocomplete = false;
      return;
    }

    const { word, start } = getWordAtCursor(textareaEl);

    if (word.length < 2 || !isWordBoundary(textareaEl.value, start)) {
      showAutocomplete = false;
      return;
    }

    const lower = word.toLowerCase();
    const filtered = CONDITION_FUNCTIONS.filter(fn =>
      fn.name.toLowerCase().startsWith(lower)
    );

    if (filtered.length === 0) {
      showAutocomplete = false;
      return;
    }

    // Sort: functions with 'general' context first
    filtered.sort((a, b) => {
      const aGeneral = a.contexts.includes('general') ? 0 : 1;
      const bGeneral = b.contexts.includes('general') ? 0 : 1;
      return aGeneral - bGeneral || a.name.localeCompare(b.name);
    });

    currentPrefix = word;
    prefixStart = start;
    suggestions = filtered;
    selectedIndex = 0;
    showAutocomplete = true;
  }

  function selectSuggestion(fn: ConditionFunctionDef) {
    if (!textareaEl) return;

    const before = textareaEl.value.slice(0, prefixStart);
    const after = textareaEl.value.slice(prefixStart + currentPrefix.length);
    const insertion = `${fn.name}()`;
    const newValue = before + insertion + after;

    textareaEl.value = newValue;

    // Position cursor inside parens
    const cursorPos = prefixStart + fn.name.length + 1;
    textareaEl.setSelectionRange(cursorPos, cursorPos);

    // Fire input event so parent updates
    textareaEl.dispatchEvent(new Event('input', { bubbles: true }));

    showAutocomplete = false;
    textareaEl.focus();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!showAutocomplete) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault();
      selectSuggestion(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      showAutocomplete = false;
    }
  }

  function handleInput(e: Event) {
    oninput(e);
    updateSuggestions();
  }

  function handleBlur() {
    setTimeout(() => {
      showAutocomplete = false;
    }, 150);
  }
</script>

<div class="expression-field-wrapper">
  <textarea
    {id}
    bind:this={textareaEl}
    class="form-input expression-field w-full"
    rows="3"
    {value}
    oninput={handleInput}
    onkeydown={handleKeydown}
    onblur={handleBlur}
  ></textarea>
  {#if showAutocomplete && suggestions.length > 0}
    <div class="autocomplete-dropdown" role="listbox" aria-label="Condition function suggestions">
      {#each suggestions as fn, i}
        <button
          type="button"
          class="autocomplete-item"
          class:selected={i === selectedIndex}
          role="option"
          aria-selected={i === selectedIndex}
          onmousedown={() => selectSuggestion(fn)}
        >
          <span class="autocomplete-name">{fn.name}<span class="autocomplete-params">{fn.params ? `(${fn.params})` : '()'}</span></span>
          <span class="autocomplete-desc">{fn.description}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .expression-field-wrapper {
    position: relative;
  }

  .expression-field {
    font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
    font-size: 0.8125rem;
    line-height: 1.5;
    white-space: pre-wrap;
    resize: vertical;
    min-height: 4.5rem;
    height: auto;
  }

  .form-input {
    box-sizing: border-box;
    height: 2.25rem;
    background-color: var(--th-input-bg);
    border: 1px solid var(--th-input-border);
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.8125rem;
    color: var(--th-input-text);
  }
  .form-input:focus {
    outline: none;
    border-color: rgb(14 165 233);
  }

  .autocomplete-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 50;
    max-height: 12rem;
    overflow-y: auto;
    background: var(--th-bg-800, #1e1e2e);
    border: 1px solid var(--th-border-600, #52525b);
    border-radius: 0.25rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    margin-top: 2px;
  }

  .autocomplete-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.375rem 0.5rem;
    font-size: 0.75rem;
    color: var(--th-text-300, #d1d5db);
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    gap: 0.5rem;
  }

  .autocomplete-item:hover,
  .autocomplete-item.selected {
    background: var(--th-bg-700, #2a2a3e);
    color: var(--th-text-100, #f1f5f9);
  }

  .autocomplete-name {
    font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
    font-weight: 500;
    white-space: nowrap;
  }

  .autocomplete-params {
    color: var(--th-text-500, #64748b);
    font-weight: 400;
  }

  .autocomplete-desc {
    color: var(--th-text-500, #64748b);
    font-size: 0.6875rem;
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 1;
    min-width: 0;
  }
</style>
