/**
 * RoutesCarousel – ScrollView-based carousel of terminal RouteCards.
 * Parallax background (BlurTargetView + Background) is rendered behind in index.tsx.
 * First item is a blank invisible placeholder for alignment.
 */

import type { RefObject } from "react";
import { useImperativeHandle } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
  type SharedValue,
  scrollTo,
  useAnimatedRef,
  useDerivedValue,
  useScrollOffset,
} from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";
import type { TerminalCardData } from "@/data/terminalConnections";
import { RouteCard } from "@/features/RoutesCarousel/RouteCard";
import { RoutesCarouselItem } from "@/features/RoutesCarousel/RoutesCarouselItem";
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
   * Shared scroll offset (x) in pixels; updated by useScrollOffset for Background parallax.
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
 * Renders a ScrollView-based carousel of terminal RouteCards with scroll-driven
 * animations. The carousel uses imperative handle for programmatic navigation,
 * updates scrollX for background parallax, and includes a blank placeholder
 * item for visual alignment.
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
  const totalCount = terminalCards.length + 1;
  const {
    slotWidth,
    slotHeight,
    snapInterval,
    sidePadding,
    contentPadding,
    spacing,
  } = layout;

  const animatedRef = useAnimatedRef<Animated.ScrollView>();
  useScrollOffset(animatedRef, scrollX);
  const scrollXNormalized = useDerivedValue(
    () => scrollX.value / snapInterval,
    [snapInterval]
  );

  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex: (index: number) => {
        const clamped = Math.max(0, Math.min(index, totalCount - 1));
        const x = clamped * snapInterval;
        scheduleOnUI(() => {
          "worklet";
          scrollTo(animatedRef, x, 0, true);
        });
      },
    }),
    [snapInterval, animatedRef, totalCount]
  );

  return (
    <View className="relative flex-1 items-center justify-center">
      <Animated.ScrollView
        ref={animatedRef}
        horizontal
        contentContainerStyle={{
          gap: spacing,
          paddingHorizontal: sidePadding,
          paddingTop: contentPadding.paddingTop,
          paddingBottom: contentPadding.paddingBottom,
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
export type { RoutesCarouselRef } from "./types";
