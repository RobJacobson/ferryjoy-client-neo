/**
 * RoutesCarousel – ScrollView-based carousel of terminal RouteCards.
 * Parallax background (BlurTargetView + Background) is rendered behind in index.tsx.
 */

import type { RefObject } from "react";
import { useEffect } from "react";
import { useWindowDimensions, View, type ViewStyle } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedRef,
  useDerivedValue,
  useScrollOffset,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  TERMINAL_CONNECTIONS,
  transformConnectionsToTerminalCards,
} from "@/data/terminalConnections";
import { RouteCard } from "@/features/RoutesCarousel/RouteCard";
import { RoutesCarouselItem } from "@/features/RoutesCarousel/RoutesCarouselItem";

const SPACING = 12;
const PORTRAIT_ASPECT_RATIO = 8 / 16;

type RoutesCarouselProps = {
  /** Ref to BlurTargetView; passed to RouteCards for BlurView. */
  blurTargetRef: RefObject<View | null>;
  /** Shared scroll offset (x) in pixels; updated by useScrollOffset for Background parallax. */
  scrollX: SharedValue<number>;
  /** Called when slot width (snap interval) is computed; used for Background parallax. */
  onSlotWidthChange: (slotWidth: number) => void;
};

const RoutesCarousel = ({
  blurTargetRef,
  scrollX,
  onSlotWidthChange,
}: RoutesCarouselProps) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const terminalCards =
    transformConnectionsToTerminalCards(TERMINAL_CONNECTIONS);

  // Largest 9:16 rect that fits in 90% of viewport (width and height)
  const maxW = windowWidth * 0.9;
  const maxH = windowHeight * 0.9;
  const slotWidth = Math.min(maxW, maxH * PORTRAIT_ASPECT_RATIO);
  const slotHeight = Math.min(maxH, maxW / PORTRAIT_ASPECT_RATIO);

  const snapInterval = slotWidth + SPACING;
  const sidePadding = Math.max(0, (windowWidth - slotWidth) / 2);

  const animatedRef = useAnimatedRef<Animated.ScrollView>();
  useScrollOffset(animatedRef, scrollX);
  const scrollXNormalized = useDerivedValue(
    () => scrollX.value / snapInterval,
    [snapInterval],
  );

  useEffect(() => {
    onSlotWidthChange(snapInterval);
  }, [snapInterval, onSlotWidthChange]);

  return (
    <View className="relative flex-1 items-center justify-center">
      <Animated.ScrollView
        ref={animatedRef}
        horizontal
        contentContainerStyle={{
          gap: SPACING,
          paddingHorizontal: sidePadding,
          paddingTop: 24 + insets.top,
          paddingBottom: 24 + insets.bottom,
        }}
        style={[
          { width: "100%", flexGrow: 0 },
          { scrollSnapType: "x mandatory" } as ViewStyle,
        ]}
        scrollEventThrottle={16}
        snapToInterval={snapInterval}
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
      >
        {terminalCards.map((item, index) => (
          <RoutesCarouselItem
            key={item.terminalSlug}
            index={index}
            scrollX={scrollXNormalized}
            width={slotWidth}
            height={slotHeight}
            accessibilityLabel={item.terminalName}
          >
            <RouteCard
              blurTargetRef={blurTargetRef}
              terminalName={item.terminalName}
              terminalSlug={item.terminalSlug}
              destinations={item.destinations}
              width={slotWidth}
              height={slotHeight}
            />
          </RoutesCarouselItem>
        ))}
      </Animated.ScrollView>
    </View>
  );
};

export default RoutesCarousel;
