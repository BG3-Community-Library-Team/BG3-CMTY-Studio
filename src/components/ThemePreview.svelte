<!--
  Theme Preview: Read-only display of sample UI elements styled with the active theme's CSS variables.
  Shows in settings when the Theme section is active. All styling uses var(--th-*) tokens.
-->
<script lang="ts">
  import Button from "./Button.svelte";
  import { m } from "../paraglide/messages.js";

  let { overrideStyle = "" }: { overrideStyle?: string } = $props();
</script>

<div class="p-4 space-y-4 text-xs" style={overrideStyle}>
  <h3 class="text-sm font-semibold text-[var(--th-text-100)]">{m.theme_preview_heading()}</h3>

  <!-- Text & Backgrounds -->
  <div class="space-y-1.5">
    <span class="text-[10px] text-[var(--th-text-600)] uppercase tracking-wider">{m.theme_preview_text_backgrounds()}</span>
    <div class="rounded border border-[var(--th-border-700)] overflow-hidden">
      <div class="px-3 py-2 bg-[var(--th-bg-950)]">
        <span class="text-[var(--th-text-100)]">{m.theme_preview_heading_100()}</span>
      </div>
      <div class="px-3 py-2 bg-[var(--th-bg-900)]">
        <span class="text-[var(--th-text-200)]">{m.theme_preview_subheading_200()}</span>
      </div>
      <div class="px-3 py-2 bg-[var(--th-bg-800)]">
        <span class="text-[var(--th-text-300)]">{m.theme_preview_body_bg_800()}</span>
      </div>
      <div class="px-3 py-2 bg-[var(--th-bg-700)]">
        <span class="text-[var(--th-text-500)]">{m.theme_preview_muted_bg_700()}</span>
      </div>
    </div>
  </div>

  <!-- Form Controls -->
  <div class="space-y-1.5">
    <span class="text-[10px] text-[var(--th-text-600)] uppercase tracking-wider">{m.theme_preview_form_controls()}</span>
    <div class="space-y-2 rounded border border-[var(--th-border-700)] p-3 bg-[var(--th-bg-900)]">
      <input
        type="text"
        class="w-full h-8 rounded border px-2 text-xs"
        style="background: var(--th-input-bg); border-color: var(--th-input-border); color: var(--th-input-text);"
        placeholder={m.theme_preview_text_input()}
        readonly
      />
      <select
        class="w-full h-8 rounded border px-2 text-xs"
        style="background: var(--th-input-bg); border-color: var(--th-input-border); color: var(--th-input-text);"
        disabled
      >
        <option>{m.theme_preview_select_dropdown()}</option>
      </select>
      <div class="flex gap-2">
        <Button variant="primary" size="sm">{m.theme_preview_primary()}</Button>
        <Button variant="secondary" size="sm">{m.theme_preview_secondary()}</Button>
        <Button variant="ghost" size="sm">{m.theme_preview_ghost()}</Button>
        <Button variant="destructive" size="sm">{m.theme_preview_delete()}</Button>
      </div>
    </div>
  </div>

  <!-- Tab Bar (faux) -->
  <div class="space-y-1.5">
    <span class="text-[10px] text-[var(--th-text-600)] uppercase tracking-wider">{m.theme_preview_tabs()}</span>
    <div class="flex border-b border-[var(--th-border-700)] bg-[var(--th-bg-900)]">
      <div class="px-3 py-1.5 text-[var(--th-text-200)] border-b-2 border-[var(--th-text-sky-400)]">{m.theme_preview_tab_overview()}</div>
      <div class="px-3 py-1.5 text-[var(--th-text-500)]">{m.theme_preview_tab_changes()}</div>
      <div class="px-3 py-1.5 text-[var(--th-text-500)]">{m.theme_preview_tab_output()}</div>
    </div>
  </div>

  <!-- List Items -->
  <div class="space-y-1.5">
    <span class="text-[10px] text-[var(--th-text-600)] uppercase tracking-wider">{m.theme_preview_list_items()}</span>
    <div class="rounded border border-[var(--th-border-700)] overflow-hidden bg-[var(--th-bg-900)]">
      <div class="px-3 py-1.5 text-[var(--th-text-300)] hover:bg-[var(--th-bg-700)] border-l-2 border-transparent">{m.theme_preview_unselected_row()}</div>
      <div class="px-3 py-1.5 text-[var(--th-text-200)] bg-[var(--th-bg-800)] border-l-2 border-[var(--th-text-sky-400)]">
        {m.theme_preview_selected_row()}
        <span class="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-[var(--th-bg-sky-700-40)] text-[var(--th-text-sky-400)]">3</span>
      </div>
      <div class="px-3 py-1.5 text-[var(--th-text-300)] border-l-2 border-transparent">{m.theme_preview_another_row()}</div>
    </div>
  </div>

  <!-- Sidebar Sample -->
  <div class="space-y-1.5">
    <span class="text-[10px] text-[var(--th-text-600)] uppercase tracking-wider">{m.theme_preview_sidebar()}</span>
    <div class="rounded border border-[var(--th-sidebar-border,var(--th-border-700))] overflow-hidden">
      <div class="px-3 py-1.5 bg-[var(--th-sidebar-bg-deep,var(--th-bg-950))] text-[var(--th-sidebar-text-muted,var(--th-text-500))]">{m.theme_preview_deep_bg()}</div>
      <div class="px-3 py-1.5 bg-[var(--th-sidebar-bg,var(--th-bg-900))] text-[var(--th-sidebar-text,var(--th-text-200))]">{m.theme_preview_sidebar_text()}</div>
      <div class="px-3 py-1.5 bg-[var(--th-sidebar-highlight,var(--th-bg-800))] text-[var(--th-sidebar-text,var(--th-text-100))]">{m.theme_preview_highlight()}</div>
    </div>
  </div>

  <!-- Syntax Block -->
  <div class="space-y-1.5">
    <span class="text-[10px] text-[var(--th-text-600)] uppercase tracking-wider">{m.theme_preview_syntax()}</span>
    <pre class="rounded border border-[var(--th-border-700)] p-3 bg-[var(--th-bg-950)] font-mono text-[11px] leading-relaxed overflow-x-auto"><span class="text-[var(--th-yaml-comment)]"># Config example</span>
