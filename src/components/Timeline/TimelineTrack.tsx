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
import { type DimensionValue, View, type ViewStyle } from "react-native";
import { cn } from "@/lib/utils";
import { getAbsoluteCenteredBoxStyle } from "@/shared/utils";
import { TimelineMarker } from "./TimelineMarker";
import { TimelineProgressIndicator } from "./TimelineProgressIndicator";
import type {
  RequiredTimelineTheme,
  TimelineOrientation,
} from "./TimelineTypes";

const TRACK_Z_INDEX = 0;
const MARKER_Z_INDEX = 1;

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
  const completedPercent: DimensionValue = `${percentComplete * 100}%`;
  const remainingPercent: DimensionValue = `${(1 - percentComplete) * 100}%`;

  return (
    <View className="relative flex-1 items-center justify-center self-stretch">
      {showTrack && (
        <>
          {/* Completed portion of the track */}
          <View
            className={cn(
              "absolute rounded-full",
              theme.completeTrackClassName,
              ""
            )}
            style={getCompletedTrackStyle(
              isVertical,
              theme.trackThicknessPx,
              completedPercent
            )}
          />
          {/* Upcoming/remaining portion of the track */}
          <View
            className={cn(
              "absolute rounded-full",
              theme.upcomingTrackClassName
            )}
            style={getUpcomingTrackStyle(
              isVertical,
              theme.trackThicknessPx,
              completedPercent,
              remainingPercent
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

      <TimelineProgressIndicator
        isVertical={isVertical}
        percentComplete={percentComplete}
        showIndicator={showIndicator}
        showTrack={showTrack}
        indicatorSizePx={theme.indicatorSizePx}
        indicatorClassName={theme.indicatorClassName}
        indicatorContent={indicatorContent}
      />
    </View>
  );
};

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
  completedPercent: DimensionValue
): ViewStyle => ({
  // Dimension varies by completion in primary axis direction
  width: isVertical ? trackThicknessPx : undefined,
  height: isVertical ? completedPercent : trackThicknessPx,
  left: isVertical ? "50%" : 0,
  top: isVertical ? 0 : "50%",
  zIndex: TRACK_Z_INDEX,
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
  completedPercent: DimensionValue,
  remainingPercent: DimensionValue
): ViewStyle => ({
  // Dimension varies by remaining in primary axis direction
  width: isVertical ? trackThicknessPx : remainingPercent,
  height: isVertical ? remainingPercent : trackThicknessPx,
  // Position starts where completed segment ends
  left: isVertical ? "50%" : completedPercent,
  top: isVertical ? completedPercent : "50%",
  zIndex: TRACK_Z_INDEX,
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
  markerSizePx: number
): ViewStyle => ({
  zIndex: MARKER_Z_INDEX,
  ...getAbsoluteCenteredBoxStyle({
    width: markerSizePx,
    height: markerSizePx,
    isVertical,
  }),
});
