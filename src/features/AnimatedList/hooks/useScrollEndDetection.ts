/**
 * useScrollEndDetection – Hook for detecting when scroll settles on an index.
 * Provides debounced scroll end callbacks to prevent over-eager triggering.
 */

import { useRef } from "react";
import type { SharedValue } from "react-native-reanimated";
import { useAnimatedReaction } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { SCROLL_SETTLED_TOLERANCE } from "../types";

/**
 * Hook that detects when scroll settles on an index and triggers callback.
 * Debounced to prevent duplicate triggers for the same index.
 *
 * @param scrollIndex - Shared value of normalized scroll position
 * @param onScrollEnd - Optional callback when scroll settles on an index
 * @param tolerance - Tolerance for determining settled state (defaults to SCROLL_SETTLED_TOLERANCE)
 */
export function useScrollEndDetection(
  scrollIndex: SharedValue<number>,
  onScrollEnd: ((index: number) => void) | undefined,
  tolerance = SCROLL_SETTLED_TOLERANCE
): void {
  // Track last triggered index to prevent duplicate callbacks
  const lastTriggeredIndex = useRef<number | null>(null);

  useAnimatedReaction(
    () => {
      if (!onScrollEnd) return null;
      const currentScrollIndex = scrollIndex.value;
      const activeIndex = Math.round(currentScrollIndex);
      const distanceFromIndex = Math.abs(currentScrollIndex - activeIndex);
      const settled = distanceFromIndex < tolerance;
      return settled ? activeIndex : null;
    },
    (activeIndex) => {
      if (activeIndex !== null && onScrollEnd) {
        if (activeIndex !== lastTriggeredIndex.current) {
          lastTriggeredIndex.current = activeIndex;
          scheduleOnRN(onScrollEnd, activeIndex);
        }
      }
    },
    [onScrollEnd, tolerance]
  );
}
