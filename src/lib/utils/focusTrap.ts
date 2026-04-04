/**
 * Svelte action that traps keyboard focus within a container element.
 * Saves the previously focused element and restores focus on destroy.
 *
 * Usage: <div use:focusTrap>…</div>
 */
export function focusTrap(node: HTMLElement) {
  const previousFocus = document.activeElement as HTMLElement | null;

  const focusableSelector =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function getFocusable(): HTMLElement[] {
    return [...node.querySelectorAll<HTMLElement>(focusableSelector)];
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key !== "Tab") return;
    const els = getFocusable();
    if (els.length === 0) return;
    const first = els[0];
    const last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  node.addEventListener("keydown", handleKeydown);

  // Focus the first focusable element inside the trap
  requestAnimationFrame(() => {
    const els = getFocusable();
    if (els.length > 0) els[0].focus();
  });

  return {
    destroy() {
      node.removeEventListener("keydown", handleKeydown);
      if (previousFocus && document.body.contains(previousFocus)) {
        previousFocus.focus();
      }
    },
  };
}
