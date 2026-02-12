/**
 * RoutesCarouselFlatList – FlatList-based carousel drop-in for RoutesCarousel.
 * Uses Animated.FlatList + Reanimated with a normalized value in [-1, 0, 1] for parallax.
 */

import type { RefObject } from "react";
import { useEffect, useRef } from "react";
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
import { TERMINAL_REGIONS, type TerminalRegion } from "@/data/terminalRegions";
import { SLOT_HEIGHT, SLOT_WIDTH } from "@/features/RoutesCarousel/config";
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
   * Selected region filter. When null or "All Terminals", shows all terminals.
   * Otherwise filters to terminals in the selected region.
   */
  selectedRegion?: TerminalRegion | null;
};

// ============================================================================
// RoutesCarouselFlatList
// ============================================================================

/**
 * FlatList-based carousel that displays terminal cards. Drop-in replacement for
 * RoutesCarousel: same props and behavior, using native scroll and a
 * normalized value for parallax (scale + translateX + zIndex).
 *
 * @param props - blurTargetRef and optional selectedRegion
 */
const RoutesCarousel = ({
  blurTargetRef,
  selectedRegion,
}: RoutesCarouselProps) => {
  const scrollX = useSharedValue(0);
  const listRef = useRef<Animated.FlatList<TerminalCardData>>(null);

  let terminalCards = transformConnectionsToTerminalCards(TERMINAL_CONNECTIONS);
  if (selectedRegion && selectedRegion !== "All Terminals") {
    const regionTerminalIds = TERMINAL_REGIONS[selectedRegion];
    terminalCards = terminalCards.filter((card) =>
      regionTerminalIds.includes(card.terminalId),
    );
  }

  useEffect(() => {
    if (listRef.current && terminalCards.length > 0) {
      listRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, [terminalCards.length]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event: ScrollEvent) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const getItemLayout = (
    _data: ArrayLike<TerminalCardData> | null | undefined,
    index: number,
  ) => ({
    length: SLOT_WIDTH,
    offset: index * SLOT_WIDTH,
    index,
  });

  return (
    <View className="w-full flex-1 items-center justify-center">
      <Animated.FlatList<TerminalCardData>
        key={selectedRegion ?? "all"}
        ref={listRef}
        data={terminalCards}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SLOT_WIDTH}
        snapToAlignment="start"
        decelerationRate={0.994}
        bounces={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        getItemLayout={getItemLayout}
        keyExtractor={(item) => item.terminalSlug}
        accessibilityRole="list"
        accessibilityLabel="Terminal routes"
        renderItem={({ item, index }) => (
          <RoutesCarouselItem
            index={index}
            scrollX={scrollX}
            slotWidth={SLOT_WIDTH}
            slotHeight={SLOT_HEIGHT}
            accessibilityLabel={item.terminalName}
          >
            <View
              style={{
                width: SLOT_WIDTH,
                height: SLOT_HEIGHT,
                overflow: "hidden",
              }}
            >
              <RouteCard
                blurTargetRef={blurTargetRef}
                terminalName={item.terminalName}
                terminalSlug={item.terminalSlug}
                destinations={item.destinations}
              />
            </View>
          </RoutesCarouselItem>
        )}
      />
    </View>
  );
};

export default RoutesCarousel;
