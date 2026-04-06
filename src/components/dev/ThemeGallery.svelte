<script lang="ts">
  import { THEME_OPTIONS } from "../../lib/stores/settingsStore.svelte.js";
  import { settingsStore } from "../../lib/stores/settingsStore.svelte.js";
  import type { ThemeId } from "../../lib/themes/themeManager.js";
  import FormSectionCard from "../manual-entry/FormSectionCard.svelte";
  import XIcon from "@lucide/svelte/icons/x";
  import Palette from "@lucide/svelte/icons/palette";
  import type { Snippet } from "svelte";

  let { onclose }: { onclose: () => void } = $props();

  let sampleToggle = $state(true);

  /** Read a computed CSS custom property value from :root */
  function getTokenValue(token: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || "–";
  }

  const BG_TOKENS = [
    "--th-bg-950", "--th-bg-900", "--th-bg-850", "--th-bg-800", "--th-bg-700",
  ] as const;

  const TEXT_TOKENS = [
    "--th-text-100", "--th-text-200", "--th-text-300", "--th-text-400", "--th-text-500", "--th-text-600",
  ] as const;

  const BORDER_TOKENS = [
    "--th-border-700", "--th-border-600",
  ] as const;

  const ACCENT_TOKENS = [
    "--th-bg-sky-600", "--th-text-sky-400", "--th-text-emerald-400",
    "--th-text-amber-400", "--th-text-red-400", "--th-text-violet-400",
  ] as const;

  const CARD_TOKENS = [
    "--th-card-bg", "--th-card-border", "--th-card-header-bg",
  ] as const;

  type TokenGroup = { label: string; tokens: readonly string[] };
  const TOKEN_GROUPS: TokenGroup[] = [
    { label: "Backgrounds", tokens: BG_TOKENS },
    { label: "Text", tokens: TEXT_TOKENS },
    { label: "Borders", tokens: BORDER_TOKENS },
    { label: "Accents", tokens: ACCENT_TOKENS },
    { label: "Cards", tokens: CARD_TOKENS },
  ];
</script>

