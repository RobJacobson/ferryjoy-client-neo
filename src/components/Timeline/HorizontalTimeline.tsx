/**
 * HorizontalTimeline is the horizontal variant of timeline primitives.
 * It reuses the same row model and pivots layout to columns.
 */

import { View } from "react-native";
import { cn } from "@/lib/utils";
import type { TimelineRow, TimelineTheme } from "./TimelineTypes";
import { TimelineTrack } from "./TimelineTrack";
import { getDurationMinutes, getValidatedPercentComplete } from "./timelineMath";

type HorizontalTimelineProps = TimelineTheme & {
  rows: TimelineRow[];
  className?: string;
  columnClassName?: string;
};

/**
 * Renders a horizontal timeline. `leftContent` maps to top slot,
 * and `rightContent` maps to bottom slot for each column.
 *
 * @param rows - Timeline rows with Date range and completion
 * @param className - Optional container classes
 * @param columnClassName - Optional per-column classes
 * @param minSegmentPx - Minimum column width
 * @param centerAxisSizePx - Height of center timeline row
 * @param trackThicknessPx - Track line thickness
 * @param markerSizePx - Static marker dot size
 * @param indicatorSizePx - Moving indicator dot size
 * @param completeTrackClassName - Completed portion classes
 * @param upcomingTrackClassName - Upcoming portion classes
 * @param markerClassName - Marker classes
 * @param indicatorClassName - Moving indicator classes
 * @returns Horizontal timeline view
 */
export const HorizontalTimeline = ({
  rows,
  className,
  columnClassName,
  minSegmentPx = 64,
  centerAxisSizePx = 56,
  trackThicknessPx = 8,
  markerSizePx = 18,
  indicatorSizePx = 28,
  completeTrackClassName = "bg-green-400",
  upcomingTrackClassName = "bg-green-100",
  markerClassName = "border-2 border-green-500 bg-white",
  indicatorClassName = "border-2 border-green-500 bg-green-100",
}: HorizontalTimelineProps) => (
  <View className={cn("w-full flex-row items-stretch", className)}>
    {rows.map((row) => {
      const durationMinutes = getDurationMinutes(row);
      const percentComplete = getValidatedPercentComplete(row);

      return (
        <View
          key={row.id}
          className={cn("flex-col items-stretch", columnClassName)}
          style={{
            flexGrow: durationMinutes,
            flexBasis: 0,
            minWidth: minSegmentPx,
          }}
        >
          <View className="flex-1 justify-end">{row.leftContent}</View>

          <View
            className="relative"
            style={{
              height: centerAxisSizePx,
            }}
          >
            <TimelineTrack
              orientation="horizontal"
              percentComplete={percentComplete}
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