<span class="text-[var(--th-yaml-key)]">Progressions</span>:
  - <span class="text-[var(--th-yaml-key)]">UUID</span>: <span class="text-[var(--th-yaml-string)]">"a1b2c3d4-..."</span>
    <span class="text-[var(--th-yaml-key)]">Level</span>: <span class="text-[var(--th-yaml-number)]">5</span>
    <span class="text-[var(--th-yaml-key)]">IsHidden</span>: <span class="text-[var(--th-yaml-boolean)]">true</span></pre>
  </div>

  <!-- Diff Sample -->
  <div class="space-y-1.5">
    <span class="text-[10px] text-[var(--th-text-600)] uppercase tracking-wider">{m.theme_preview_diff()}</span>
    <div class="rounded border border-[var(--th-border-700)] overflow-hidden font-mono text-[11px]">
      <div class="px-3 py-1 bg-[var(--th-diff-added)] text-[var(--th-text-200)]">{m.theme_preview_diff_added()}</div>
      <div class="px-3 py-1 bg-[var(--th-diff-removed)] text-[var(--th-text-200)]">{m.theme_preview_diff_removed()}</div>
      <div class="px-3 py-1 bg-[var(--th-diff-changed)] text-[var(--th-text-200)]">{m.theme_preview_diff_changed()}</div>
    </div>
  </div>

  <!-- Status Indicators -->
  <div class="space-y-1.5">
    <span class="text-[10px] text-[var(--th-text-600)] uppercase tracking-wider">{m.theme_preview_status()}</span>
    <div class="flex gap-2">
      <span class="px-2 py-0.5 rounded text-[10px] bg-[var(--th-bg-sky-700-40)] text-[var(--th-text-sky-400)]">{m.theme_preview_info()}</span>
      <span class="px-2 py-0.5 rounded text-[10px] bg-[var(--th-bg-red-900-50)] text-[var(--th-text-red-400)]">{m.theme_preview_error()}</span>
      <span class="px-2 py-0.5 rounded text-[10px] bg-amber-900/50 text-[var(--th-text-amber-400)]">{m.theme_preview_warning()}</span>
      <span class="px-2 py-0.5 rounded text-[10px] bg-emerald-900/50 text-[var(--th-text-emerald-400)]">{m.theme_preview_success()}</span>
    </div>
  </div>

  <!-- Borders -->
  <div class="space-y-1.5">
    <span class="text-[10px] text-[var(--th-text-600)] uppercase tracking-wider">{m.theme_preview_borders()}</span>
    <hr class="border-[var(--th-border-700)]" />
    <div class="rounded border border-[var(--th-border-600)] p-3 bg-[var(--th-bg-800)]">
      <span class="text-[var(--th-text-300)]">{m.theme_preview_card_border()}</span>
    </div>
  </div>
</div>
