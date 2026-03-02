/**
 * TimelineTrack renders a single timeline segment backbone.
 * It includes: upcoming track, completed track, top marker, and moving indicator.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { cn } from "@/lib/utils";
import { TimelineDot } from "./TimelineDot";
import type { TimelineOrientation } from "./TimelineTypes";
import { shouldShowMovingIndicator } from "./timelineMath";

type TimelineTrackProps = {
  orientation: TimelineOrientation;
  percentComplete: number;
  trackThicknessPx: number;
  markerSizePx: number;
  indicatorSizePx: number;
  completeTrackClassName: string;
  upcomingTrackClassName: string;
  markerClassName: string;
  indicatorClassName: string;
  markerContent?: ReactNode;
  indicatorContent?: ReactNode;
};

/**
 * Renders one timeline track segment with marker and optional moving indicator.
 *
 * @param props - Track rendering props
 * @returns Track segment
 */
export const TimelineTrack = ({
  orientation,
  percentComplete,
  trackThicknessPx,
  markerSizePx,
  indicatorSizePx,
  completeTrackClassName,
  upcomingTrackClassName,
  markerClassName,
  indicatorClassName,
  markerContent,
  indicatorContent,
}: TimelineTrackProps) => {
  const isVertical = orientation === "vertical";
  const movingIndicatorVisible = shouldShowMovingIndicator(percentComplete);

  return (
    <View className="relative flex-1 items-center justify-center self-stretch">
      <View
        className={cn(
          "absolute rounded-full",
          upcomingTrackClassName,
          isVertical ? "h-full" : "w-full",
        )}
        style={{
          width: isVertical ? trackThicknessPx : undefined,
          height: isVertical ? undefined : trackThicknessPx,
          left: isVertical ? "50%" : 0,
          top: isVertical ? 0 : "50%",
          marginTop: isVertical ? undefined : -trackThicknessPx / 2,
          marginLeft: isVertical ? -trackThicknessPx / 2 : undefined,
        }}
      />
      <View
        className={cn(
          "absolute rounded-full",
          completeTrackClassName,
          "",
        )}
        style={{
          width: isVertical ? trackThicknessPx : `${percentComplete * 100}%`,
          height: isVertical ? `${percentComplete * 100}%` : trackThicknessPx,
          top: isVertical ? 0 : "50%",
          left: isVertical ? "50%" : 0,
          marginTop: isVertical ? undefined : -trackThicknessPx / 2,
          marginLeft: isVertical ? -trackThicknessPx / 2 : undefined,
        }}
      />

      <View
        className={cn("absolute")}
        style={{
          top: isVertical ? 0 : "50%",
          left: isVertical ? "50%" : 0,
          marginTop: isVertical ? -markerSizePx / 2 : -markerSizePx / 2,
          marginLeft: isVertical ? -markerSizePx / 2 : -markerSizePx / 2,
        }}
      >
        <TimelineDot sizePx={markerSizePx} className={markerClassName}>
          {markerContent}
        </TimelineDot>
      </View>

      {movingIndicatorVisible && (
        <View
          className={cn("absolute")}
          style={{
            top: isVertical ? `${percentComplete * 100}%` : "50%",
            left: isVertical ? "50%" : `${percentComplete * 100}%`,
            marginTop: -indicatorSizePx / 2,
            marginLeft: -indicatorSizePx / 2,
          }}
        >
          <TimelineDot sizePx={indicatorSizePx} className={indicatorClassName}>
            {indicatorContent}
          </TimelineDot>
        </View>
      )}
    </View>
  );
};
