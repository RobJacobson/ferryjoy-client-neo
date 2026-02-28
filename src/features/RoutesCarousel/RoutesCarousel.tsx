/**
 * RoutesCarousel – Carousel of terminal RouteCards using AnimatedList.
 * Delegates to RoutesCarouselAdapter for scroll-driven animations.
 * Parallax background (BlurTargetView + Background) is rendered behind in parent.
 */

import type { RefObject } from "react";
import type { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import type { TerminalCardData } from "@/data/terminalConnections";
import RoutesCarouselAdapter from "@/features/RoutesCarousel/RoutesCarouselAdapter";
import type { RoutesCarouselRef } from "@/features/RoutesCarousel/types";
import type { CarouselLayout } from "@/features/RoutesCarousel/useCarouselLayout";

type RoutesCarouselProps = {
  /**
   * Ref for imperative scrollToIndex control.
   * Parent components can use this to programmatically scroll the carousel.
   */
  ref?: React.Ref<RoutesCarouselRef>;
  /**
   * Ref to BlurTargetView; passed to RouteCards for BlurView.
   * Required for glassmorphism effects on RouteCards.
   */
  blurTargetRef: RefObject<View | null>;
  /**
   * Shared scroll offset (x) in pixels; used for Background parallax.
   * This value drives the parallax animation of background layers.
   */
  scrollX: SharedValue<number>;
  /**
   * Layout dimensions from useCarouselLayout (slot size, snap interval, padding).
   */
  layout: CarouselLayout;
  /**
   * Terminal cards to render in the carousel.
   */
  terminalCards: TerminalCardData[];
};

/**
 * Renders a carousel of terminal RouteCards with scroll-driven animations.
 * Uses AnimatedList internally via RoutesCarouselAdapter for generic
 * scroll behavior and domain-specific animations.
 *
 * @param ref - Ref for imperative scrollToIndex control
 * @param blurTargetRef - Ref to BlurTargetView for glassmorphism effect
 * @param scrollX - Shared scroll offset in pixels for parallax
 * @param layout - Layout dimensions from useCarouselLayout
 * @param terminalCards - Terminal cards to render
 */
const RoutesCarousel = ({
  ref,
  blurTargetRef,
  scrollX,
  layout,
  terminalCards,
}: RoutesCarouselProps) => {
  return (
    <RoutesCarouselAdapter
      ref={ref}
      blurTargetRef={blurTargetRef}
      scrollX={scrollX}
      layout={layout}
      terminalCards={terminalCards}
    />
  );
};

export default RoutesCarousel;
export type { RoutesCarouselRef } from "./types";
