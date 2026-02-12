/**
 * Animation worklet and hook for the routes carousel.
 * Uses normalized position [-1, 0, 1] for parallax transform and zIndex.
 */

import type { SharedValue } from "react-native-reanimated";
import {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import {
  PARALLAX_OFFSET,
  SCALE_CENTER,
  SCALE_SIDES,
} from "@/features/RoutesCarousel/config";

// ============================================================================
// useCarouselItemAnimatedStyle
// ============================================================================

/**
 * Returns animated style for a carousel item from scroll position.
 * Normalizes scroll to [-1, 0, 1] and delegates to getAnimatedStyles.
 *
 * @param index - Item index in the list
 * @param scrollX - Shared scroll offset (x)
 * @param slotWidth - Width of one carousel slot
 * @returns Reanimated animated style (transform + zIndex)
 */
const useCarouselItemAnimatedStyle = (
  index: number,
  scrollX: SharedValue<number>,
  slotWidth: number
) => {
  return useAnimatedStyle(() => {
    const value = index - scrollX.value / slotWidth;
    return getAnimatedStyles(value, slotWidth, PARALLAX_OFFSET, SCALE_CENTER);
  });
};

// ============================================================================
// getAnimatedStyles (Reanimated worklet)
// ============================================================================

/**
 * Calculates animated style for carousel item based on normalized position.
 * Returns transform (translateX, scale, rotate) and zIndex for parallax effect.
 *
 * @param value - Normalized position in [-1, 0, 1] where 0 is centered
 * @param slotWidth - Width of carousel slot, used for translateX extent and zIndex
 * @param parallaxOffset - Horizontal offset for parallax inset
 * @param scaleCenter - Scale value when item is centered (value === 0)
 * @returns Style object with transform and zIndex
 */
const getAnimatedStyles = (
  value: number,
  slotWidth: number,
  parallaxOffset: number,
  scaleCenter: number
) => {
  "worklet";
  const translateX = interpolate(
    value,
    [-1, 0, 1],
    [-slotWidth + parallaxOffset, 0, slotWidth - parallaxOffset]
  );
  const rotate = interpolate(value, [-1, 0, 1], [-20, 0, 20]);
  const zIndex = Math.round(
    interpolate(value, [-1, 0, 1], [0, slotWidth, 0], Extrapolation.CLAMP)
  );
  const scale = interpolate(
    value,
    [-1, 0, 1],
    [SCALE_SIDES, scaleCenter, SCALE_SIDES]
  );
  return {
    transform: [{ translateX }, { scale }, { rotate: `${rotate}deg` }],
    zIndex,
  };
};

export { useCarouselItemAnimatedStyle };
