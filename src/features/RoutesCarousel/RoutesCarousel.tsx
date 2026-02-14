/**
 * RoutesCarousel – FlatList-based carousel of terminal route cards.
 * Uses Animated.FlatList + Reanimated with a normalized value in [-1, 0, 1] for parallax.
 */

import type { RefObject } from "react";
import { useRef } from "react";
import { View } from "react-native";
import Animated, {
  type ScrollEvent,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import type { TerminalCardData } from "@/data/terminalConnections";
import {
  TERMINAL_CONNECTIONS,
  transformConnectionsToTerminalCards,
} from "@/data/terminalConnections";
import {
  CAROUSEL_Z_INDEX,
  useCarouselLayout,
} from "@/features/RoutesCarousel/config";
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
};

// ============================================================================
// RoutesCarousel
// ============================================================================

/**
 * FlatList-based carousel that displays terminal cards. Uses native scroll and
 * a normalized value in [-1, 0, 1] for parallax (scale + translateX + zIndex).
 *
 * @param props - blurTargetRef
 */
const RoutesCarousel = ({ blurTargetRef }: RoutesCarouselProps) => {
  const { slotWidth } = useCarouselLayout();
  const scrollX = useSharedValue(0);
  const listRef = useRef<Animated.FlatList<TerminalCardData>>(null);

  const terminalCards =
    transformConnectionsToTerminalCards(TERMINAL_CONNECTIONS);

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
    offset: index * slotWidth,
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
        contentContainerStyle={{ minHeight: "100%" }}
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
