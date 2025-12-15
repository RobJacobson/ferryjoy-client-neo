import { StyleSheet, type ViewStyle } from "react-native";
import { Text, View } from "@/components/ui";
import {
  GRAPHIC_HEIGHT,
  MILESTONE_SIZE,
  TRACK_HEIGHT,
  TRACK_Y,
} from "./constants";

const getFilledState = (
  positionType: "start" | "depart" | "end",
  status: "future" | "atDock" | "atSea" | "arrived"
): boolean => {
  switch (positionType) {
    case "start":
      return status !== "future";
    case "depart":
      return status === "atSea" || status === "arrived";
    case "end":
      return status === "arrived";
    default:
      return false;
  }
};

export type TimelineCircleProps = {
  position: number; // 0-100, where 0 = left edge, 100 = right edge
  positionType: "start" | "depart" | "end";
  status: "future" | "atDock" | "atSea" | "arrived";
  time: string;
  description: string;
};

export const TimelineCircle = ({
  position,
  positionType,
  status,
  time,
  description,
}: TimelineCircleProps) => {
  const filled = getFilledState(positionType, status);
  // Parent container positioned at the percentage
  // position = 0 means left edge, position = 100 means right edge
  const containerStyle: ViewStyle = {
    left: `${position}%`,
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
        style={styles.circle}
      />

      {/* Label */}
      <View style={styles.label}>
        <View className="items-center">
          <Text variant="body2" className="font-bold text-center my-[-2]">
            {time}
          </Text>
          <Text variant="body2" color="muted" className="text-center my-[-2]">
            {description}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  circle: {
    position: "absolute",
    top: TRACK_Y + TRACK_HEIGHT / 2 - MILESTONE_SIZE / 2,
    width: MILESTONE_SIZE,
    height: MILESTONE_SIZE,
  },
  label: {
    position: "absolute",
    top: GRAPHIC_HEIGHT - 8,
  },
});
