/**
 * RoutesCarouselSection – Composes carousel + nav; owns carousel state;
 * updates scrollProgress for the parent (Background parallax).
 */

import type { RefObject } from "react";
import { useCallback, useRef, useState } from "react";
import type { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { useAnimatedReaction, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { TOTAL_CAROUSEL_ITEMS } from "@/data/terminalConnections";
import RoutesCarousel, {
  type RoutesCarouselRef,
} from "@/features/RoutesCarousel/RoutesCarousel";
import { TerminalCarouselNav } from "@/features/RoutesCarousel/TerminalCarouselNav";

// ============================================================================
// Types
// ============================================================================

// ============================================================================
// Types
// ============================================================================

type RoutesCarouselSectionProps = {
  /**
   * Shared scroll progress (0 = first item, 1 = last).
   * Updated when carousel scrolls; used by Background for parallax animation.
   */
  scrollProgress: SharedValue<number>;
  /**
   * Ref to BlurTargetView; passed to RouteCards for BlurView.
   * Required for glassmorphism effects on RouteCards.
   */
  blurTargetRef: RefObject<View | null>;
};

// ============================================================================
// RoutesCarouselSection
// ============================================================================

/**
 * Composes RoutesCarousel and TerminalCarouselNav. Owns scrollX, snapInterval,
 * currentIndex. Updates scrollProgress when carousel scrolls.
 *
 * @param scrollProgress - Shared scroll progress (0 = first item, 1 = last item)
 * @param blurTargetRef - Ref to BlurTargetView for glassmorphism effect
 */
export const RoutesCarouselSection = ({
  scrollProgress,
  blurTargetRef,
}: RoutesCarouselSectionProps) => {
  const scrollX = useSharedValue(0);
  const carouselRef = useRef<RoutesCarouselRef>(null);
  const [snapInterval, setSnapInterval] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleSlotWidthChange = useCallback((interval: number) => {
    setSnapInterval(interval);
  }, []);

  // Update scrollProgress for background parallax when carousel scrolls
  useAnimatedReaction(
    () => scrollX.value,
    (offset) => {
      const maxScroll = Math.max((TOTAL_CAROUSEL_ITEMS - 1) * snapInterval, 1);
      scrollProgress.value = Math.min(1, Math.max(0, offset / maxScroll));
    },
    [snapInterval]
  );

  // Update currentIndex for nav button visibility when carousel scrolls
  useAnimatedReaction(
    () => scrollX.value,
    (offset) => {
      if (snapInterval <= 0) return;
      const idx = Math.round(offset / snapInterval);
      const clamped = Math.max(0, Math.min(idx, TOTAL_CAROUSEL_ITEMS - 1));
      scheduleOnRN(setCurrentIndex, clamped);
    },
    [snapInterval]
  );

  return (
    <>
      <RoutesCarousel
        ref={carouselRef}
        blurTargetRef={blurTargetRef}
        scrollX={scrollX}
        onSlotWidthChange={handleSlotWidthChange}
      />
      <TerminalCarouselNav
        carouselRef={carouselRef}
        currentIndex={currentIndex}
        totalCount={TOTAL_CAROUSEL_ITEMS}
      />
    </>
  );
};
