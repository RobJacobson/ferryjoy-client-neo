/**
 * Horizontal timeline variant that reuses the TimelineRow model with column layout.
 *
 * Maps TimelineRow slots as follows:
 * - leftContent → top slot (above the axis)
 * - rightContent → bottom slot (below the axis)
 *
 * Each column's width is proportional to its duration, with a minimum width
 * enforced by the theme's minSegmentPx value.
 */

import { View, type ViewStyle } from "react-native";
import { cn } from "@/lib/utils";
import { TimelineTrack } from "./TimelineTrack";
import type {
  RequiredTimelineTheme,
  TimelineRow,
  TimelineTheme,
} from "./TimelineTypes";
import { DEFAULT_TIMELINE_THEME } from "./TimelineTypes";
import {
  getDurationMinutes,
  getValidatedPercentComplete,
} from "./timelineMath";

type HorizontalTimelineProps = {
  rows: TimelineRow[];
  theme?: TimelineTheme;
  className?: string;
  columnClassName?: string;
};

/**
 * Renders a horizontal timeline with columns for each timeline segment.
 *
 * Timeline row slots map to column positions:
 * - leftContent renders above the axis
 * - rightContent renders below the axis
 *
 * Columns are sized proportionally to their duration, with a minimum
 * width enforced by the theme's minSegmentPx value.
 *
 * @param rows - Timeline rows with Date range and completion
 * @param theme - Optional theme configuration with defaults applied
 * @param className - Optional container classes
 * @param columnClassName - Optional per-column classes
 * @returns Horizontal timeline view
 */
export const HorizontalTimeline = ({
  rows,
  theme = {},
  className,
  columnClassName,
}: HorizontalTimelineProps) => {
  const mergedTheme: RequiredTimelineTheme = {
    ...DEFAULT_TIMELINE_THEME,
    ...theme,
  };

  return (
    <View className={cn("w-full flex-row items-stretch", className)}>
      {rows.map((row) => {
        // Track position in sequence to hide track on last column
        const isLastColumn = rows[rows.length - 1]?.id === row.id;
        const durationMinutes = getDurationMinutes(row);
        const percentComplete = getValidatedPercentComplete(row);

        return (
          <View
            key={row.id}
            className={cn("flex-col items-stretch", columnClassName)}
            style={getHorizontalColumnStyle(
              durationMinutes,
              mergedTheme.minSegmentPx
            )}
          >
            <View className="flex-1 justify-end">{row.leftContent}</View>

            <View
              className="relative"
              style={getAxisStyle(mergedTheme.centerAxisSizePx)}
            >
              <TimelineTrack
                orientation="horizontal"
                percentComplete={percentComplete}
                showTrack={!isLastColumn}
                theme={mergedTheme}
                markerContent={row.markerContent}
                indicatorContent={row.indicatorContent}
              />
            </View>

            <View className="flex-1 justify-start">{row.rightContent}</View>
          </View>
        );
      })}
    </View>
  );
};

/**
 * Builds style for a horizontal timeline column segment.
 *
 * The column grows proportionally to its duration but never shrinks
 * below minSegmentPx, ensuring short segments remain visible.
 *
 * @param durationMinutes - Segment flex-grow value derived from row duration
 * @param minSegmentPx - Global theme default for minimum column width in pixels
 * @returns View style for a horizontal timeline column
 */
const getHorizontalColumnStyle = (
  durationMinutes: number,
  minSegmentPx: number
): ViewStyle => ({
  flexGrow: durationMinutes,
  flexBasis: 0,
  minWidth: minSegmentPx,
});

/**
 * Builds style for the center axis container.
 *
 * @param centerAxisSizePx - Height of the axis row in pixels
 * @returns View style for axis container
 */
const getAxisStyle = (centerAxisSizePx: number): ViewStyle => ({
  height: centerAxisSizePx,
});
