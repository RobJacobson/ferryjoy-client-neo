/**
 * RoutesCarouselSection – Composes carousel + nav; owns carousel state;
 * updates scrollProgress for the parent (Background parallax).
 */

import type { RefObject } from "react";
import { useRef, useState } from "react";
import type { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { useAnimatedReaction, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import {
  TERMINAL_CONNECTIONS,
  transformConnectionsToTerminalCards,
} from "@/data/terminalConnections";
import RoutesCarousel from "@/features/RoutesCarousel/RoutesCarousel";
import { TerminalCarouselNav } from "@/features/RoutesCarousel/TerminalCarouselNav";
import type { RoutesCarouselRef } from "@/features/RoutesCarousel/types";
import useCarouselLayout from "@/features/RoutesCarousel/useCarouselLayout";

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

/**
 * Composes RoutesCarousel and TerminalCarouselNav. Owns scrollX, layout,
 * currentIndex. Updates scrollProgress when carousel scrolls.
 *
 * @param scrollProgress - Shared scroll progress (0 = first item, 1 = last item)
 * @param blurTargetRef - Ref to BlurTargetView for glassmorphism effect
 */
export const RoutesCarouselSection = ({
  scrollProgress,
  blurTargetRef,
}: RoutesCarouselSectionProps) => {
  const layout = useCarouselLayout();
  const scrollX = useSharedValue(0);
  const carouselRef = useRef<RoutesCarouselRef>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const terminalCards =
    transformConnectionsToTerminalCards(TERMINAL_CONNECTIONS);
  const totalCount = terminalCards.length + 1;

  useAnimatedReaction(
    () => scrollX.value,
    (offset) => {
      const maxScroll = Math.max((totalCount - 1) * layout.snapInterval, 1);
      scrollProgress.value = Math.min(1, Math.max(0, offset / maxScroll));
    },
    [layout.snapInterval, totalCount]
  );

  useAnimatedReaction(
    () => scrollX.value,
    (offset) => {
      if (layout.snapInterval <= 0) return;
      const idx = Math.round(offset / layout.snapInterval);
      const clamped = Math.max(0, Math.min(idx, totalCount - 1));
      scheduleOnRN(setCurrentIndex, clamped);
    },
    [layout.snapInterval, totalCount]
  );

  return (
    <>
      <RoutesCarousel
        ref={carouselRef}
        blurTargetRef={blurTargetRef}
        scrollX={scrollX}
        layout={layout}
        terminalCards={terminalCards}
      />
      <TerminalCarouselNav
        carouselRef={carouselRef}
        currentIndex={currentIndex}
        totalCount={totalCount}
      />
    </>
  );
};
