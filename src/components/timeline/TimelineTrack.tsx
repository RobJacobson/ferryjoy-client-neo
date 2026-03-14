/**
 * Shared full-height timeline track component.
 */

import type { ViewStyle } from "react-native";
import { View } from "@/components/ui";
import { TRACK_STYLE } from "./theme";

type TimelineTrackProps = {
  containerHeightPx: number;
  completedPercent: number;
  remainingPercent: number;
};

export const TimelineTrack = ({
  containerHeightPx,
  completedPercent,
  remainingPercent,
}: TimelineTrackProps) => {
  if (containerHeightPx <= 0) {
    return null;
  }

  return (
    <View
      className="absolute left-1/2 flex-col"
      pointerEvents="none"
      style={getContainerStyle(TRACK_STYLE.centerAxisSizePx, containerHeightPx)}
    >
      <View
        className="flex-row justify-center"
        style={{ flex: completedPercent }}
      >
        <View
          className={TRACK_STYLE.completeTrackClassName}
          style={getBarStyle(TRACK_STYLE.trackThicknessPx)}
        />
      </View>
      <View
        className="flex-row justify-center"
        style={{ flex: remainingPercent }}
      >
        <View
          className={TRACK_STYLE.upcomingTrackClassName}
          style={getBarStyle(TRACK_STYLE.trackThicknessPx)}
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
