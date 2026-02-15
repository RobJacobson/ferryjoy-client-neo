/**
 * Layout and animation configuration for the routes carousel.
 * Slot width from window; height uses flex to fill available space.
 * In landscape, slot width is capped so the next card appears before the current
 * one scrolls off (e.g. on iPad).
 */

import { useWindowDimensions } from "react-native";
import { useIsLandscape } from "@/shared/hooks/useIsLandscape";

// ============================================================================
// Animation constants
// ============================================================================

/** Horizontal offset for parallax so adjacent cards sit slightly inset. */
export const PARALLAX_OFFSET = 200;

/** Max slot width in landscape; prevents one card scrolling off before next appears. */
export const MAX_SLOT_WIDTH_LANDSCAPE = 600;

/** Scale when card is centered. */
export const SCALE_CENTER = 1.0;

/** Scale when card is one slot left or right. */
export const SCALE_SIDES = 0.6;

/** Rotation when card is one slot left or right. */
export const ROTATION_SIDES = 30;

/** z-index so carousel sits above Background wave stack (foreground grass = 100). */
export const CAROUSEL_Z_INDEX = 200;

// ============================================================================
// Layout hook
// ============================================================================

/**
 * Returns carousel slot width and viewport width from window dimensions.
 * In landscape, slot width is capped so the next card appears before the
 * current one scrolls off. Height fills via flex.
 *
 * @returns slotWidth (full width in portrait, capped in landscape), width (viewport)
 */
export const useCarouselLayout = () => {
  const { width } = useWindowDimensions();
  const isLandscape = useIsLandscape();
  const slotWidth = isLandscape
    ? Math.min(width, MAX_SLOT_WIDTH_LANDSCAPE)
    : width;
  return { slotWidth, width };
};
