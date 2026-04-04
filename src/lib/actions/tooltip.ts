/**
 * Svelte action: styled tooltip replacing native `title` attributes.
 * Usage: <element use:tooltip={"Tooltip text"} />
 *
 * Shows a themed floating tooltip on hover/focus instead of the browser default.
 * Uses mousemove tracking for accurate positioning under CSS zoom.
 */

let activeTooltip: HTMLDivElement | null = null;
let activeNode: HTMLElement | null = null;
let lastMouseX = 0;
let lastMouseY = 0;

function removeActive() {
  if (activeTooltip) {
    activeTooltip.remove();
    activeTooltip = null;
  }
  activeNode = null;
}

// Global mousemove on document to track cursor in viewport coords and detect
// when the cursor leaves an element (covers edge cases where mouseleave
// doesn't fire due to DOM re-renders or zoom mismatches).
document.addEventListener("mousemove", (e: MouseEvent) => {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  if (activeNode && activeTooltip) {
    // Defer check to next frame so the browser has updated :hover state
    requestAnimationFrame(() => {
      if (!activeNode || !activeTooltip) return;
      // Dismiss if the node was removed from the DOM
      if (!activeNode.isConnected) {
        removeActive();
        return;
      }
      // Use the browser's own :hover computation — this correctly accounts
      // for CSS zoom, transforms, and stacking contexts.
      if (!activeNode.matches(":hover")) {
        removeActive();
      }
    });
  }
}, true);

// Dismiss tooltip when mouse leaves the document entirely (e.g. moving
// to the title bar or outside the window in a Tauri app).
document.documentElement.addEventListener("mouseleave", () => {
  if (activeNode) removeActive();
});

// Dismiss tooltip when any ancestor scrolls (the element may move out
// from under the cursor without a mousemove event).
document.addEventListener("scroll", () => {
  if (activeNode) removeActive();
}, true);

// Dismiss tooltip when focus moves elsewhere (e.g., tab key navigation
// or clicking into another element that doesn't trigger mouseleave).
document.addEventListener("focusin", () => {
  if (activeNode) removeActive();
}, true);

function positionTooltip(x: number, y: number) {
  if (!activeTooltip) return;
  const tw = activeTooltip.offsetWidth;
  const th = activeTooltip.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const gap = 12;

  let px = x + gap;
  let py = y + gap;
  if (px + tw > vw - 8) px = x - tw - gap;
  if (py + th > vh - 8) py = y - th - gap;
  if (px < 8) px = 8;
  if (py < 8) py = 8;

  activeTooltip.style.left = `${px}px`;
  activeTooltip.style.top = `${py}px`;
}

function show(text: string, x: number, y: number) {
  removeActive();
  const el = document.createElement("div");
  el.role = "tooltip";
  el.className =
    "max-w-xs px-3 py-2 text-xs leading-relaxed rounded-md shadow-lg " +
    "pointer-events-none whitespace-pre-wrap";
  el.style.cssText =
    "position:fixed;z-index:200;" +
    "background:var(--th-bg-950);color:var(--th-tooltip-text,var(--th-text-100));" +
    "border:1px solid var(--th-border-600);";
  el.textContent = text;
  document.body.appendChild(el);
  activeTooltip = el;

  // Position after layout (need offsetWidth/Height)
  requestAnimationFrame(() => positionTooltip(x, y));
}

export function tooltip(node: HTMLElement, text: string | undefined) {
  if (!text) return;

  // Remove native title if set
  if (node.title) node.title = "";

  const onEnter = (e: MouseEvent) => {
    if (text) show(text, e.clientX, e.clientY);
    activeNode = node;
  };
  const onMove = (e: MouseEvent) => {
    if (activeNode !== node || !activeTooltip) return;
    positionTooltip(e.clientX, e.clientY);
  };
  const onLeave = () => {
    if (activeNode === node) removeActive();
  };
  const onClick = () => {
    // Dismiss tooltip on click (handles toggle buttons that swap DOM nodes)
    if (activeNode === node) removeActive();
  };
  const onFocus = () => {
    const rect = node.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.bottom + 4;
    if (text) show(text, cx, cy);
    activeNode = node;
  };

  node.addEventListener("mouseenter", onEnter);
  node.addEventListener("mousemove", onMove);
  node.addEventListener("mouseleave", onLeave);
  node.addEventListener("click", onClick);
  node.addEventListener("focus", onFocus);
  node.addEventListener("blur", onLeave);

  return {
    update(newText: string | undefined) {
      text = newText;
      // If the tooltip is currently visible for this node, update its text
      if (activeNode === node && activeTooltip) {
        activeTooltip.textContent = newText ?? "";
      }
    },
    destroy() {
      node.removeEventListener("mouseenter", onEnter);
      node.removeEventListener("mousemove", onMove);
      node.removeEventListener("mouseleave", onLeave);
      node.removeEventListener("click", onClick);
      node.removeEventListener("focus", onFocus);
      node.removeEventListener("blur", onLeave);
      if (activeNode === node) removeActive();
    },
  };
}

/**
 * Delayed tooltip that only shows after hovering for a specified duration.
 * Usage: <element use:delayedTooltip={{ text: "...", delay: 1000 }} />
 */
export function delayedTooltip(node: HTMLElement, params: { text: string | undefined; delay?: number } | undefined) {
  if (!params?.text) return;

  let text = params.text;
  let delay = params.delay ?? 1000;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingX = 0;
  let pendingY = 0;

  if (node.title) node.title = "";

  const onEnter = (e: MouseEvent) => {
    pendingX = e.clientX;
    pendingY = e.clientY;
    timer = setTimeout(() => {
      if (text) show(text, pendingX, pendingY);
      activeNode = node;
    }, delay);
  };
  const onMove = (e: MouseEvent) => {
    pendingX = e.clientX;
    pendingY = e.clientY;
    if (activeNode === node && activeTooltip) {
      positionTooltip(e.clientX, e.clientY);
    }
  };
  const onLeave = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (activeNode === node) removeActive();
  };
  const onClick = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (activeNode === node) removeActive();
  };

  node.addEventListener("mouseenter", onEnter);
  node.addEventListener("mousemove", onMove);
  node.addEventListener("mouseleave", onLeave);
  node.addEventListener("click", onClick);

  return {
    update(newParams: { text: string | undefined; delay?: number } | undefined) {
      text = newParams?.text ?? "";
      delay = newParams?.delay ?? 1000;
      if (activeNode === node && activeTooltip) {
        activeTooltip.textContent = text;
      }
    },
    destroy() {
      if (timer) { clearTimeout(timer); timer = null; }
      node.removeEventListener("mouseenter", onEnter);
      node.removeEventListener("mousemove", onMove);
      node.removeEventListener("mouseleave", onLeave);
      node.removeEventListener("click", onClick);
      if (activeNode === node) removeActive();
    },
  };
}
