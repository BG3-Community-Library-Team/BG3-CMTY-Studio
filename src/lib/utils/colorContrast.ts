/**
 * WCAG 2.1 color contrast utilities.
 * Pure functions for computing contrast ratios between hex/rgb/rgba color strings.
 */

/**
 * Parse a hex color string (#RGB, #RRGGBB, or RRGGBB) to [r, g, b] in 0-255 range.
 * Also handles `rgb(r g b)`, `rgb(r, g, b)`, and `rgba(r, g, b, a)` notation
 * (alpha is stripped).
 */
export function parseHexColor(color: string): [number, number, number] {
  const trimmed = color.trim();

  // Handle rgb()/rgba() notation
  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)/,
  );
  if (rgbMatch) {
    return [
      Math.round(Number(rgbMatch[1])),
      Math.round(Number(rgbMatch[2])),
      Math.round(Number(rgbMatch[3])),
    ];
  }

  // Strip leading #
  let hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;

  // Expand 3-digit hex to 6-digit
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  if (hex.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`Cannot parse color value: "${color}"`);
  }

  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

/**
 * Compute relative luminance per WCAG 2.1.
 * Converts sRGB [0-255] channels to linear, then applies luminance formula.
 */
export function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const srgb = c / 255;
    return srgb <= 0.04045
      ? srgb / 12.92
      : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Compute WCAG contrast ratio between two color strings.
 * Accepts #hex, rgb(), and rgba() formats. Returns ratio ≥ 1.0.
 */
export function computeContrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(parseHexColor(fg));
  const l2 = relativeLuminance(parseHexColor(bg));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
