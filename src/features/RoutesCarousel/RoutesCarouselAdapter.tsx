/**
 * RoutesCarouselAdapter – Adapts RoutesCarousel API to AnimatedList.
 * Handles data transformation, layout conversion, and rendering logic
 * for the domain-specific RoutesCarousel on top of generic AnimatedList.
 */

import type { RefObject } from "react";
import type { ViewStyle } from "react-native";
import { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import type { TerminalCardData } from "@/data/terminalConnections";
import { AnimatedList } from "@/features/AnimatedList";
import { RouteCard } from "@/features/RoutesCarousel/RouteCard";
import { routesCarouselAnimation } from "@/features/RoutesCarousel/routesCarouselAnimation";
import type { RoutesCarouselRef } from "@/features/RoutesCarousel/types";
import type { CarouselLayout } from "@/features/RoutesCarousel/useCarouselLayout";

/**
 * Combined carousel item type that includes both placeholder and actual cards.
 * Used internally by the adapter to manage the complete carousel data.
 */
type CarouselItem =
  | { isPlaceholder: true; width: number; height: number }
  | { isPlaceholder: false; data: TerminalCardData };

type RoutesCarouselAdapterProps = {
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
 * Adapts RoutesCarousel props to AnimatedList implementation.
 * Handles domain-specific concerns like placeholder items, blur references,
 * and RouteCard rendering while delegating scroll behavior to AnimatedList.
 *
 * @param ref - Ref for imperative scrollToIndex control
 * @param blurTargetRef - Ref to BlurTargetView for glassmorphism effect
 * @param scrollX - Shared scroll offset in pixels for parallax
 * @param layout - Layout dimensions from useCarouselLayout
 * @param terminalCards - Terminal cards to render
 */
const RoutesCarouselAdapter = ({
  ref,
  blurTargetRef,
  scrollX,
  layout,
  terminalCards,
}: RoutesCarouselAdapterProps) => {
  const { slotWidth, slotHeight, spacing } = layout;

  /**
   * Transform CarouselLayout to AnimatedListLayout.
   * AnimatedList uses simple dimension + spacing model.
   */
  const animatedListLayout = {
    direction: "horizontal" as const,
    itemSize: slotWidth,
    spacing,
  };

  /**
   * Combine placeholder with terminal cards into single data array.
   * Placeholder is always first item (index 0).
   */
  const carouselData: CarouselItem[] = [
    { isPlaceholder: true, width: slotWidth, height: slotHeight },
    ...terminalCards.map(
      (card): CarouselItem => ({ isPlaceholder: false, data: card }),
    ),
  ];

  /**
   * Render individual carousel items.
   * Handles both invisible placeholder and actual RouteCards.
   */
  const renderItem = (item: CarouselItem): React.ReactNode => {
    if (item.isPlaceholder) {
      // Render invisible placeholder for visual alignment
      return (
        <View
          style={[
            { width: slotWidth, height: slotHeight },
            { opacity: 0, pointerEvents: "none" } as ViewStyle,
          ]}
        />
      );
    }

    // Render RouteCard with blur target and data
    return (
      <RouteCard
        blurTargetRef={blurTargetRef}
        terminalName={item.data.terminalName}
        terminalSlug={item.data.terminalSlug}
        destinations={item.data.destinations}
        width={slotWidth}
        height={slotHeight}
      />
    );
  };

  /**
   * Extract unique keys for carousel items.
   * Placeholder uses fixed key; cards use terminalSlug.
   */
  const keyExtractor = (item: CarouselItem): string => {
    return item.isPlaceholder ? "__placeholder__" : item.data.terminalSlug;
  };

  return (
    <View className="relative flex-1 items-center justify-center">
      <AnimatedList
        ref={ref}
        data={carouselData}
        renderItem={renderItem}
        layout={animatedListLayout}
        itemAnimationStyle={routesCarouselAnimation}
        scrollOffset={scrollX}
        keyExtractor={keyExtractor}
      />
    </View>
  );
};

export default RoutesCarouselAdapter;
