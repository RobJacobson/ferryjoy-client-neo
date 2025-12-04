/**
 * Clamp a value between minimum and maximum bounds
 *
 * @param value - The value to clamp
 * @param min - The minimum allowed value
 * @param max - The maximum allowed value
 * @returns The clamped value, guaranteed to be between min and max (inclusive)
 *
 * @example
 * ```typescript
 * clamp(5, 0, 10);   // returns 5
 * clamp(-5, 0, 10);  // returns 0
 * clamp(15, 0, 10);  // returns 10
 * ```
 */
export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));