{#if import.meta.env.DEV}
  <div class="flex flex-col h-full overflow-hidden bg-[var(--th-bg-950)]">
    <!-- Header bar -->
    <header class="flex items-center justify-between px-4 py-2 border-b border-[var(--th-border-700)] bg-[var(--th-bg-900)] shrink-0">
      <div class="flex items-center gap-2">
        <Palette size={16} class="text-[var(--th-text-sky-400)]" />
        <h1 class="text-sm font-bold text-[var(--th-text-100)]">Theme Gallery</h1>
        <span class="text-xs text-[var(--th-text-500)]">— dev only</span>
      </div>
      <button
        class="p-1 rounded hover:bg-[var(--th-bg-700)] text-[var(--th-text-400)] hover:text-[var(--th-text-200)] transition-colors"
        onclick={onclose}
        aria-label="Close"
      >
        <XIcon size={16} />
      </button>
    </header>

    <!-- Theme switcher row -->
    <div class="flex items-center gap-1.5 px-4 py-2 border-b border-[var(--th-border-700)] bg-[var(--th-bg-900)] shrink-0 flex-wrap">
      <span class="text-xs font-medium text-[var(--th-text-400)] mr-1">Theme:</span>
      {#each THEME_OPTIONS as opt}
        <button
          class="px-2.5 py-1 text-xs rounded-md transition-colors {settingsStore.theme === opt.id
            ? 'bg-[var(--th-bg-sky-600)] text-white font-semibold'
            : 'bg-[var(--th-bg-800)] text-[var(--th-text-300)] hover:bg-[var(--th-bg-700)] hover:text-[var(--th-text-100)]'}"
          onclick={() => { settingsStore.setTheme(opt.id as ThemeId); }}
        >
          {opt.label}
        </button>
      {/each}
    </div>

    <!-- Scrollable gallery body -->
    <div class="flex-1 overflow-y-auto p-4 space-y-6">

      <!-- ═══════════════════════════════════════════════
           Section 1: Color Token Swatches
           ═══════════════════════════════════════════════ -->
      {#key settingsStore.theme}
        <section>
          <h2 class="text-xs font-bold text-[var(--th-text-200)] uppercase tracking-wide mb-3">Color Token Swatches</h2>
          {#each TOKEN_GROUPS as group}
            <div class="mb-4">
              <h3 class="text-xs font-semibold text-[var(--th-text-400)] mb-1.5">{group.label}</h3>
              <div class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
                {#each group.tokens as token}
                  <div class="flex items-center gap-2 px-2 py-1.5 rounded bg-[var(--th-bg-800)] border border-[var(--th-border-700)]">
                    <span
                      class="w-6 h-6 rounded border border-[var(--th-border-600)] shrink-0"
                      style="background: var({token});"
                    ></span>
                    <div class="min-w-0">
                      <div class="text-[10px] font-mono text-[var(--th-text-300)] truncate">{token}</div>
                      <div class="text-[10px] font-mono text-[var(--th-text-500)]">{getTokenValue(token)}</div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </section>
      {/key}

      <!-- ═══════════════════════════════════════════════
           Section 2: FormSectionCard Variants
           ═══════════════════════════════════════════════ -->
      <section>
        <h2 class="text-xs font-bold text-[var(--th-text-200)] uppercase tracking-wide mb-3">FormSectionCard Variants</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormSectionCard title="Default Card">
            {#snippet children()}
              <p class="text-xs text-[var(--th-text-300)] p-2">
                A default FormSectionCard with no accent color. Content renders here using theme tokens.
              </p>
            {/snippet}
          </FormSectionCard>

          <FormSectionCard title="Accented Card" accentColor="#0ea5e9">
            {#snippet children()}
              <p class="text-xs text-[var(--th-text-300)] p-2">
                This card has an accent top border in sky blue. Great for highlighting active sections.
              </p>
            {/snippet}
          </FormSectionCard>

          <FormSectionCard title="Collapsed Card" open={false}>
            {#snippet children()}
              <p class="text-xs text-[var(--th-text-300)] p-2">
                This card starts collapsed. Click the header to expand.
              </p>
            {/snippet}
          </FormSectionCard>
        </div>
      </section>

      <!-- ═══════════════════════════════════════════════
           Section 3: Form Inputs
           ═══════════════════════════════════════════════ -->
      <section>
        <h2 class="text-xs font-bold text-[var(--th-text-200)] uppercase tracking-wide mb-3">Form Inputs</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Text Input -->
          <div>
            <span class="block text-xs font-medium text-[var(--th-text-400)] mb-1">Text Input (.form-input)</span>
            <input type="text" class="form-input w-full rounded border border-[var(--th-border-700)] bg-[var(--th-bg-800)] text-[var(--th-text-100)] px-2 py-1 text-xs" placeholder="Sample text input…" />
          </div>

          <!-- Number Input -->
          <div>
            <span class="block text-xs font-medium text-[var(--th-text-400)] mb-1">Number Input</span>
            <div class="relative">
              <input type="number" class="form-input w-full rounded border border-[var(--th-border-700)] bg-[var(--th-bg-800)] text-[var(--th-text-100)] px-2 py-1 text-xs pr-16" value="42" />
              <span class="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-medium px-1.5 py-0.5 rounded-full pointer-events-none badge-number">Number</span>
            </div>
          </div>

          <!-- Toggle Switch -->
          <div>
            <span class="block text-xs font-medium text-[var(--th-text-400)] mb-1">Toggle Switch</span>
            <div class="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={sampleToggle}
                aria-label="Toggle sample switch"
                class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 {sampleToggle ? 'bg-sky-500' : 'bg-[var(--th-bg-600,#52525b)]'}"
                onclick={() => sampleToggle = !sampleToggle}
              >
                <span class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 {sampleToggle ? 'translate-x-[18px]' : 'translate-x-0.5'}"></span>
              </button>
              <span class="text-xs text-[var(--th-text-300)]">{sampleToggle ? "On" : "Off"}</span>
            </div>
          </div>

          <!-- Type Badges -->
          <div>
            <span class="block text-xs font-medium text-[var(--th-text-400)] mb-1">Type Badges</span>
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium px-1.5 py-0.5 rounded-full badge-number">Number</span>
              <span class="text-xs font-medium px-1.5 py-0.5 rounded-full badge-text">Text</span>
              <span class="text-xs font-medium px-1.5 py-0.5 rounded-full badge-uuid">UUID</span>
              <span class="text-xs font-medium px-1.5 py-0.5 rounded-full badge-decimal">Decimal</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════════════════════════════════════════════
           Section 4: Typography Samples
           ═══════════════════════════════════════════════ -->
      <section>
        <h2 class="text-xs font-bold text-[var(--th-text-200)] uppercase tracking-wide mb-3">Typography</h2>
        <div class="space-y-3 bg-[var(--th-bg-800)] border border-[var(--th-border-700)] rounded-lg p-4">
          <div>
            <span class="text-[10px] text-[var(--th-text-500)] uppercase tracking-wider">Heading (text-100)</span>
            <h3 class="text-sm font-bold text-[var(--th-text-100)]">The quick brown fox jumps over the lazy dog</h3>
          </div>
          <div>
            <span class="text-[10px] text-[var(--th-text-500)] uppercase tracking-wider">Subheading (text-200)</span>
            <h4 class="text-xs font-semibold text-[var(--th-text-200)]">Section subheading in secondary brightness</h4>
          </div>
          <div>
            <span class="text-[10px] text-[var(--th-text-500)] uppercase tracking-wider">Body (text-300)</span>
            <p class="text-xs text-[var(--th-text-300)]">Regular body text used throughout the application for descriptions, labels, and content.</p>
          </div>
          <div>
            <span class="text-[10px] text-[var(--th-text-500)] uppercase tracking-wider">Muted (text-400)</span>
            <p class="text-xs text-[var(--th-text-400)]">Muted text for placeholders, hints, and secondary information.</p>
          </div>
          <div>
            <span class="text-[10px] text-[var(--th-text-500)] uppercase tracking-wider">Dimmed (text-500)</span>
            <p class="text-xs text-[var(--th-text-500)]">Dimmed text for timestamps, metadata, and tertiary info.</p>
          </div>
          <div>
            <span class="text-[10px] text-[var(--th-text-500)] uppercase tracking-wider">Code (monospace)</span>
            <code class="block text-xs font-mono text-[var(--th-text-sky-400)] bg-[var(--th-bg-850)] rounded px-2 py-1 mt-0.5">const entry = configStore.getEntry("UUID-1234");</code>
          </div>
          <div>
            <span class="text-[10px] text-[var(--th-text-500)] uppercase tracking-wider">Accent Colors</span>
            <div class="flex gap-3 mt-0.5">
              <span class="text-xs text-[var(--th-text-sky-400)]">Sky (link)</span>
              <span class="text-xs text-[var(--th-text-emerald-400)]">Emerald (success)</span>
              <span class="text-xs text-[var(--th-text-amber-400)]">Amber (warning)</span>
              <span class="text-xs text-[var(--th-text-red-400)]">Red (error)</span>
              <span class="text-xs text-[var(--th-text-violet-400)]">Violet (UUID)</span>
            </div>
          </div>
        </div>
      </section>

    </div>
  </div>
{/if}

<style>
  /* Badge classes matching LayoutCell patterns */
  .badge-uuid {
    background-color: var(--th-badge-uuid-bg, rgba(109, 40, 217, .15));
    color: var(--th-badge-uuid-text, var(--th-text-violet-400, #c4b5fd));
  }
  .badge-number {
    background-color: var(--th-badge-number-bg, rgba(3, 105, 161, .15));
    color: var(--th-badge-number-text, var(--th-text-sky-300, #7dd3fc));
  }
  .badge-text {
    background-color: var(--th-badge-text-bg, var(--th-bg-700, rgba(63, 63, 70, .5)));
    color: var(--th-badge-text-text, var(--th-text-300, #d4d4d8));
  }
  .badge-decimal {
    background-color: var(--th-badge-decimal-bg, rgba(180, 83, 9, .15));
    color: var(--th-badge-decimal-text, var(--th-text-amber-400, #fbbf24));
  }
</style>
