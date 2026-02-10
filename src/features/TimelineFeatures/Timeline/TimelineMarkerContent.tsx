/**
 * TimelineMarkerContent wraps label and time(s) for a timeline marker.
 * Provides the content slot (sizing/positioning so content doesn't clip in zero-width horizontal layout)
 * and centers content by default; use className (e.g. "mt-4", "ml-8") to position.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { cn } from "@/lib/utils";

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
      className={cn("items-center justify-center", className)}
      style={{
        width: 500,
        height: 200,
        overflow: "visible",
      }}
    >
      {children}
    </View>
  );
};

export default TimelineMarkerContent;
