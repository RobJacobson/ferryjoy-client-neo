/**
 * Full-height timeline track component for the base layer.
 * Draws completed and remaining track bars driven by a single boundary (topPx).
 * Markers are rendered per-row; this component only draws the two bars.
 */

import { View, type ViewStyle } from "react-native";
import type { RequiredTimelineTheme } from "@/components/Timeline/TimelineTypes";
import { cn } from "@/lib/utils";

type FullTimelineTrackProps = {
  containerHeightPx: number;
  boundaryTopPx: number;
  theme: Pick<
    RequiredTimelineTheme,
    | "trackThicknessPx"
    | "centerAxisSizePx"
    | "completeTrackClassName"
    | "upcomingTrackClassName"
  >;
};

/**
 * Renders the full-height completed and remaining track bars.
 *
 * @param containerHeightPx - Total height of the timeline container in pixels
 * @param boundaryTopPx - Y position of the completed/remaining split (container-relative)
 * @param theme - Theme subset for track styling
 * @returns Full-height track view or null when not yet measured
 */
export const FullTimelineTrack = ({
  containerHeightPx,
  boundaryTopPx,
  theme,
}: FullTimelineTrackProps) => {
  if (containerHeightPx <= 0) {
    return null;
  }

  const remainingHeight = Math.max(0, containerHeightPx - boundaryTopPx);

  return (
    <View
      className="absolute left-1/2 -z-10"
      pointerEvents="none"
      style={getContainerStyle(theme.centerAxisSizePx, containerHeightPx)}
    >
      {/* Completed portion: 0 → boundaryTopPx */}
      <View
        className={cn(
          "absolute left-1/2 rounded-full",
          theme.completeTrackClassName
        )}
        style={getCompletedBarStyle(theme.trackThicknessPx, boundaryTopPx)}
      />
      {/* Remaining portion: boundaryTopPx → bottom */}
      <View
        className={cn(
          "absolute left-1/2 rounded-full",
          theme.upcomingTrackClassName
        )}
        style={getRemainingBarStyle(
          theme.trackThicknessPx,
          boundaryTopPx,
          remainingHeight
        )}
      />
    </View>
  );
};

const getContainerStyle = (
  centerAxisSizePx: number,
  heightPx: number
): ViewStyle => ({
  width: centerAxisSizePx,
  height: heightPx,
  marginLeft: -centerAxisSizePx / 2,
});

const getCompletedBarStyle = (
  trackThicknessPx: number,
  heightPx: number
): ViewStyle => ({
  top: 0,
  left: "50%",
  width: trackThicknessPx,
  height: heightPx,
  marginLeft: -trackThicknessPx / 2,
});

const getRemainingBarStyle = (
  trackThicknessPx: number,
  topPx: number,
  heightPx: number
): ViewStyle => ({
  top: topPx,
  left: "50%",
  width: trackThicknessPx,
  height: heightPx,
  marginLeft: -trackThicknessPx / 2,
});
