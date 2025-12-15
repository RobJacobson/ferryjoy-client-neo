import { View } from "@/components/ui";
import type { TripTimelineCardDirection } from "./types";

export type TimelineTrackProps = {
  direction: TripTimelineCardDirection;
  progressP: number;
};

export const TimelineTrack = ({ direction, progressP }: TimelineTrackProps) => {
  const isEastward = direction === "eastward";
  const fillWidthPercent = progressP * 100;

  return (
    <View className="absolute top-[28px] h-3 left-0 right-0">
      {/* Background track */}
      <View className="absolute inset-0 rounded-full bg-muted" />

      {/* Progress fill - extends from start edge (eastward) or end edge (westward) to progress position */}
      {progressP > 0 && (
        <View
          className="absolute inset-y-0 rounded-full bg-primary"
          style={
            isEastward
              ? {
                  left: 0,
                  width: `${fillWidthPercent}%`,
                }
              : {
                  right: 0,
                  width: `${fillWidthPercent}%`,
                }
          }
        />
      )}
    </View>
  );
};
