/**
 * Single timeline row component with left/center/right layout slots.
 * Supports optional per-row minimum height overrides via `row.minHeight`,
 * which takes precedence over the row style default min height.
 *
 * Center slot renders only the segment-start marker; track bars are drawn
 * by a separate base-layer component (e.g. FullTimelineTrack in features).
 */

import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, { Easing, LinearTransition } from "react-native-reanimated";
import { cn } from "@/lib/utils";
import { ROW_STYLE } from "../theme";
import { TimelineMarker } from "./TimelineMarker";

export type TimelineRowBounds = {
  y: number;
  height: number;
};

const ROW_LAYOUT_TRANSITION_DURATION_MS = 5000;

export type TimelineRowProps = {
  id: string;
  durationMinutes: number;
  leftContent?: ReactNode;
  rightContent?: ReactNode;
  markerContent?: ReactNode;
  minHeight?: number;
  rowClassName?: string;
  onRowLayout: (rowId: string, bounds: TimelineRowBounds) => void;
};

/**
 * Renders a single timeline row with left content, center marker, and right content.
 *
 * @param props - Flattened row layout and content props
 * @returns Timeline row view
 */
export const TimelineRow = ({
  id,
  durationMinutes,
  leftContent,
  rightContent,
  markerContent,
  minHeight,
  rowClassName,
  onRowLayout,
}: TimelineRowProps) => {
  const rowStyle = getVerticalRowStyle(
    durationMinutes,
    ROW_STYLE.minSegmentPx,
    minHeight
  );

  return (
    <Animated.View
      className={cn("w-full flex-row items-stretch", rowClassName)}
      style={rowStyle}
      layout={LinearTransition.duration(
        ROW_LAYOUT_TRANSITION_DURATION_MS
      ).easing(Easing.inOut(Easing.quad))}
      onLayout={(event) => {
        const { y, height } = event.nativeEvent.layout;
        onRowLayout(id, { y, height });
      }}
    >
      <View className="flex-1 justify-start">{leftContent}</View>

      <TimelineMarker
        centerAxisSizePx={ROW_STYLE.centerAxisSizePx}
        sizePx={ROW_STYLE.markerSizePx}
        className={ROW_STYLE.markerClassName}
      >
        {markerContent}
      </TimelineMarker>

      <View className="flex-1 justify-start">{rightContent}</View>
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
  minSegmentPx: number,
  minHeight?: number
): ViewStyle => ({
  flexGrow: minHeight === 0 ? 0 : durationMinutes,
  flexBasis: "auto",
  minHeight: minHeight ?? minSegmentPx,
});
