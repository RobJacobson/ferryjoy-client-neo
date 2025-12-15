import { View } from "@/components/ui";
import { KNOB_SIZE, TRACK_HEIGHT, TRACK_Y } from "./constants";

export type TimelineKnobProps = {
  progressX: number;
};

export const TimelineKnob = ({ progressX }: TimelineKnobProps) => {
  return (
    <View
      className="absolute rounded-full border-2 bg-background border-primary"
      style={{
        top: TRACK_Y + TRACK_HEIGHT / 2 - KNOB_SIZE / 2,
        left: progressX - KNOB_SIZE / 2,
        width: KNOB_SIZE,
        height: KNOB_SIZE,
      }}
    />
  );
};
