// ============================================================================
// Layer Specification Helpers
// ============================================================================
// Shared utility functions for layer specification generation.
// ============================================================================

import { lerp } from "@/shared/utils";

/**
 * Normalizes an index to a 0-1 range based on count of items.
 * Handles edge case where count is 1 by returning 0.
 *
 * @param index - Current index in the sequence
 * @param count - Total number of items
 * @returns Normalized value between 0 and 1
 */
export const indexToT = (index: number, count: number): number =>
  count > 1 ? index / (count - 1) : 0;

/**
 * Interpolates a value between a minimum and maximum using a normalized value.
 * Simplifies lerp calls by accepting a range object instead of separate min/max.
 *
 * @param t - Normalized value between 0 and 1
 * @param range - Object with min and max values
 * @returns Interpolated value between min and max
 */
export const lerpRange = (
  t: number,
  range: { min: number; max: number }
): number => lerp(t, range.min, range.max);
