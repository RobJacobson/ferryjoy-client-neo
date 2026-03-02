/**
 * TimelineTrack renders a single timeline segment backbone.
 * It includes: upcoming track, completed track, top marker, and moving indicator.
 */

import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
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
  showTrack?: boolean;
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
  showTrack = true,
}: TimelineTrackProps) => {
  const isVertical = orientation === "vertical";
  const movingIndicatorVisible =
    showTrack && shouldShowMovingIndicator(percentComplete);
  const completedPercent: PercentString = `${percentComplete * 100}%`;
  const remainingPercent: PercentString = `${(1 - percentComplete) * 100}%`;

  return (
    <View className="relative flex-1 items-center justify-center self-stretch">
      {showTrack && (
        <>
          <View
            className={cn("absolute rounded-full", completeTrackClassName, "")}
            style={getCompletedTrackStyle(
              isVertical,
              trackThicknessPx,
              completedPercent
            )}
          />
          <View
            className={cn("absolute rounded-full", upcomingTrackClassName, "")}
            style={getUpcomingTrackStyle(
              isVertical,
              trackThicknessPx,
              completedPercent,
              remainingPercent
            )}
          />
        </>
      )}

      <View
        className={cn("absolute")}
        style={getMarkerStyle(isVertical, markerSizePx)}
      >
        <TimelineDot sizePx={markerSizePx} className={markerClassName}>
          {markerContent}
        </TimelineDot>
      </View>

      {movingIndicatorVisible && (
        <View
          className={cn("absolute")}
          style={getIndicatorStyle(
            isVertical,
            indicatorSizePx,
            completedPercent
          )}
        >
          <TimelineDot sizePx={indicatorSizePx} className={indicatorClassName}>
            {indicatorContent}
          </TimelineDot>
        </View>
      )}
    </View>
  );
};

type PercentString = `${number}%`;

/**
 * Returns style props for the completed track segment.
 *
 * @param isVertical - Orientation flag
 * @param trackThicknessPx - Track thickness in pixels
 * @param completedPercent - Completed portion percentage
 * @returns View style for completed segment
 */
const getCompletedTrackStyle = (
  isVertical: boolean,
  trackThicknessPx: number,
  completedPercent: PercentString
): ViewStyle => ({
  width: isVertical ? trackThicknessPx : undefined,
  height: isVertical ? completedPercent : trackThicknessPx,
  left: isVertical ? "50%" : 0,
  top: isVertical ? 0 : "50%",
  marginTop: isVertical ? undefined : -trackThicknessPx / 2,
  marginLeft: isVertical ? -trackThicknessPx / 2 : undefined,
});

/**
 * Returns style props for the upcoming track segment.
 *
 * @param isVertical - Orientation flag
 * @param trackThicknessPx - Track thickness in pixels
 * @param completedPercent - Completed portion percentage
 * @param remainingPercent - Remaining portion percentage
 * @returns View style for upcoming segment
 */
const getUpcomingTrackStyle = (
  isVertical: boolean,
  trackThicknessPx: number,
  completedPercent: PercentString,
  remainingPercent: PercentString
): ViewStyle => ({
  width: isVertical ? trackThicknessPx : remainingPercent,
  height: isVertical ? remainingPercent : trackThicknessPx,
  left: isVertical ? "50%" : completedPercent,
  top: isVertical ? completedPercent : "50%",
  marginTop: isVertical ? undefined : -trackThicknessPx / 2,
  marginLeft: isVertical ? -trackThicknessPx / 2 : undefined,
});

/**
 * Returns style props for the static marker dot.
 *
 * @param isVertical - Orientation flag
 * @param markerSizePx - Marker diameter in pixels
 * @returns View style for marker dot container
 */
const getMarkerStyle = (
  isVertical: boolean,
  markerSizePx: number
): ViewStyle => ({
  top: isVertical ? 0 : "50%",
  left: isVertical ? "50%" : 0,
  marginTop: -markerSizePx / 2,
  marginLeft: -markerSizePx / 2,
});

/**
 * Returns style props for the moving progress indicator dot.
 *
 * @param isVertical - Orientation flag
 * @param indicatorSizePx - Indicator diameter in pixels
 * @param completedPercent - Completed portion percentage
 * @returns View style for indicator dot container
 */
const getIndicatorStyle = (
  isVertical: boolean,
  indicatorSizePx: number,
  completedPercent: PercentString
): ViewStyle => ({
  top: isVertical ? completedPercent : "50%",
  left: isVertical ? "50%" : completedPercent,
  marginTop: -indicatorSizePx / 2,
  marginLeft: -indicatorSizePx / 2,
});
