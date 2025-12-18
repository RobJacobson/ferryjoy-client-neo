/**
 * Utility functions for OpacityBlurOverlay component
 */

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Convert hex color to rgba with specified alpha
 */
export function hexToRgba(hex: string, alpha: number): string {
  const a = clamp01(alpha);
  const raw = hex.replace("#", "").trim();
  const normalized =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;

  if (normalized.length !== 6) {
    // Fallback to a readable default.
    return `rgba(255,255,255,${a})`;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  if (![r, g, b].every((v) => Number.isFinite(v))) {
    return `rgba(255,255,255,${a})`;
  }

  return `rgba(${r},${g},${b},${a})`;
}

/**
 * Resolve fallback color for reduced transparency mode
 */
export function resolveReducedTransparencyFallbackColor(
  tintColor: string,
  opacity: number
): string {
  // When "Reduce Transparency" is enabled, we should still show an opaque-enough color.
  // We'll use the same tint but slightly higher alpha so it's still readable.
  return hexToRgba(tintColor, clamp01(Math.max(opacity, 0.85)));
}
