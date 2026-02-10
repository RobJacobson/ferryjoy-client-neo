/**
 * TimelineBarAtSea component for rendering at-sea trip segments with distance-based progress.
 * Calculates progress based on departing and arriving distances.
 * Handles rocking animation for at-sea segments.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import { useEffect } from "react";
import type { ViewStyle } from "react-native";
import { useSharedValue, withSpring } from "react-native-reanimated";
import { Text, View } from "@/components/ui";
import { useNowMs } from "@/shared/hooks";
import TimelineBar from "./TimelineBar";
import TimelineIndicator from "./TimelineIndicator";
import { TimelineSegment } from "./TimelineSegment";
import type { TimelineSegmentStatus } from "./types";
import { getTimelineLayout } from "./utils";

// ============================================================================
// Types
// ============================================================================

type TimelineBarAtSeaProps = {
  startTimeMs?: number;
  endTimeMs?: number;
  status: TimelineSegmentStatus;
  predictionEndTimeMs?: number;
  isArrived?: boolean;
  isHeld?: boolean;
  vesselLocation?: VesselLocation;
  circleSize?: number;
  orientation?: "horizontal" | "vertical";
  barStyle?: string;
  showIndicator?: boolean;
  animate?: boolean;
  style?: ViewStyle;
};

/**
 * A component that renders an at-sea progress segment with distance-based progress.
 * Calculates all business logic (progress, duration) and renders
 * using the presentation-only TimelineBar and TimelineIndicator components.
 * The TimelineBar and TimelineIndicator are siblings to allow proper z-index stacking.
 *
 * Width allocation: Uses SchematicSegment (flexGrow + minWidth) to create
 * proportional widths across the timeline while ensuring legibility.
 *
 * Hold period: When isArrived is true, the indicator remains visible during
 * the 30-second hold period, showing "0 min" remaining instead of speed/distance.
 */
const TimelineBarAtSea = ({
  startTimeMs,
  endTimeMs,
  status,
  predictionEndTimeMs,
  isArrived = false,
  isHeld = false,
  vesselLocation,
  orientation = "horizontal",
  barStyle = "h-3",
  showIndicator,
  animate = false,
  style,
}: TimelineBarAtSeaProps) => {
  const nowMs = useNowMs(1000);

  const {
    progress: timeProgress,
    minutesRemaining,
    duration,
  } = getTimelineLayout({
    status,
    nowMs,
    startTimeMs,
    endTimeMs,
    predictionEndTimeMs,
  });

  // Position indicator: end of segment when arrived, or when held after completion.
  // When held at origin (at-dock), status is Pending — do not set progress = 1 (would show bar as green).
  let progress = timeProgress;
  if (isArrived) {
    progress = 1;
  } else if (isHeld && status === "Completed") {
    progress = 1;
  } else if (
    status === "InProgress" &&
    vesselLocation?.DepartingDistance !== undefined &&
    vesselLocation?.ArrivingDistance !== undefined &&
    vesselLocation.DepartingDistance + vesselLocation.ArrivingDistance > 0
  ) {
    progress =
      vesselLocation.DepartingDistance /
      (vesselLocation.DepartingDistance + vesselLocation.ArrivingDistance);
    progress = Math.min(1, Math.max(0, progress));
  }

  const animatedProgress = useSharedValue(progress);

  useEffect(() => {
    // If progress is 1 or 0, we jump immediately without spring to avoid initial animation glitch
    if (progress === 1 || progress === 0) {
      animatedProgress.value = progress;
    } else {
      animatedProgress.value = withSpring(progress, {
        damping: 100,
        stiffness: 2,
        mass: 5,
        overshootClamping: true,
      });
    }
  }, [progress, animatedProgress]);

  const shouldShowIndicator =
    showIndicator ?? (status === "InProgress" || isHeld);

  return (
    <TimelineSegment
      duration={duration ?? 1}
      orientation={orientation}
      style={style}
    >
      <TimelineBar
        flexGrow={1}
        progress={progress}
        orientation={orientation}
        barStyle={barStyle}
      />
      {shouldShowIndicator && (
        <TimelineIndicator
          progress={animatedProgress}
          orientation={orientation}
          minutesRemaining={minutesRemaining ?? "--"}
          animate={animate}
          speed={vesselLocation?.Speed ?? 0}
        >
          {vesselLocation?.VesselName && (
            <Text className="text-sm font-playpen-600">
              {vesselLocation.VesselName}
            </Text>
          )}
          {!isArrived && vesselLocation?.ArrivingDistance !== undefined && (
            <Text className="text-sm text-muted-foreground font-playpen-300 leading-[1.15]">
              {(vesselLocation?.Speed ?? 0).toFixed(0)} kn{" · "}
              {vesselLocation?.ArrivingDistance?.toFixed(1)} mi
            </Text>
          )}
          {isArrived && (
            <Text className="text-xs text-muted-foreground font-playpen-300 leading-[1.15]">
              ❤️ Arrived! ❤️
            </Text>
          )}
        </TimelineIndicator>
      )}
    </TimelineSegment>
  );
};

export default TimelineBarAtSea;
