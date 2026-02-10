/**
 * TimelineBarAtSea component for rendering at-sea trip segments with distance-based progress.
 * Calculates progress based on departing and arriving distances.
 * Handles rocking animation for at-sea segments.
 */

import { useEffect } from "react";
import type { ViewStyle } from "react-native";
import { useSharedValue, withSpring } from "react-native-reanimated";
import { Text } from "@/components/ui";
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
  departingDistance?: number;
  arrivingDistance?: number;
  vesselName?: string;
  speed?: number;
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
  departingDistance,
  arrivingDistance,
  vesselName,
  speed = 0,
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
    departingDistance !== undefined &&
    arrivingDistance !== undefined &&
    departingDistance + arrivingDistance > 0
  ) {
    progress = departingDistance / (departingDistance + arrivingDistance);
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
          speed={speed}
        >
          {vesselName && (
            <Text className="text-sm font-bold leading-none font-playwrite pt-4">
              {vesselName}
            </Text>
          )}
          {!isArrived && arrivingDistance !== undefined && (
            <Text className="text-xs text-muted-foreground font-playwrite-light">
              {speed.toFixed(0)} kn · {arrivingDistance.toFixed(1)} mi
            </Text>
          )}
          {isArrived && (
            <Text className="text-xs text-muted-foreground font-playwrite-light">
              Arrived ❤️❤️❤️
            </Text>
          )}
        </TimelineIndicator>
      )}
    </TimelineSegment>
  );
};

export default TimelineBarAtSea;
