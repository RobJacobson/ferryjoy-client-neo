/**
 * TerminalCarouselNav – Prev/next buttons for terminal carousel navigation.
 * Positioned at 50% vertical height, left and right. Only visible when there
 * is a previous or next terminal to navigate to.
 */

import type { PropsWithChildren, RefObject } from "react";
import { View } from "react-native";
import { TerminalNavButton } from "@/features/RoutesCarousel/TerminalNavButton";
import type { RoutesCarouselRef } from "@/features/RoutesCarousel/types";
import { cn } from "@/lib/utils";

type TerminalCarouselNavProps = {
  /** Ref to the carousel for imperative scrollToIndex. */
  carouselRef: RefObject<RoutesCarouselRef | null>;
  /** Current visible carousel index. */
  currentIndex: number;
  /** Total number of carousel items (including placeholder). */
  totalCount: number;
};

/**
 * Renders prev/next navigation buttons for the terminal carousel.
 * Prev shows when currentIndex > 0; next shows when currentIndex < totalCount - 1.
 *
 * @param carouselRef - Ref to the carousel for imperative scrollToIndex
 * @param currentIndex - Current visible carousel index
 * @param totalCount - Total number of carousel items (including placeholder)
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
        <NavButtonContainer positionClass="left-2">
          <TerminalNavButton
            direction="prev"
            onPress={() => carouselRef.current?.scrollToIndex(currentIndex - 1)}
            accessibilityLabel="Previous terminal"
          />
        </NavButtonContainer>
      )}
      {showNext && (
        <NavButtonContainer positionClass="right-2">
          <TerminalNavButton
            direction="next"
            onPress={() => carouselRef.current?.scrollToIndex(currentIndex + 1)}
            accessibilityLabel="Next terminal"
          />
        </NavButtonContainer>
      )}
    </>
  );
};

/**
 * Positions a navigation button at 50% vertical height with specified
 * horizontal position and z-index.
 *
 * @param positionClass - Tailwind class for horizontal positioning
 * @param children - Navigation button component
 */
const NavButtonContainer = ({
  positionClass,
  children,
}: PropsWithChildren<{
  positionClass: string;
}>) => (
  <View
    className={cn("absolute top-1/2 z-[210] -translate-y-1/2", positionClass)}
  >
    {children}
  </View>
);
