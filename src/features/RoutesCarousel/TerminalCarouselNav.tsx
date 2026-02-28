/**
 * TerminalCarouselNav – Prev/next buttons positioned at 50% vertical height.
 *
 * Buttons only visible when there's a previous or next terminal to navigate to.
 */

import type { RefObject } from "react";
import { View } from "react-native";
import { TerminalNavButton } from "@/features/RoutesCarousel/TerminalNavButton";
import type { RoutesCarouselRef } from "@/features/RoutesCarousel/types";

type TerminalCarouselNavProps = {
  carouselRef: RefObject<RoutesCarouselRef | null>;
  currentIndex: number;
  totalCount: number;
};

/**
 * Renders prev/next navigation buttons for terminal carousel.
 * @param carouselRef - Ref to carousel for imperative scrollToIndex
 * @param currentIndex - Current visible carousel index
 * @param totalCount - Total number of carousel items
 */
export const TerminalCarouselNav = ({
  carouselRef,
  currentIndex,
  totalCount,
}: TerminalCarouselNavProps) => {
  const showPrev = currentIndex > 0;
  const showNext = currentIndex < totalCount - 1;

  if (!showPrev && !showNext) {
    return null;
  }

  return (
    <>
      {showPrev && (
        <View className="absolute top-1/2 left-2 z-[210] -translate-y-1/2">
          <TerminalNavButton
            direction="prev"
            onPress={() => carouselRef.current?.scrollToIndex(currentIndex - 1)}
            accessibilityLabel="Previous terminal"
          />
        </View>
      )}
      {showNext && (
        <View className="absolute top-1/2 right-2 z-[210] -translate-y-1/2">
          <TerminalNavButton
            direction="next"
            onPress={() => carouselRef.current?.scrollToIndex(currentIndex + 1)}
            accessibilityLabel="Next terminal"
          />
        </View>
      )}
    </>
  );
};
