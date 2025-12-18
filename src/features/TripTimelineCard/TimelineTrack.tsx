import { View } from "@/components/ui";

export type TimelineTrackProps = {
  progressP: number;
};

export const TimelineTrack = ({ progressP }: TimelineTrackProps) => {
  return (
    <View className="absolute inset-0">
      {/* Background track */}
      <View className="absolute inset-0 rounded-full bg-muted" />

      {/* Progress fill - extends from left edge to progress position (eastbound) */}
      {progressP > 0 && (
        <View
          className="absolute inset-y-0 rounded-full bg-primary"
          style={{
            left: 0,
            width: `${progressP * 100}%`,
          }}
        />
      )}
    </View>
  );
};
