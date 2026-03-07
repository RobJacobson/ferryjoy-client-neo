/**
 * Peer overlay primitive that renders a single absolute indicator above
 * a VerticalTimeline in "background" render mode.
 *
 * The overlay is positioned based on measured row layouts and progress data
 * from useVerticalTimelineOverlayPlacement. Uses pointerEvents="none" to
 * ensure touches pass through to underlying timeline cards.
 *
 * Centering is achieved via negative margins that offset the indicator
 * container by half its size in both dimensions.
 */

import type { PropsWithChildren } from "react";
import { View } from "react-native";
import { cn } from "@/lib/utils";

type VerticalTimelineIndicatorOverlayProps = PropsWithChildren<{
  placement?: { top: number; left: number };
  indicatorSizePx: number;
  indicatorClassName?: string;
}>;

/**
 * Renders a centered absolute indicator at a measured timeline position.
 *
 * Returns null if placement data is unavailable (e.g., during initial layout
 * measurement). Once positioned, the overlay uses negative margins to center
 * itself on the calculated top/left coordinates.
 *
 * @param placement - Absolute position {top, left} for indicator center
 * @param indicatorSizePx - Indicator diameter for centering calculations
 * @param indicatorClassName - Optional NativeWind classes for the indicator
 * @param children - Optional content to render inside the indicator
 * @returns Absolute overlay indicator or null when placement is unavailable
 */
export const VerticalTimelineIndicatorOverlay = ({
  placement,
  indicatorSizePx,
  indicatorClassName,
  children,
}: VerticalTimelineIndicatorOverlayProps) => {
  if (!placement) {
    return null;
  }

  return (
    <View
      className="absolute"
      // Overlay should never capture touches from timeline cards beneath.
      pointerEvents="none"
      style={{
        top: placement.top,
        left: placement.left,
        marginTop: -indicatorSizePx / 2,
        marginLeft: -indicatorSizePx / 2,
      }}
    >
      <View
        style={{ width: indicatorSizePx, height: indicatorSizePx }}
        className={cn(
          "items-center justify-center rounded-full",
          indicatorClassName
        )}
      >
        {children}
      </View>
    </View>
  );
};
