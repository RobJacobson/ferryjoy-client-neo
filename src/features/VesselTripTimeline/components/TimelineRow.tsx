/**
 * Single timeline row container with measurement and vertical sizing.
 * This component is responsible only for flex/height and reporting its
 * measured bounds; callers own all inner content/layout via children.
 */

import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";
import Animated, { Easing, LinearTransition } from "react-native-reanimated";
import { cn } from "@/lib/utils";

export type TimelineRowBounds = {
  y: number;
  height: number;
};

const ROW_LAYOUT_TRANSITION_DURATION_MS = 5000;

export type TimelineRowProps = {
  id: string;
  durationMinutes: number;
  minHeight?: number;
  rowClassName?: string;
  children: ReactNode;
  onRowLayout: (rowId: string, bounds: TimelineRowBounds) => void;
};

/**
 * Renders a measurable, vertically sized timeline row.
 *
 * @param props - Row identity, sizing props, and layout callback
 * @returns Row container that reports its y/height for overlay alignment
 */
export const TimelineRow = ({
  id,
  durationMinutes,
  minHeight,
  rowClassName,
  children,
  onRowLayout,
}: TimelineRowProps) => {
  const rowStyle = getVerticalRowStyle(
    durationMinutes,
    minHeight
  );

  /** Maps the native layout event into row-bounds so overlays can align by id. */
  const handleLayout = (event: { nativeEvent: { layout: TimelineRowBounds } }) => {
    const { y, height } = event.nativeEvent.layout;
    onRowLayout(id, { y, height });
  };

  return (
    <Animated.View
      className={cn("w-full", rowClassName)}
      style={rowStyle}
      layout={LinearTransition.duration(
        ROW_LAYOUT_TRANSITION_DURATION_MS
      ).easing(Easing.inOut(Easing.quad))}
      onLayout={handleLayout}
    >
      {children}
    </Animated.View>
  );
};

/**
 * Builds style for a vertical timeline row segment.
 *
 * The minHeight parameter is an optional per-row override that takes
 * precedence over minSegmentPx. This is useful for exceptional rows
 * that need different minimum heights from the row style default.
 *
 * When minHeight is 0, the row should not expand beyond its content,
 * so flexGrow is set to 0.
 *
 * @param durationMinutes - Segment flex-grow value derived from row duration
 * @param minSegmentPx - Row style default for minimum row height in pixels
 * @param minHeight - Optional per-row minimum height override
 * @returns View style for a vertical timeline row
 */
const getVerticalRowStyle = (
  durationMinutes: number,
  minHeight?: number
): ViewStyle => ({
  flexGrow: minHeight === 0 ? 0 : durationMinutes,
  flexBasis: "auto",
  minHeight,
});
