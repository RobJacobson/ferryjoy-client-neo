/**
 * TerminalCarouselNav – Prev/next buttons for terminal carousel navigation.
 * Positioned at 50% vertical height, left and right. Only visible when there
 * is a previous or next terminal to navigate to.
 */

import type { RefObject } from "react";
import { View } from "react-native";
import { CAROUSEL_Z_INDEX } from "@/features/RoutesCarousel/config";
import type { RoutesCarouselRef } from "@/features/RoutesCarousel/RoutesCarousel";
import { TerminalNavButton } from "@/features/RoutesCarousel/TerminalNavButton";

/** Z-index for navigation buttons, ensuring they appear above carousel content */
const NAV_BUTTON_Z_INDEX = CAROUSEL_Z_INDEX + 10;

// ============================================================================
// Types
// ============================================================================

type TerminalCarouselNavProps = {
  /** Ref to the carousel for imperative scrollToIndex. */
  carouselRef: RefObject<RoutesCarouselRef | null>;
  /** Current visible carousel index. */
  currentIndex: number;
  /** Total number of carousel items (including placeholder). */
  totalCount: number;
};

// ============================================================================
// TerminalCarouselNav
// ============================================================================

/**
 * Renders prev/next navigation buttons for the terminal carousel.
 * Prev shows when currentIndex > 0; next shows when currentIndex < totalCount - 1.
 *
 * @param carouselRef - Ref to the carousel for imperative scrollToIndex
 * @param currentIndex - Current visible carousel index
 * @param totalCount - Total number of carousel items (including placeholder)
 */
export const TerminalCarouselNav = ({
  carouselRef,
  currentIndex,
  totalCount,
}: TerminalCarouselNavProps) => {
  const showPrev = currentIndex > 0;
  const showNext = currentIndex < totalCount - 1;

  if (!showPrev && !showNext) {
    return null;
  }

  return (
    <>
      {showPrev && (
        <View
          className="absolute top-1/2 left-2 -translate-y-1/2"
          style={{ zIndex: NAV_BUTTON_Z_INDEX }}
        >
          <TerminalNavButton
            direction="prev"
            onPress={() => carouselRef.current?.scrollToIndex(currentIndex - 1)}
            accessibilityLabel="Previous terminal"
          />
        </View>
      )}
      {showNext && (
        <View
          className="absolute top-1/2 right-2 -translate-y-1/2"
          style={{ zIndex: NAV_BUTTON_Z_INDEX }}
        >
          <TerminalNavButton
            direction="next"
            onPress={() => carouselRef.current?.scrollToIndex(currentIndex + 1)}
            accessibilityLabel="Next terminal"
          />
        </View>
      )}
    </>
  );
};
