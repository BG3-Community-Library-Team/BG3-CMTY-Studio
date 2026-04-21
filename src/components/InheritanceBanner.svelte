<script lang="ts">
  import Button from "./Button.svelte";
  import { compareInheritanceFields } from "../lib/utils/inheritanceComparison.js";

  interface Props {
    parentName: string;
    parentFields: Record<string, string>;
    childFields: Record<string, string>;
    onClearInheritance: () => void;
  }

  let {
    parentName,
    parentFields,
    childFields,
    onClearInheritance,
  }: Props = $props();

  let comparison = $derived(compareInheritanceFields(parentFields, childFields));
</script>

<section class="inheritance-banner" aria-label="Inheritance summary">
  <div class="banner-copy">
    <p class="banner-eyebrow">Using</p>
    <div class="banner-title" title={parentName}>{parentName}</div>
    <p class="banner-description">Fields left unset here inherit from the selected parent entry.</p>

    <div class="banner-counts" role="status" aria-live="polite">
      <span
        class="count-badge count-inherited"
        aria-label={`${comparison.inheritedKeys.length} inherited fields`}
      >
        <strong>{comparison.inheritedKeys.length}</strong>
        inherited
      </span>
      <span
        class="count-badge count-overridden"
        aria-label={`${comparison.overriddenKeys.length} overridden fields`}
      >
        <strong>{comparison.overriddenKeys.length}</strong>
        overridden
      </span>
      <span
        class="count-badge count-new"
        aria-label={`${comparison.newKeys.length} new fields`}
      >
        <strong>{comparison.newKeys.length}</strong>
        new
      </span>
    </div>
  </div>

  <div class="banner-actions">
    <Button type="button" variant="secondary" size="sm" onclick={onClearInheritance}>Clear Inheritance</Button>
  </div>
</section>

<style>
  .inheritance-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.875rem;
    padding: 0.75rem 0.875rem;
    border: 1px solid var(--th-border-700);
    border-radius: 0.5rem;
    background: var(--th-bg-800);
  }

  .banner-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .banner-eyebrow {
    margin: 0;
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--th-text-500);
  }

  .banner-title {
    min-width: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--th-text-100);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .banner-description {
    margin: 0;
    font-size: 0.75rem;
    color: var(--th-text-400);
  }

  .banner-counts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .count-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 1.2;
  }

  .count-badge strong {
    font-size: 0.75rem;
  }

  .count-inherited {
    background: var(--th-bg-700);
    color: var(--th-text-300);
  }

  .count-overridden {
    background: rgb(180 83 9 / 0.18);
    color: var(--th-text-amber-400, #fbbf24);
  }

  .count-new {
    background: rgb(3 105 161 / 0.22);
    color: var(--th-text-sky-400, #38bdf8);
  }

  .banner-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  @media (max-width: 720px) {
    .inheritance-banner {
      flex-direction: column;
      align-items: stretch;
    }

    .banner-actions {
      justify-content: flex-start;
    }
  }
</style>