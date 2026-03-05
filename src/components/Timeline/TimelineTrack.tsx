/**
 * TimelineTrack renders a single timeline segment backbone.
 *
 * Visual elements:
 * - Completed track: styled track from start to current progress
 * - Upcoming track: styled track from current progress to end
 * - Static marker: positioned at segment start (top or left)
 * - Moving indicator: positioned at current progress point (only when in progress)
 */

import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { cn } from "@/lib/utils";
import { TimelineMarker } from "./TimelineMarker";
import type {
  RequiredTimelineTheme,
  TimelineOrientation,
} from "./TimelineTypes";
import { shouldShowMovingIndicator } from "./timelineMath";

type TimelineTrackProps = {
  orientation: TimelineOrientation;
  percentComplete: number;
  theme: RequiredTimelineTheme;
  showIndicator?: boolean;
  showTrack?: boolean;
  markerContent?: ReactNode;
  indicatorContent?: ReactNode;
};

/**
 * Renders one timeline track segment with marker and optional moving indicator.
 *
 * @param orientation - Timeline orientation (vertical or horizontal)
 * @param percentComplete - Progress ratio from 0 to 1
 * @param theme - Theme configuration with all styling values
 * @param showIndicator - Show moving indicator when true
 * @param showTrack - Show track line when true
 * @param markerContent - Optional content for static marker dot
 * @param indicatorContent - Optional content for moving indicator dot
 * @returns Track segment
 */
export const TimelineTrack = ({
  orientation,
  percentComplete,
  theme,
  showIndicator = true,
  showTrack = true,
  markerContent,
  indicatorContent,
}: TimelineTrackProps) => {
  const isVertical = orientation === "vertical";
  // Show moving indicator only for active in-progress segments
  const movingIndicatorVisible =
    showTrack && showIndicator && shouldShowMovingIndicator(percentComplete);
  const completedPercent: PercentString = `${percentComplete * 100}%`;
  const remainingPercent: PercentString = `${(1 - percentComplete) * 100}%`;

  return (
    <View className="relative flex-1 items-center justify-center self-stretch">
      {showTrack && (
        <>
          {/* Completed portion of the track */}
          <View
            className={cn(
              "absolute rounded-full",
              theme.completeTrackClassName,
              "",
            )}
            style={getCompletedTrackStyle(
              isVertical,
              theme.trackThicknessPx,
              completedPercent,
            )}
          />
          {/* Upcoming/remaining portion of the track */}
          <View
            className={cn(
              "absolute rounded-full",
              theme.upcomingTrackClassName,
            )}
            style={getUpcomingTrackStyle(
              isVertical,
              theme.trackThicknessPx,
              completedPercent,
              remainingPercent,
            )}
          />
        </>
      )}

      {/* Static marker at segment start */}
      <View
        className={cn("absolute")}
        style={getMarkerStyle(isVertical, theme.markerSizePx)}
      >
        <TimelineMarker
          sizePx={theme.markerSizePx}
          className={theme.markerClassName}
        >
          {markerContent}
        </TimelineMarker>
      </View>

      {/* Moving indicator for in-progress segments */}
      {movingIndicatorVisible && (
        <View
          className={cn("absolute")}
          style={getIndicatorStyle(
            isVertical,
            theme.indicatorSizePx,
            completedPercent,
          )}
        >
          <TimelineMarker
            sizePx={theme.indicatorSizePx}
            className={theme.indicatorClassName}
          >
            {indicatorContent}
          </TimelineMarker>
        </View>
      )}
    </View>
  );
};

type PercentString = `${number}%`;

/**
 * Returns style props for the completed track segment.
 *
 * The completed segment extends from the track start to the progress point.
 * Width/height depends on orientation, with the dimension along the track
 * proportional to completion percentage.
 *
 * @param isVertical - Orientation flag determining primary axis direction
 * @param trackThicknessPx - Track thickness in pixels for cross-axis dimension
 * @param completedPercent - Completed portion percentage (e.g., "60%")
 * @returns View style for completed segment
 */
const getCompletedTrackStyle = (
  isVertical: boolean,
  trackThicknessPx: number,
  completedPercent: PercentString,
): ViewStyle => ({
  // Dimension varies by completion in primary axis direction
  width: isVertical ? trackThicknessPx : undefined,
  height: isVertical ? completedPercent : trackThicknessPx,
  left: isVertical ? "50%" : 0,
  top: isVertical ? 0 : "50%",
  // Center track on axis with offset
  marginTop: isVertical ? undefined : -trackThicknessPx / 2,
  marginLeft: isVertical ? -trackThicknessPx / 2 : undefined,
});

/**
 * Returns style props for the upcoming track segment.
 *
 * The upcoming segment extends from the progress point to the track end.
 * Its position starts where the completed segment ends, creating a
 * continuous visual track.
 *
 * @param isVertical - Orientation flag determining primary axis direction
 * @param trackThicknessPx - Track thickness in pixels for cross-axis dimension
 * @param completedPercent - Completed portion percentage (e.g., "60%")
 * @param remainingPercent - Remaining portion percentage (e.g., "40%")
 * @returns View style for upcoming segment
 */
const getUpcomingTrackStyle = (
  isVertical: boolean,
  trackThicknessPx: number,
  completedPercent: PercentString,
  remainingPercent: PercentString,
): ViewStyle => ({
  // Dimension varies by remaining in primary axis direction
  width: isVertical ? trackThicknessPx : remainingPercent,
  height: isVertical ? remainingPercent : trackThicknessPx,
  // Position starts where completed segment ends
  left: isVertical ? "50%" : completedPercent,
  top: isVertical ? completedPercent : "50%",
  // Center track on axis with offset
  marginTop: isVertical ? undefined : -trackThicknessPx / 2,
  marginLeft: isVertical ? -trackThicknessPx / 2 : undefined,
});

/**
 * Returns style props for the static marker dot.
 *
 * The marker is always positioned at the segment start point (top for vertical,
 * left for horizontal) and centered on the track axis via negative margins.
 *
 * @param isVertical - Orientation flag determining anchor position
 * @param markerSizePx - Marker diameter in pixels for centering
 * @returns View style for marker dot container
 */
const getMarkerStyle = (
  isVertical: boolean,
  markerSizePx: number,
): ViewStyle => ({
  top: isVertical ? 0 : "50%",
  left: isVertical ? "50%" : 0,
  marginTop: -markerSizePx / 2,
  marginLeft: -markerSizePx / 2,
});

/**
 * Returns style props for the moving progress indicator dot.
 *
 * The indicator is positioned along the track at the progress point and
 * centered on the track axis via negative margins. Only visible when
 * progress is between 0 and 1 (exclusive).
 *
 * @param isVertical - Orientation flag determining axis direction
 * @param indicatorSizePx - Indicator diameter in pixels for centering
 * @param completedPercent - Completed portion percentage (e.g., "60%")
 * @returns View style for indicator dot container
 */
const getIndicatorStyle = (
  isVertical: boolean,
  indicatorSizePx: number,
  completedPercent: PercentString,
): ViewStyle => ({
  top: isVertical ? completedPercent : "50%",
  left: isVertical ? "50%" : completedPercent,
  marginTop: -indicatorSizePx / 2,
  marginLeft: -indicatorSizePx / 2,
});
