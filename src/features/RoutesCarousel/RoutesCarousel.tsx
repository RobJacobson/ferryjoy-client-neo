/**
 * RoutesCarousel – FlatList-based carousel of terminal route cards.
 * Uses Animated.FlatList + Reanimated with a normalized value in [-1, 0, 1] for parallax.
 */

import type { RefObject } from "react";
import { useRef } from "react";
import { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  type ScrollEvent,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import type { TerminalCardData } from "@/data/terminalConnections";
import {
  TERMINAL_CONNECTIONS,
  transformConnectionsToTerminalCards,
} from "@/data/terminalConnections";
import { CAROUSEL_Z_INDEX } from "@/features/RoutesCarousel/config";
import { RouteCard } from "@/features/RoutesCarousel/RouteCard";
import { RoutesCarouselItem } from "@/features/RoutesCarousel/RoutesCarouselItem";

// ============================================================================
// Types
// ============================================================================

type RoutesCarouselProps = {
  /**
   * Ref to BlurTargetView that BlurViews in each RouteCard will use as blur source.
   */
  blurTargetRef: RefObject<View | null>;
  /**
   * Shared scroll offset (x). Updated by carousel onScroll; used for card and background parallax.
   */
  scrollX: SharedValue<number>;
  /**
   * Width of one carousel slot (e.g. from useCarouselLayout).
   */
  slotWidth: number;
  /**
   * Viewport width; when larger than slotWidth (e.g. landscape), used to center the active card.
   */
  viewportWidth: number;
};

// ============================================================================
// RoutesCarousel
// ============================================================================

/**
 * FlatList-based carousel that displays terminal cards. Uses native scroll and
 * a normalized value in [-1, 0, 1] for parallax (scale + translateX + zIndex).
 *
 * @param props - blurTargetRef, scrollX, slotWidth
 */
const RoutesCarousel = ({
  blurTargetRef,
  scrollX,
  slotWidth,
  viewportWidth,
}: RoutesCarouselProps) => {
  const listRef = useRef<Animated.FlatList<TerminalCardData>>(null);

  const terminalCards =
    transformConnectionsToTerminalCards(TERMINAL_CONNECTIONS);

  // When viewport is wider than slot (e.g. landscape), pad so the active card centers.
  const horizontalPadding =
    viewportWidth > slotWidth ? (viewportWidth - slotWidth) / 2 : 0;

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event: ScrollEvent) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const getItemLayout = (
    _data: ArrayLike<TerminalCardData> | null | undefined,
    index: number
  ) => ({
    length: slotWidth,
    offset: horizontalPadding + index * slotWidth,
    index,
  });

  return (
    <View
      className="w-full flex-1 items-center"
      style={{ zIndex: CAROUSEL_Z_INDEX }}
    >
      <Animated.FlatList<TerminalCardData>
        ref={listRef}
        data={terminalCards}
        horizontal
        contentContainerStyle={{
          minHeight: "100%",
          paddingHorizontal: horizontalPadding,
        }}
        showsHorizontalScrollIndicator={false}
        snapToInterval={slotWidth}
        snapToAlignment="start"
        decelerationRate={0.994}
        bounces={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        getItemLayout={getItemLayout}
        keyExtractor={(item) => item.terminalSlug}
        initialNumToRender={3}
        maxToRenderPerBatch={2}
        windowSize={5}
        removeClippedSubviews={true}
        accessibilityRole="list"
        accessibilityLabel="Terminal routes"
        renderItem={({ item, index }) => (
          <RoutesCarouselItem
            index={index}
            scrollX={scrollX}
            slotWidth={slotWidth}
            accessibilityLabel={item.terminalName}
          >
            <RouteCard
              blurTargetRef={blurTargetRef}
              terminalName={item.terminalName}
              terminalSlug={item.terminalSlug}
              destinations={item.destinations}
            />
          </RoutesCarouselItem>
        )}
      />
    </View>
  );
};

export default RoutesCarousel;
