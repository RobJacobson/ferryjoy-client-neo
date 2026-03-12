/**
 * Full-height timeline track component for the base layer.
 * Draws completed and remaining track bars driven by a single boundary (topPx).
 * Markers are rendered per-row; this component only draws the two bars.
 */

import { View, type ViewStyle } from "react-native";
import type { RequiredTimelineTheme } from "./TimelineTypes";

type TimelineTrackProps = {
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
export const TimelineTrack = ({
  containerHeightPx,
  boundaryTopPx,
  theme,
}: TimelineTrackProps) => {
  if (containerHeightPx <= 0) {
    return null;
  }

  const completedPercent = Math.max(
    0,
    Math.min(1, boundaryTopPx / containerHeightPx)
  );
  const remainingPercent = 1 - completedPercent;

  return (
    <View
      className="absolute left-1/2 flex-col"
      pointerEvents="none"
      style={getContainerStyle(theme.centerAxisSizePx, containerHeightPx)}
    >
      {/* Completed portion: flex share = percent completed */}
      <View
        className="flex-row justify-center"
        style={{ flex: completedPercent }}
      >
        <View
          className={theme.completeTrackClassName}
          style={getBarStyle(theme.trackThicknessPx)}
        />
      </View>
      {/* Remaining portion: flex share = percent remaining */}
      <View
        className="flex-row justify-center"
        style={{ flex: remainingPercent }}
      >
        <View
          className={theme.upcomingTrackClassName}
          style={getBarStyle(theme.trackThicknessPx)}
        />
      </View>
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

const getBarStyle = (trackThicknessPx: number): ViewStyle => ({
  width: trackThicknessPx,
  height: "100%",
  borderRadius: "100%",
});
