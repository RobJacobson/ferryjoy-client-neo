/**
 * VerticalTimeline is a domain-agnostic timeline primitive.
 * Parent components control row data, progress, and card content.
 */

import { View } from "react-native";
import { cn } from "@/lib/utils";
import type { TimelineRow, TimelineTheme } from "./TimelineTypes";
import { TimelineTrack } from "./TimelineTrack";
import { getDurationMinutes, getValidatedPercentComplete } from "./timelineMath";

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
      const durationMinutes = getDurationMinutes(row);
      const percentComplete = getValidatedPercentComplete(row);

      return (
        <View
          key={row.id}
          className={cn("w-full flex-row items-stretch", rowClassName)}
          style={{
            flexGrow: durationMinutes,
            flexBasis: 0,
            minHeight: minSegmentPx,
          }}
        >
          <View className="flex-1 justify-start">{row.leftContent}</View>

          <View
            className="relative self-stretch"
            style={{
              width: centerAxisSizePx,
            }}
          >
            <TimelineTrack
              orientation="vertical"
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
