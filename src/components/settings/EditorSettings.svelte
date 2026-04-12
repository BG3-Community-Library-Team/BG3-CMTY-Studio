<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { settingsStore } from "../../lib/stores/settingsStore.svelte.js";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
</script>

<h3 class="settings-section-title">{m.settings_editor_title()}</h3>

<div class="space-y-4">
  <!-- Font Size -->
  <div>
    <label class="text-xs font-medium text-[var(--th-text-300)] mb-1 block" for="editor-font-size">{m.settings_editor_font_size()}</label>
    <input
      id="editor-font-size"
      type="number"
      min="8"
      max="32"
      step="1"
      class="w-24 form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
      value={settingsStore.editorFontSize}
      onchange={(e) => { settingsStore.editorFontSize = Math.min(32, Math.max(8, Number((e.target as HTMLInputElement).value) || 12)); settingsStore.persist(); }}
    />
  </div>

  <!-- Font Family -->
  <div>
    <label class="text-xs font-medium text-[var(--th-text-300)] mb-1 block" for="editor-font-family">{m.settings_editor_font_family()}</label>
    <input
      id="editor-font-family"
      type="text"
      class="w-full form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
      value={settingsStore.editorFontFamily}
      onblur={(e) => { const v = (e.target as HTMLInputElement).value.trim(); if (v && v !== settingsStore.editorFontFamily) { settingsStore.editorFontFamily = v; settingsStore.persist(); } }}
    />
  </div>

  <!-- Tab Size -->
  <div>
    <span class="text-xs font-medium text-[var(--th-text-300)] mb-1 block">{m.settings_editor_tab_size()}</span>
    <div class="flex gap-3" role="radiogroup" aria-label={m.settings_editor_tab_size()}>
      {#each [2, 4, 8] as size}
        <label class="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--th-text-200)]">
          <input
            type="radio"
            name="editor-tab-size"
            class="w-4 h-4 accent-[var(--th-accent-500,#0ea5e9)] cursor-pointer"
            value={size}
            checked={settingsStore.editorTabSize === size}
            onchange={() => { settingsStore.editorTabSize = size; settingsStore.persist(); }}
          />
          {size}
        </label>
      {/each}
    </div>
  </div>

  <!-- Word Wrap -->
  <label class="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 -mx-2 hover:bg-[var(--th-bg-700)]/60 transition-colors">
    <input type="checkbox" class="w-4 h-4 rounded accent-[var(--th-accent-500,#0ea5e9)] cursor-pointer"
      checked={settingsStore.editorWordWrap}
      onchange={(e) => { settingsStore.editorWordWrap = (e.target as HTMLInputElement).checked; settingsStore.persist(); }}
    />
    <span class="text-xs text-[var(--th-text-200)]">{m.settings_editor_word_wrap()}</span>
  </label>

  <!-- Line Numbers -->
  <label class="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 -mx-2 hover:bg-[var(--th-bg-700)]/60 transition-colors">
    <input type="checkbox" class="w-4 h-4 rounded accent-[var(--th-accent-500,#0ea5e9)] cursor-pointer"
      checked={settingsStore.editorLineNumbers}
      onchange={(e) => { settingsStore.editorLineNumbers = (e.target as HTMLInputElement).checked; settingsStore.persist(); }}
    />
    <span class="text-xs text-[var(--th-text-200)]">{m.settings_editor_line_numbers()}</span>
  </label>

  <!-- Bracket Matching -->
  <label class="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 -mx-2 hover:bg-[var(--th-bg-700)]/60 transition-colors">
    <input type="checkbox" class="w-4 h-4 rounded accent-[var(--th-accent-500,#0ea5e9)] cursor-pointer"
      checked={settingsStore.editorBracketMatching}
      onchange={(e) => { settingsStore.editorBracketMatching = (e.target as HTMLInputElement).checked; settingsStore.persist(); }}
    />
    <span class="text-xs text-[var(--th-text-200)]">{m.settings_editor_bracket_matching()}</span>
  </label>

  <!-- Active Line Highlight -->
  <label class="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 -mx-2 hover:bg-[var(--th-bg-700)]/60 transition-colors">
    <input type="checkbox" class="w-4 h-4 rounded accent-[var(--th-accent-500,#0ea5e9)] cursor-pointer"
      checked={settingsStore.editorActiveLineHighlight}
      onchange={(e) => { settingsStore.editorActiveLineHighlight = (e.target as HTMLInputElement).checked; settingsStore.persist(); }}
    />
    <span class="text-xs text-[var(--th-text-200)]">{m.settings_editor_active_line()}</span>
  </label>

  <!-- Lint Delay -->
  <div>
    <label class="text-xs font-medium text-[var(--th-text-300)] mb-1 block" for="editor-lint-delay">{m.settings_editor_lint_delay()}</label>
    <input
      id="editor-lint-delay"
      type="number"
      min="100"
      max="5000"
      step="100"
      class="w-28 form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
      value={settingsStore.editorLintDelay}
      onchange={(e) => { settingsStore.editorLintDelay = Math.min(5000, Math.max(100, Number((e.target as HTMLInputElement).value) || 500)); settingsStore.persist(); }}
    />
  </div>

  <!-- Reset -->
  <div class="pt-2 border-t border-[var(--th-border-700)]">
    <button
      class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-300)] transition-colors"
      onclick={() => settingsStore.resetEditorSettings()}
    >
      <RotateCcw size={12} />
      {m.settings_editor_reset()}
    </button>
  </div>
</div>

<style>
  .settings-section-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--th-text-200);
    margin-bottom: 0.75rem;
  }
</style>
