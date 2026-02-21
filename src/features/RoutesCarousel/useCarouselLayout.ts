/**
 * useCarouselLayout – Computes carousel slot dimensions and layout from viewport.
 * Single source of truth for RoutesCarousel layout constants and calculations.
 */

import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Horizontal spacing between carousel items */
const SPACING = 12;
/** Portrait aspect ratio for RouteCards (8:16) */
const PORTRAIT_ASPECT_RATIO = 8 / 16;
/** Fraction of viewport used for max card dimensions */
const VIEWPORT_FRACTION = 0.9;
/** Vertical padding above/below content (added to safe area insets) */
const BASE_PADDING = 24;

type CarouselLayout = {
  slotWidth: number;
  slotHeight: number;
  snapInterval: number;
  sidePadding: number;
  contentPadding: { paddingTop: number; paddingBottom: number };
  spacing: number;
};

/**
 * Returns layout dimensions for the terminal carousel based on viewport size.
 * Slot dimensions fit within 90% of viewport while maintaining aspect ratio.
 *
 * @returns CarouselLayout with slot dimensions, snap interval, and padding values
 */
const useCarouselLayout = (): CarouselLayout => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const maxW = windowWidth * VIEWPORT_FRACTION;
  const maxH = windowHeight * VIEWPORT_FRACTION;
  const slotWidth = Math.min(maxW, maxH * PORTRAIT_ASPECT_RATIO);
  const slotHeight = Math.min(maxH, maxW / PORTRAIT_ASPECT_RATIO);

  const snapInterval = slotWidth + SPACING;
  const sidePadding = Math.max(0, (windowWidth - slotWidth) / 2);

  return {
    slotWidth,
    slotHeight,
    snapInterval,
    sidePadding,
    contentPadding: {
      paddingTop: BASE_PADDING + insets.top,
      paddingBottom: BASE_PADDING + insets.bottom,
    },
    spacing: SPACING,
  };
};

export default useCarouselLayout;
export type { CarouselLayout };
