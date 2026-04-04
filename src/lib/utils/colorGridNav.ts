export interface GridNavResult {
  handled: boolean;
  newIndex?: number;
  toggleSelection?: boolean;
}

/**
 * Pure-logic keyboard navigation for a 2D color grid.
 * Returns the new active index and whether selection should be toggled.
 *
 * @param key - The keyboard event key
 * @param activeIndex - Current active index (-1 if none)
 * @param totalCount - Total number of items in the grid
 * @param columnCount - Number of columns in the grid
 * @param isVisibleFn - Optional predicate; when provided, navigation skips hidden items
 */
export function gridKeyNav(
  key: string,
  activeIndex: number,
  totalCount: number,
  columnCount: number,
  isVisibleFn?: (index: number) => boolean,
): GridNavResult {
  if (totalCount === 0) return { handled: false };

  switch (key) {
    case "ArrowRight": {
      const next = nextVisibleIndex(activeIndex, 1, totalCount, isVisibleFn);
      return { handled: true, newIndex: next };
    }
    case "ArrowLeft": {
      const next = nextVisibleIndex(activeIndex, -1, totalCount, isVisibleFn);
      return { handled: true, newIndex: next };
    }
    case "ArrowDown": {
      const target = Math.min(activeIndex + columnCount, totalCount - 1);
      const next = nearestVisibleIndex(target, 1, totalCount, isVisibleFn);
      return { handled: true, newIndex: next ?? activeIndex };
    }
    case "ArrowUp": {
      const target = Math.max(activeIndex - columnCount, 0);
      const next = nearestVisibleIndex(target, -1, totalCount, isVisibleFn);
      return { handled: true, newIndex: next ?? activeIndex };
    }
    case "Home": {
      const next = nextVisibleIndex(-1, 1, totalCount, isVisibleFn);
      return { handled: true, newIndex: next };
    }
    case "End": {
      const next = nextVisibleIndex(totalCount, -1, totalCount, isVisibleFn);
      return { handled: true, newIndex: next };
    }
    case " ":
    case "Enter":
      return { handled: true, toggleSelection: true };
    default:
      return { handled: false };
  }
}

/**
 * Find the next visible index in a given direction from `from` (exclusive).
 * Returns `from` if no visible index is found.
 */
export function nextVisibleIndex(
  from: number,
  direction: 1 | -1,
  totalCount: number,
  isVisibleFn?: (index: number) => boolean,
): number {
  let i = from + direction;
  while (i >= 0 && i < totalCount) {
    if (!isVisibleFn || isVisibleFn(i)) return i;
    i += direction;
  }
  return from;
}

/**
 * Find the nearest visible index to `target`, searching in `direction` first,
 * then the opposite direction as a fallback.
 */
function nearestVisibleIndex(
  target: number,
  direction: 1 | -1,
  totalCount: number,
  isVisibleFn?: (index: number) => boolean,
): number | undefined {
  if (!isVisibleFn) return target;

  // Search in primary direction
  let i = target;
  while (i >= 0 && i < totalCount) {
    if (isVisibleFn(i)) return i;
    i += direction;
  }
  // Search in opposite direction
  i = target - direction;
  while (i >= 0 && i < totalCount) {
    if (isVisibleFn(i)) return i;
    i -= direction;
  }
  return undefined;
}
