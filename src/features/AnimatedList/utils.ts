/**
 * AnimatedList utility functions.
 * Provides helper functions for animation calculations.
 */

/**
 * Calculates the distance from the active (centered) index.
 * Helper function for creating distance-based animations.
 *
 * @param index - Index of the item
 * @param scrollIndex - Current scroll position normalized to index
 * @returns Absolute distance from the active card
 */
export const distanceFromIndex = (
  index: number,
  scrollIndex: number
): number => {
  "worklet";
  return Math.abs(scrollIndex - index);
};

/**
 * Determines if an item is currently active (centered in the viewport).
 *
 * @param index - Index of the item
 * @param scrollIndex - Current scroll position normalized to index
 * @returns True if the item is active
 */
export const isItemActive = (index: number, scrollIndex: number): boolean => {
  "worklet";
  return Math.abs(scrollIndex - index) < 0.5;
};
