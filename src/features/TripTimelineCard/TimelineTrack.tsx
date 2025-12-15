import { View } from "@/components/ui";

export type TimelineTrackProps = {
  progressP: number;
};

export const TimelineTrack = ({ progressP }: TimelineTrackProps) => {
  const fillWidthPercent = progressP * 100;

  return (
    <View className="absolute top-[28px] h-3 left-0 right-0">
      {/* Background track */}
      <View className="absolute inset-0 rounded-full bg-muted" />

      {/* Progress fill - extends from left edge to progress position (eastbound) */}
      {progressP > 0 && (
        <View
          className="absolute inset-y-0 rounded-full bg-primary"
          style={{
            left: 0,
            width: `${fillWidthPercent}%`,
          }}
        />
      )}
    </View>
  );
};
