import type { ViewStyle } from "react-native";
import { Text, View } from "@/components/ui";
import {
  GRAPHIC_HEIGHT,
  MILESTONE_SIZE,
  TRACK_HEIGHT,
  TRACK_Y,
} from "./constants";
import type { TripTimelineCardLabel } from "./useTripTimelineCardModel";

export type TimelineCircleProps = {
  position: number; // 0-100, where 0 = left edge, 100 = right edge
  filled: boolean;
  label: TripTimelineCardLabel;
};

export const TimelineCircle = ({
  position,
  filled,
  label,
}: TimelineCircleProps) => {
  // Parent container positioned at the percentage
  // position = 0 means left edge, position = 100 means right edge
  const containerStyle: ViewStyle = {
    left: `${position}%`,
  };

  // Circle positioned vertically, centered horizontally by flexbox
  const circleStyle: ViewStyle = {
    position: "absolute",
    top: TRACK_Y + TRACK_HEIGHT / 2 - MILESTONE_SIZE / 2,
    width: MILESTONE_SIZE,
    height: MILESTONE_SIZE,
  };

  // Label positioned vertically, centered horizontally by flexbox
  const labelStyle: ViewStyle = {
    position: "absolute",
    top: GRAPHIC_HEIGHT,
  };

  return (
    <View className="absolute items-center" style={containerStyle}>
      {/* Circle */}
      <View
        className={
          filled
            ? "rounded-full border border-secondary bg-primary"
            : "rounded-full border bg-background border-border"
        }
        style={circleStyle}
      />

      {/* Label */}
      <View style={labelStyle}>
        <View className="items-center">
          <Text variant="body2" className="font-bold text-center">
            {label.time}
          </Text>
          <Text variant="body2" color="muted" className="text-center">
            {label.description}
          </Text>
        </View>
      </View>
    </View>
  );
};
