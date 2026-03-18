/**
 * Shared full-height timeline track component.
 */

import { View } from "@/components/ui";
import {
  TIMELINE_INDICATOR_SIZE_PX,
  TIMELINE_TRACK_X_POSITION_PERCENT,
} from "./config";

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
      style={{
        left: `${TIMELINE_TRACK_X_POSITION_PERCENT}%`,
        width: TIMELINE_INDICATOR_SIZE_PX,
        height: containerHeightPx,
        marginLeft: -TIMELINE_INDICATOR_SIZE_PX / 2,
      }}
    >
      <View
        className="flex-row justify-center"
        style={{ flex: completedPercent }}
      >
        <View
          className="bg-green-400"
          style={{ width: 4, height: "100%", borderRadius: "100%" }}
        />
      </View>
      <View
        className="flex-row justify-center"
        style={{ flex: remainingPercent }}
      >
        <View
          className="bg-green-100"
          style={{ width: 4, height: "100%", borderRadius: "100%" }}
        />
      </View>
    </View>
  );
};
