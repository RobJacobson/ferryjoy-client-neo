/**
 * TimelineMarkerContent wraps label and time(s) for a timeline marker.
 * Provides default horizontal positioning (below circle); vertical/left/right
 * via consumer className override.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { cn } from "@/lib/utils";
import { timelineMarkerConfig } from "./config";

type TimelineMarkerContentProps = {
  /**
   * Label and time components (e.g. TimelineMarkerLabel + TimelineMarkerTime).
   */
  children: ReactNode;
  /**
   * Optional className to override layout (e.g. vertical left/right).
   */
  className?: string;
};

const defaultContentTop =
  (timelineMarkerConfig.containerHeight - timelineMarkerConfig.circleSize) / 2 +
  timelineMarkerConfig.circleSize;

/**
 * Wraps marker label and times with default horizontal layout; override with className for vertical.
 *
 * @param children - TimelineMarkerLabel and TimelineMarkerTime(s)
 * @param className - Optional layout override (e.g. flex-1 flex-row justify-end pr-4 order-first for vertical left)
 * @returns A View positioning content below the circle by default
 */
const TimelineMarkerContent = ({
  children,
  className,
}: TimelineMarkerContentProps) => {
  const isHorizontal = className == null || className === "";

  return (
    <View
      className={cn(
        "flex-col items-center justify-start",
        isHorizontal && "absolute mt-3",
        className
      )}
      style={
        isHorizontal
          ? {
              top: defaultContentTop,
              left: "50%",
              marginLeft: -timelineMarkerConfig.contentWidth / 2,
              width: timelineMarkerConfig.contentWidth,
            }
          : undefined
      }
    >
      {children}
    </View>
  );
};

export default TimelineMarkerContent;
