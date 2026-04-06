<script lang="ts">
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";

  let {
    sections,
    errorCounts = {},
    containerEl = undefined,
  }: {
    /** Section identifiers with display labels and optional nested children */
    sections: { id: string; label: string; children?: { id: string; label: string }[] }[];
    /** Validation error/warning counts per section id */
    errorCounts?: Record<string, number>;
    /** Parent form container — scopes section lookups to this form only */
    containerEl?: HTMLElement;
  } = $props();

  /** Flattened list of all section ids (including children) for intersection observer */
  let flatSectionIds = $derived(
    sections.flatMap(s => [s, ...(s.children ?? [])]).map(s => s.id)
  );

  let activeSection: string = $state("");

  /** Find the nearest scrollable ancestor (overflow-y: auto|scroll) */
  function findScrollParent(el: HTMLElement): HTMLElement | null {
    let node = el.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      if (style.overflowY === "auto" || style.overflowY === "scroll") return node;
      node = node.parentElement;
    }
    return null;
  }

  /** Track which sections are currently intersecting, pick the topmost one */
  const visibleSet = new Set<string>();

  function pickTopmost() {
    if (visibleSet.size === 0) return;
    const scope = containerEl ?? document;

    // Skip parent sections when any of their children are also visible
    const parentsWithVisibleChildren = new Set<string>();
    for (const s of sections) {
      if (s.children?.some(c => visibleSet.has(c.id))) {
        parentsWithVisibleChildren.add(s.id);
      }
    }

    let best: string | undefined;
    let bestTop = Infinity;
    for (const id of visibleSet) {
      if (parentsWithVisibleChildren.has(id)) continue;
      const el = scope.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      if (el) {
        const top = el.getBoundingClientRect().top;
        if (top < bestTop) {
          bestTop = top;
          best = id;
        }
      }
    }
    if (best) activeSection = best;
  }

  /** Show nav when enough sections or when any section has children (level groups) */
  let showNav = $derived(
    sections.length >= 4 || sections.some(s => (s.children?.length ?? 0) > 0)
  );

  $effect(() => {
    if (!showNav) return;
    if (!containerEl) return;

    // Default to first section
    activeSection = sections[0]?.id ?? "";
    visibleSet.clear();

    const scrollParent = findScrollParent(containerEl);

    const targets: Element[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleSet.add(entry.target.id);
          } else {
            visibleSet.delete(entry.target.id);
          }
        }
        pickTopmost();
      },
      {
        root: scrollParent,
        rootMargin: "-10% 0px -40% 0px",
        threshold: 0,
      },
    );

    for (const id of flatSectionIds) {
      const el = containerEl.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      if (el) {
        observer.observe(el);
        targets.push(el);
      }
    }

    return () => {
      visibleSet.clear();
      for (const el of targets) observer.unobserve(el);
      observer.disconnect();
    };
  });

  function scrollToSection(id: string) {
    if (!containerEl) return;
    const el = containerEl.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!el) return;

    // Open any ancestor <details> that are collapsed (e.g. FormSectionCard)
    let ancestor: HTMLElement | null = el.parentElement;
    while (ancestor && ancestor !== containerEl) {
      if (ancestor.tagName === "DETAILS" && !(ancestor as HTMLDetailsElement).open) {
        (ancestor as HTMLDetailsElement).open = true;
      }
      ancestor = ancestor.parentElement;
    }

    // If the target itself is a collapsed <details>, open it
    if (el.tagName === "DETAILS" && !(el as HTMLDetailsElement).open) {
      (el as HTMLDetailsElement).open = true;
      requestAnimationFrame(() => doScroll(el));
    } else if (el.closest("details:not([open])")) {
      // An ancestor was just opened — wait for layout
      requestAnimationFrame(() => doScroll(el));
    } else {
      doScroll(el);
    }
  }

  /** Measure any sticky header(s) above the form that eat into scroll space */
  function getStickyOffset(): number {
    if (!containerEl) return 0;
    // Find the SectionPanel ancestor and measure its sticky header button
    const panel = containerEl.closest("[data-section-panel]");
    if (!panel) return 0;
    const header = panel.querySelector(":scope > button");
    return header ? header.getBoundingClientRect().height : 0;
  }

  function doScroll(el: HTMLElement) {
    const scrollParent = containerEl ? findScrollParent(containerEl) : null;
    if (!scrollParent) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const offset = getStickyOffset() + 8;
    const elRect = el.getBoundingClientRect();
    const parentRect = scrollParent.getBoundingClientRect();
    const targetScroll = scrollParent.scrollTop + (elRect.top - parentRect.top) - offset;
    scrollParent.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
  }
</script>

{#if showNav}
  <nav class="form-nav" aria-label="Form sections">
    <ul class="form-nav-list">
      {#each sections as section (section.id)}
        {@const count = errorCounts[section.id] ?? 0}
        <li>
          <button
            type="button"
            class="form-nav-item"
            class:active={activeSection === section.id || (section.children?.some(c => c.id === activeSection) ?? false)}
            onclick={() => scrollToSection(section.id)}
          >
            <span class="form-nav-label">{section.label}</span>
            {#if count > 0}
              <span class="form-nav-badge" aria-label="{count} errors">
                <AlertTriangle size={10} />
                {count}
              </span>
            {/if}
          </button>
          {#if section.children?.length}
            <ul class="form-nav-children">
              {#each section.children as child (child.id)}
                <li>
                  <button
                    type="button"
                    class="form-nav-item form-nav-child"
                    class:active={activeSection === child.id}
                    onclick={() => scrollToSection(child.id)}
                  >
                    <span class="form-nav-label">{child.label}</span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  </nav>
{/if}

<style>
  .form-nav {
    position: sticky;
    top: 3.75rem;
    align-self: flex-start;
    width: 150px;
    min-width: 140px;
    max-width: 160px;
    max-height: calc(100vh - 2.75rem);
    overflow-y: auto;
    padding: 0.5rem 0;
    background: var(--th-bg-850, var(--th-bg-800));
    border-right: 1px solid var(--th-border-700);
    border-radius: 0.375rem;
    flex-shrink: 0;
    transition: width 0.2s ease, min-width 0.2s ease, max-width 0.2s ease,
      padding 0.2s ease, border-radius 0.2s ease;
  }

  .form-nav-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
    transition: flex-direction 0.2s ease, gap 0.2s ease;
  }

  .form-nav-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
    width: 100%;
    padding: 0.375rem 0.625rem;
    border: none;
    border-left: 3px solid transparent;
    background: none;
    color: var(--th-text-500);
    font-size: 0.6875rem;
    line-height: 1.3;
    text-align: left;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s,
      padding 0.15s, border-radius 0.15s, font-size 0.15s;
  }

  .form-nav-item:hover {
    color: var(--th-text-300);
  }

  .form-nav-item.active {
    border-left-color: var(--th-text-sky-400);
    color: var(--th-text-100);
    font-weight: 600;
  }

  .form-nav-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .form-nav-badge {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    padding: 0 0.25rem;
    border-radius: 9999px;
    background: var(--th-text-red-400);
    color: #fff;
    font-size: 0.5625rem;
    font-weight: 700;
    line-height: 1.125rem;
  }

  .form-nav-children {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .form-nav-child {
    padding-left: 1rem;
    font-size: 0.625rem;
    color: var(--th-text-600);
  }

  .form-nav-child:hover {
    color: var(--th-text-400);
  }

  .form-nav-child.active {
    color: var(--th-text-200);
  }
</style>
