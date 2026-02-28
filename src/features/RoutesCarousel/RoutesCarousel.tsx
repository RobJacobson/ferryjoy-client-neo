/**
 * RoutesCarousel – Terminal carousel with scroll animations and glassmorphism.
 *
 * Requires BlurTargetView ref for glassmorphism effects.
 * Exposes scroll progress (0-1) for parallax backgrounds.
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

// Carousel layout constants
const SPACING = 12;
const CARD_ASPECT_RATIO = 1 / 2;
const VIEWPORT_FRACTION = 0.9;

type RoutesCarouselProps = {
  scrollProgress: SharedValue<number>;
  blurTargetRef: RefObject<View | null>;
};

/**
 * Main RoutesCarousel component.
 *
 * Orchestrates terminal carousel UI by composing AnimatedList and TerminalCarouselNav.
 * Handles layout calculations, data preparation, and scroll progress tracking.
 *
 * @param scrollProgress - Shared scroll progress (0 = first item, 1 = last item)
 * @param blurTargetRef - Ref to BlurTargetView for glassmorphism effect
 */
const RoutesCarousel = ({
  scrollProgress,
  blurTargetRef,
}: RoutesCarouselProps) => {
  // Responsive card sizing based on viewport
  const { height: windowHeight } = useWindowDimensions();
  const carouselRef = useRef<RoutesCarouselRef>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Prepare carousel data with placeholder first item
  const terminalCards =
    transformConnectionsToTerminalCards(TERMINAL_CONNECTIONS);
  const totalCount = terminalCards.length + 1;
  const cardHeight = windowHeight * VIEWPORT_FRACTION;
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

  // Render each carousel item as a RouteCard with explicit dimensions
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

  // Extract stable key for React reconciliation
  const keyExtractor = (
    item: TerminalCardData & { isPlaceholder?: boolean }
  ): string => {
    return item.isPlaceholder ? "placeholder" : item.terminalSlug;
  };

  // Update scroll progress and navigation state on scroll end
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
