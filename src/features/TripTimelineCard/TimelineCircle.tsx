import { View } from "@/components/ui";
import { MILESTONE_SIZE } from "./constants";

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
};

export const TimelineCircle = ({
  position,
  positionType,
  status,
}: TimelineCircleProps) => {
  const filled = getFilledState(positionType, status);

  return (
    <View
      className="absolute justify-center items-center"
      style={{
        left: `${position}%`,
        top: "50%",
        transform: [
          { translateX: -MILESTONE_SIZE / 2 },
          { translateY: -MILESTONE_SIZE / 2 },
        ], // Center the circle on the position both horizontally and vertically
      }}
    >
      <View
        className={
          filled
            ? "rounded-full border border-secondary bg-primary"
            : "rounded-full border bg-background border-primary/50"
        }
        style={{
          width: MILESTONE_SIZE,
          height: MILESTONE_SIZE,
        }}
      />
    </View>
  );
};
