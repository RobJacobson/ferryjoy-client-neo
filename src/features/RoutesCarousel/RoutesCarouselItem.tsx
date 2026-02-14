/**
 * Single carousel item wrapper that applies parallax animated style.
 * Receives slot dimensions and scroll shared value; renders children inside Animated.View.
 */

import type { PropsWithChildren } from "react";
import type { SharedValue } from "react-native-reanimated";
import Animated from "react-native-reanimated";
import { useCarouselItemAnimatedStyle } from "@/features/RoutesCarousel/useCarouselItemAnimatedStyle";

// ============================================================================
// Types
// ============================================================================

type RoutesCarouselItemProps = {
  /** Item index in the list. */
  index: number;
  /** Shared scroll offset (x). */
  scrollX: SharedValue<number>;
  /** Width of one carousel slot. */
  slotWidth: number;
  /** Accessibility label for the item. */
  accessibilityLabel: string;
};

// ============================================================================
// RoutesCarouselItem
// ============================================================================

/**
 * Wrapper that applies animated style to a carousel item from scroll position.
 * Display structure (e.g. View + RouteCard) is passed as children from parent.
 *
 * @param props - index, scroll shared value, slot dimensions, accessibility label, children
 */
export const RoutesCarouselItem = ({
  index,
  scrollX,
  slotWidth,
  accessibilityLabel,
  children,
}: PropsWithChildren<RoutesCarouselItemProps>) => {
  const animatedStyle = useCarouselItemAnimatedStyle(index, scrollX, slotWidth);

  return (
    <Animated.View
      style={[animatedStyle, { width: slotWidth, flex: 1 }]}
      className="overflow-hidden"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Animated.View>
  );
};
