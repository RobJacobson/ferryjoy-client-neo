/**
 * RoutesCarousel – Carousel of terminal RouteCards using AnimatedList.
 * Owns carousel state, layout, and scroll progress. Composes AnimatedList
 * and TerminalCarouselNav.
 */

import type { RefObject } from "react";
import { useRef, useState } from "react";
import type { View } from "react-native";
import { useWindowDimensions } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { useAnimatedReaction, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { TerminalCardData } from "@/data/terminalConnections";
import {
  TERMINAL_CONNECTIONS,
  transformConnectionsToTerminalCards,
} from "@/data/terminalConnections";
import { AnimatedList } from "@/features/AnimatedList";
import { RouteCard } from "@/features/RoutesCarousel/RouteCard";
import { routesCarouselAnimation } from "@/features/RoutesCarousel/routesCarouselAnimation";
import { TerminalCarouselNav } from "@/features/RoutesCarousel/TerminalCarouselNav";
import type { RoutesCarouselRef } from "@/features/RoutesCarousel/types";

/** Horizontal spacing between carousel items */
const SPACING = 12;
/** Portrait aspect ratio for RouteCards (8:16) */
const PORTRAIT_ASPECT_RATIO = 8 / 16;
/** Fraction of viewport used for max card dimensions */
const VIEWPORT_FRACTION = 0.9;

type RoutesCarouselProps = {
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
 * Composes AnimatedList and TerminalCarouselNav. Owns scrollX, layout,
 * currentIndex. Updates scrollProgress when carousel scrolls.
 *
 * @param scrollProgress - Shared scroll progress (0 = first item, 1 = last item)
 * @param blurTargetRef - Ref to BlurTargetView for glassmorphism effect
 */
const RoutesCarousel = ({
  scrollProgress,
  blurTargetRef,
}: RoutesCarouselProps) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const scrollX = useSharedValue(0);
  const carouselRef = useRef<RoutesCarouselRef>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const terminalCards =
    transformConnectionsToTerminalCards(TERMINAL_CONNECTIONS);
  const totalCount = terminalCards.length + 1;

  const itemSize = Math.min(
    windowWidth * VIEWPORT_FRACTION,
    windowHeight * VIEWPORT_FRACTION * PORTRAIT_ASPECT_RATIO,
  );

  const layout = {
    direction: "horizontal" as const,
    itemSize,
    spacing: SPACING,
  };

  const placeholderCard: TerminalCardData & { isPlaceholder: boolean } = {
    terminalId: 0,
    terminalName: "placeholder",
    terminalSlug: "placeholder",
    destinations: [],
    isPlaceholder: true,
  };

  const carouselData: Array<TerminalCardData & { isPlaceholder?: boolean }> = [
    placeholderCard,
    ...terminalCards,
  ];

  const renderItem = (
    item: TerminalCardData & { isPlaceholder?: boolean },
  ): React.ReactNode => {
    return <RouteCard blurTargetRef={blurTargetRef} data={item} />;
  };

  const keyExtractor = (
    item: TerminalCardData & { isPlaceholder?: boolean },
  ): string => {
    return item.isPlaceholder ? "placeholder" : item.terminalSlug;
  };

  useAnimatedReaction(
    () => scrollX.value,
    (offset) => {
      const maxScroll = Math.max((totalCount - 1) * (itemSize + SPACING), 1);
      scrollProgress.value = Math.min(1, Math.max(0, offset / maxScroll));
    },
    [itemSize, totalCount],
  );

  useAnimatedReaction(
    () => scrollX.value,
    (offset) => {
      if (itemSize + SPACING <= 0) return;
      const idx = Math.round(offset / (itemSize + SPACING));
      const clamped = Math.max(0, Math.min(idx, totalCount - 1));
      scheduleOnRN(setCurrentIndex, clamped);
    },
    [itemSize, totalCount],
  );

  return (
    <>
      <AnimatedList
        ref={carouselRef}
        data={carouselData}
        renderItem={renderItem}
        layout={layout}
        itemAnimationStyle={routesCarouselAnimation}
        scrollOffset={scrollX}
        keyExtractor={keyExtractor}
      />
      <TerminalCarouselNav
        carouselRef={carouselRef}
        currentIndex={currentIndex}
        totalCount={totalCount}
      />
    </>
  );
};

export default RoutesCarousel;
