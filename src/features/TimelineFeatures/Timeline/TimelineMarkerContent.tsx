/**
 * TimelineMarkerContent wraps label and time(s) for a timeline marker.
 * Provides the content slot (sizing/positioning so content doesn't clip in zero-width horizontal layout)
 * and centers content by default; use className (e.g. "mt-4", "ml-8") to position.
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
   * Optional className for layout (e.g. "mt-4" below circle, "ml-8" / "mr-8" beside for vertical).
   */
  className?: string;
};

const slotHeight = timelineMarkerConfig.containerHeight;
const contentWidth = timelineMarkerConfig.contentWidth;

/**
 * Wraps marker label and times in a content slot (fixed width, centered). Default is centered on the
 * circle; use className to position (e.g. mt-4 for below, ml-8/mr-8 for vertical).
 */
const TimelineMarkerContent = ({
  children,
  className,
}: TimelineMarkerContentProps) => {
  return (
    <View
      pointerEvents="box-none"
      className="items-center justify-center"
      style={{
        position: "absolute",
        left: -contentWidth / 2,
        width: contentWidth,
        top: 0,
        height: slotHeight,
        overflow: "visible",
      }}
    >
      <View className={cn("flex-col items-center", className)}>{children}</View>
    </View>
  );
};

export default TimelineMarkerContent;
