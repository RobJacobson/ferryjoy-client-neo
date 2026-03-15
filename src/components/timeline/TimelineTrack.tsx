/**
 * Shared full-height timeline track component.
 */

import type { ViewStyle } from "react-native";
import { View } from "@/components/ui";
import { TIMELINE_TRACK_X_POSITION_PERCENT } from "./config";

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
      className="absolute flex-col"
      pointerEvents="none"
      style={getContainerStyle(42, containerHeightPx)}
    >
      <View
        className="flex-row justify-center"
        style={{ flex: completedPercent }}
      >
        <View className="bg-green-400" style={getBarStyle(4)} />
      </View>
      <View
        className="flex-row justify-center"
        style={{ flex: remainingPercent }}
      >
        <View className="bg-green-100" style={getBarStyle(4)} />
      </View>
    </View>
  );
};

const getContainerStyle = (
  centerAxisSizePx: number,
  heightPx: number
): ViewStyle => ({
  left: `${TIMELINE_TRACK_X_POSITION_PERCENT}%`,
  width: centerAxisSizePx,
  height: heightPx,
  marginLeft: -centerAxisSizePx / 2,
});

const getBarStyle = (trackThicknessPx: number): ViewStyle => ({
  width: trackThicknessPx,
  height: "100%",
  borderRadius: "100%",
});
