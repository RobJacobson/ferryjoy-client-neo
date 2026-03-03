/**
 * VerticalTimeline is a domain-agnostic timeline primitive.
 * Parent components control row data, progress, and card content.
 */

import { View, type ViewStyle } from "react-native";
import { cn } from "@/lib/utils";
import { TimelineTrack } from "./TimelineTrack";
import type { TimelineRow, TimelineTheme } from "./TimelineTypes";
import {
  getDurationMinutes,
  getValidatedPercentComplete,
} from "./timelineMath";

type VerticalTimelineProps = TimelineTheme & {
  rows: TimelineRow[];
  className?: string;
  rowClassName?: string;
};

/**
 * Renders a vertical timeline with left/center/right row slots.
 *
 * @param rows - Timeline rows with Date range and completion
 * @param className - Optional container classes
 * @param rowClassName - Optional per-row classes
 * @param minSegmentPx - Minimum row height
 * @param centerAxisSizePx - Width of center timeline column
 * @param trackThicknessPx - Track line thickness
 * @param markerSizePx - Static marker dot size
 * @param indicatorSizePx - Moving indicator dot size
 * @param completeTrackClassName - Completed portion classes
 * @param upcomingTrackClassName - Upcoming portion classes
 * @param markerClassName - Marker classes
 * @param indicatorClassName - Moving indicator classes
 * @returns Vertical timeline view
 */
export const VerticalTimeline = ({
  rows,
  className,
  rowClassName,
  minSegmentPx = 64,
  centerAxisSizePx = 56,
  trackThicknessPx = 8,
  markerSizePx = 18,
  indicatorSizePx = 28,
  completeTrackClassName = "bg-green-400",
  upcomingTrackClassName = "bg-green-100",
  markerClassName = "border-2 border-green-500 bg-white",
  indicatorClassName = "border-2 border-green-500 bg-green-100",
}: VerticalTimelineProps) => (
  <View className={cn("w-full flex-col", className)}>
    {rows.map((row) => {
      // Track position in sequence to hide track on last row
      const isLastRow = rows[rows.length - 1]?.id === row.id;
      const durationMinutes = getDurationMinutes(row);
      const percentComplete = getValidatedPercentComplete(row);

      return (
        <View
          key={row.id}
          className={cn("w-full flex-row items-stretch", rowClassName)}
          style={getVerticalRowStyle(durationMinutes, minSegmentPx)}
        >
          <View className="flex-1 justify-start">{row.leftContent}</View>

          <View
            className="relative self-stretch"
            style={getAxisStyle(centerAxisSizePx)}
          >
            <TimelineTrack
              orientation="vertical"
              percentComplete={percentComplete}
              showTrack={!isLastRow}
              trackThicknessPx={trackThicknessPx}
              markerSizePx={markerSizePx}
              indicatorSizePx={indicatorSizePx}
              completeTrackClassName={completeTrackClassName}
              upcomingTrackClassName={upcomingTrackClassName}
              markerClassName={markerClassName}
              indicatorClassName={indicatorClassName}
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

/**
 * Builds style for a vertical timeline row segment.
 *
 * @param durationMinutes - Segment flex-grow value derived from row duration
 * @param minSegmentPx - Minimum row height in pixels
 * @returns View style for a vertical timeline row
 */
const getVerticalRowStyle = (
  durationMinutes: number,
  minSegmentPx: number
): ViewStyle => ({
  flexGrow: durationMinutes,
  flexBasis: 0,
  minHeight: minSegmentPx,
});

/**
 * Builds style for the center axis container.
 *
 * @param centerAxisSizePx - Width of the axis column in pixels
 * @returns View style for axis container
 */
const getAxisStyle = (centerAxisSizePx: number): ViewStyle => ({
  width: centerAxisSizePx,
});
