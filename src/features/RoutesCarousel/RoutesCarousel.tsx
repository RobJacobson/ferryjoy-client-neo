/**
 * RoutesCarousel – ScrollView-based carousel of terminal RouteCards.
 * Parallax background (BlurTargetView + Background) is rendered behind in index.tsx.
 * First item is a blank invisible placeholder for alignment.
 */

import type { RefObject } from "react";
import { useEffect, useImperativeHandle } from "react";
import { useWindowDimensions, View, type ViewStyle } from "react-native";
import Animated, {
  type SharedValue,
  scrollTo,
  useAnimatedRef,
  useDerivedValue,
  useScrollOffset,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnUI } from "react-native-worklets";
import {
  TERMINAL_CONNECTIONS,
  TOTAL_CAROUSEL_ITEMS,
  transformConnectionsToTerminalCards,
} from "@/data/terminalConnections";
import { RouteCard } from "@/features/RoutesCarousel/RouteCard";
import { RoutesCarouselItem } from "@/features/RoutesCarousel/RoutesCarouselItem";

/** Horizontal spacing between carousel items */
const SPACING = 12;
/** Portrait aspect ratio for RouteCards (8:16) */
const PORTRAIT_ASPECT_RATIO = 8 / 16;

/**
 * Imperative handle for programmatic carousel navigation.
 * Allows parent components to scroll to specific indices.
 */
export type RoutesCarouselRef = {
  scrollToIndex: (index: number) => void;
};

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
   * Shared scroll offset (x) in pixels; updated by useScrollOffset for Background parallax.
   * This value drives the parallax animation of background layers.
   */
  scrollX: SharedValue<number>;
  /**
   * Called when slot width (snap interval) is computed.
   * Allows parent to use the computed layout dimensions.
   */
  onSlotWidthChange: (slotWidth: number) => void;
};

const RoutesCarousel = ({
  ref,
  blurTargetRef,
  scrollX,
  onSlotWidthChange,
}: RoutesCarouselProps) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Transform terminal connection data into carousel card format
  const terminalCards =
    transformConnectionsToTerminalCards(TERMINAL_CONNECTIONS);

  // Largest 9:16 rect that fits in 90% of viewport (width and height)
  const maxW = windowWidth * 0.9;
  const maxH = windowHeight * 0.9;
  const slotWidth = Math.min(maxW, maxH * PORTRAIT_ASPECT_RATIO);
  const slotHeight = Math.min(maxH, maxW / PORTRAIT_ASPECT_RATIO);

  // Distance between snap points (card width + spacing)
  const snapInterval = slotWidth + SPACING;
  // Center padding creates visual balance by centering the first/last items
  const sidePadding = Math.max(0, (windowWidth - slotWidth) / 2);

  const animatedRef = useAnimatedRef<Animated.ScrollView>();
  // Track scroll offset for parallax background animation
  useScrollOffset(animatedRef, scrollX);
  // Normalize scroll position to 0-1 range for index calculations
  const scrollXNormalized = useDerivedValue(
    () => scrollX.value / snapInterval,
    [snapInterval],
  );

  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex: (index: number) => {
        const clamped = Math.max(0, Math.min(index, TOTAL_CAROUSEL_ITEMS - 1));
        const x = clamped * snapInterval;
        // Schedule scroll on UI thread for smooth animation
        scheduleOnUI(() => {
          "worklet";
          scrollTo(animatedRef, x, 0, true);
        });
      },
    }),
    [snapInterval, animatedRef],
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
        decelerationRate={0.999}
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
      >
        <View
          key="__placeholder__"
          style={[
            { width: slotWidth, height: slotHeight },
            { opacity: 0, pointerEvents: "none" } as ViewStyle,
          ]}
        />
        {terminalCards.map((item, index) => (
          <RoutesCarouselItem
            key={item.terminalSlug}
            index={index + 1}
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
