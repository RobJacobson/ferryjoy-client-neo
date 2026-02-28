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
/** Overall card aspect ratio (1:2 - twice as tall as wide) */
const CARD_ASPECT_RATIO = 1 / 2;
/** Fraction of viewport used for card height */
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
  const { height: windowHeight } = useWindowDimensions();

  const carouselRef = useRef<RoutesCarouselRef>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const terminalCards =
    transformConnectionsToTerminalCards(TERMINAL_CONNECTIONS);
  const totalCount = terminalCards.length + 1;

  // Calculate card height as fraction of viewport
  const cardHeight = windowHeight * VIEWPORT_FRACTION;
  // Calculate card width maintaining 1:2 aspect ratio
  const cardWidth = cardHeight * CARD_ASPECT_RATIO;

  const layout = {
    direction: "horizontal" as const,
    itemSize: cardWidth,
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
    item: TerminalCardData & { isPlaceholder?: boolean }
  ): React.ReactNode => {
    return (
      <RouteCard
        blurTargetRef={blurTargetRef}
        data={item}
        width={cardWidth}
        height={cardHeight}
      />
    );
  };

  const keyExtractor = (
    item: TerminalCardData & { isPlaceholder?: boolean }
  ): string => {
    return item.isPlaceholder ? "placeholder" : item.terminalSlug;
  };

  const handleScrollEnd = (activeIndex: number) => {
    setCurrentIndex(activeIndex);
    const progress = Math.min(1, Math.max(0, activeIndex / (totalCount - 1)));
    scrollProgress.value = progress;
  };

  return (
    <>
      <AnimatedList
        ref={carouselRef}
        data={carouselData}
        renderItem={renderItem}
        layout={layout}
        itemAnimationStyle={routesCarouselAnimation}
        onScrollEnd={handleScrollEnd}
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
