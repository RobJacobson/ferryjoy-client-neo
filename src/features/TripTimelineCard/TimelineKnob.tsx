import { View } from "@/components/ui";
import { KNOB_SIZE } from "./constants";

export type TimelineKnobProps = {
  progressPosition: number; // 0-100, percentage position
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

export const TimelineKnob = ({ progressPosition }: TimelineKnobProps) => {
  return (
    <View
      className="absolute rounded-full border-2 bg-background border-primary"
      style={{
        top: "50%",
        left: `${progressPosition}%`,
        transform: [
          { translateX: -KNOB_SIZE / 2 },
          { translateY: -KNOB_SIZE / 2 },
        ], // Center the knob on the position both horizontally and vertically
        width: KNOB_SIZE,
        height: KNOB_SIZE,
        ...shadowStyle,
      }}
    />
  );
};
