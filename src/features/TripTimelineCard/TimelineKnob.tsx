import { View } from "@/components/ui";
import { KNOB_SIZE, TRACK_HEIGHT, TRACK_Y } from "./constants";

export type TimelineKnobProps = {
  progressPosition: number; // 0-100, percentage position
};

export const TimelineKnob = ({ progressPosition }: TimelineKnobProps) => {
  return (
    <View className="absolute inset-0">
      {/* Knob */}
      <View
        className="absolute rounded-full border-2 bg-background border-primary"
        style={{
          top: TRACK_Y + TRACK_HEIGHT / 2 - KNOB_SIZE / 2,
          left: `${progressPosition}%`,
          marginLeft: -KNOB_SIZE / 2, // Center the knob on the position
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          ...shadowStyle,
        }}
      />
    </View>
  );
};

const shadowStyle = {
  // iOS shadows
  shadowColor: "#000",
  shadowOffset: { width: -1, height: 1 },
  shadowOpacity: 0.2,
  shadowRadius: 2,
  // Android elevation
  elevation: 2,
};
