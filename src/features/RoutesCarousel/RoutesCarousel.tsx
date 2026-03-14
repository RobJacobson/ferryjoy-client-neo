/**
 * RoutesCarousel – Terminal carousel with scroll animations and glassmorphism.
 *
 * Requires BlurTargetView ref for glassmorphism effects.
 * Exposes scroll progress (0-1) for parallax backgrounds through the ref.
 */

import type { ComponentRef, RefObject } from "react";
import { useState } from "react";
import type { SharedValue } from "react-native-reanimated";
import type { TerminalMate } from "ws-dottie/wsf-schedule";
import type { View } from "@/components/ui";
import type { TerminalCardData } from "@/data/terminalConnections";
import {
  TERMINAL_CONNECTIONS,
  transformConnectionsToTerminalCards,
} from "@/data/terminalConnections";
import { AnimatedList } from "@/features/AnimatedList";
import { RouteCard } from "@/features/RoutesCarousel/RouteCard";
import { RoutesCarouselLayout } from "@/features/RoutesCarousel/RoutesCarouselLayout";
import { routesCarouselAnimation } from "@/features/RoutesCarousel/routesCarouselAnimation";
import { TerminalCarouselNav } from "@/features/RoutesCarousel/TerminalCarouselNav";
import type { RoutesCarouselRef } from "@/features/RoutesCarousel/types";
import { useCardDimensions } from "@/features/RoutesCarousel/useCardDimensions";

type RoutesCarouselProps = {
  ref: React.Ref<RoutesCarouselRef>;
  blurTargetRef: RefObject<ComponentRef<typeof View> | null>;
  /** Sink SharedValue for scroll progress (0-1); AnimatedList writes here. */
  scrollProgressSink?: SharedValue<number>;
};

/**
 * Main RoutesCarousel component.
 *
 * Orchestrates terminal carousel UI by composing AnimatedList and TerminalCarouselNav.
 * Handles state management and component coordination. Pass scrollProgressSink
 * for parallax backgrounds (AnimatedList writes scroll progress there).
 *
 * @param ref - Ref to AnimatedList for programmatic scrolling (React 19 usage)
 * @param blurTargetRef - Ref to BlurTargetView for glassmorphism effect
 * @param scrollProgressSink - Sink SharedValue for scroll progress (0-1)
 */
const RoutesCarousel = ({
  ref: carouselRef,
  blurTargetRef,
  scrollProgressSink,
}: RoutesCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const { cardWidth, cardHeight, layout } = useCardDimensions();

  const carouselData = prepareCarouselData(TERMINAL_CONNECTIONS);
  const totalCount = carouselData.length;

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

  // Update navigation state on scroll end
  const handleScrollEnd = (activeIndex: number) => {
    setCurrentIndex(activeIndex);
  };

  return (
    <RoutesCarouselLayout cardHeight={cardHeight}>
      <AnimatedList
        ref={carouselRef}
        data={carouselData}
        renderItem={renderItem}
        layout={layout}
        itemAnimationStyle={routesCarouselAnimation}
        scrollProgressSink={scrollProgressSink}
        onScrollEnd={handleScrollEnd}
        keyExtractor={keyExtractor}
      />
      <TerminalCarouselNav
        carouselRef={carouselRef as React.RefObject<RoutesCarouselRef>}
        currentIndex={currentIndex}
        totalCount={totalCount}
      />
    </RoutesCarouselLayout>
  );
};

/**
 * Prepares carousel data by transforming terminal connections and adding a placeholder card.
 *
 * Creates a placeholder card as the first item to enable smooth scroll animations,
 * then appends the actual terminal card data.
 *
 * @param connections - Record mapping terminal IDs to their mate connections
 * @returns Array with placeholder card followed by all terminal cards
 */
const prepareCarouselData = (
  connections: Record<number, TerminalMate[]>
): Array<TerminalCardData & { isPlaceholder?: boolean }> => {
  const terminalCards = transformConnectionsToTerminalCards(connections);

  const placeholderCard: TerminalCardData & { isPlaceholder: boolean } = {
    terminalId: 0,
    terminalName: "placeholder",
    terminalSlug: "placeholder",
    destinations: [],
    isPlaceholder: true,
  };

  return [placeholderCard, ...terminalCards];
};

export default RoutesCarousel;
